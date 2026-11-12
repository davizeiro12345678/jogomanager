import { z } from "zod";
import {
  MatchReceiptV1Schema,
  parseMatchReceiptV1,
  type MatchReceiptV1,
} from "./match-protocol";

export interface TournamentMatch {
  id: string;
  round: number;
  homeId: string;
  awayId: string | null;
  roomId: string | null;
  winnerId: string | null;
  receiptId: string | null;
}

export type TournamentResult =
  | "accepted"
  | "already_recorded"
  | "unverified"
  | "wrong_room"
  | "invalid_result"
  | "not_found"
  | "conflict";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MatchIdentifierSchema = z.string().regex(/^r[1-6]m(?:[1-9]|1[0-6])$/);
const RoomAssignmentSchema = z
  .object({ matchId: MatchIdentifierSchema, roomId: z.string().uuid() })
  .strict();
const RecordedResultSchema = RoomAssignmentSchema.extend({
  receipt: MatchReceiptV1Schema,
}).strict();

const TournamentCheckpointSchema = z
  .object({
    version: z.literal(1),
    entrants: z.array(z.string().uuid()).min(2).max(32),
    results: z.array(RecordedResultSchema).max(31),
    pendingRooms: z.array(RoomAssignmentSchema).max(16),
  })
  .strict();

export type VerifiedTournamentCheckpointV1 = z.infer<typeof TournamentCheckpointSchema>;

/**
 * Server-owned single elimination with deterministic first-round byes.
 * Registration, room creation and signed-receipt verification are separate
 * trusted services. No client writes a winner, score or progression directly.
 */
export class VerifiedTournamentBracket {
  private readonly rounds: TournamentMatch[][] = [];
  private readonly acceptedReceipts = new Map<string, string>();
  private readonly acceptedRecords: VerifiedTournamentCheckpointV1["results"] = [];
  private readonly entrants: string[];

  constructor(entrants: readonly string[]) {
    if (
      entrants.length < 2 ||
      entrants.length > 32 ||
      entrants.some((id) => !UUID.test(id)) ||
      new Set(entrants).size !== entrants.length
    )
      throw new Error("invalid tournament entrants");
    this.entrants = [...entrants];
    const size = 2 ** Math.ceil(Math.log2(entrants.length));
    const byes = size - entrants.length;
    const matches: TournamentMatch[] = [];
    let index = 0;
    // First seeds receive byes; remaining seeds play in their supplied
    // server-verified registration order. Never use Math.random().
    for (let i = 0; i < byes; i += 1) {
      matches.push({
        id: `r1m${++index}`,
        round: 1,
        homeId: entrants[i]!,
        awayId: null,
        roomId: null,
        winnerId: entrants[i]!,
        receiptId: null,
      });
    }
    for (let i = byes; i < entrants.length; i += 2) {
      matches.push({
        id: `r1m${++index}`,
        round: 1,
        homeId: entrants[i]!,
        awayId: entrants[i + 1]!,
        roomId: null,
        winnerId: null,
        receiptId: null,
      });
    }
    this.rounds.push(matches);
    this.advanceWhenReady();
  }

  bracket(): TournamentMatch[][] {
    return structuredClone(this.rounds);
  }

  /**
   * An immutable replayable server-side snapshot. Storage must be private.
   * Only the server's HMAC verifier may authorize restoration of receipts.
   * Never hand this checkpoint to an untrusted browser.
   */
  checkpoint(): VerifiedTournamentCheckpointV1 {
    return {
      version: 1,
      entrants: [...this.entrants],
      results: structuredClone(this.acceptedRecords),
      pendingRooms: this.rounds
        .flatMap((round) => round)
        .filter((match) => match.roomId !== null && match.receiptId === null)
        .map((match) => ({ matchId: match.id, roomId: match.roomId! })),
    };
  }

  /**
   * Rebuild deterministic brackets by replaying every signed receipt.
   * A corrupted or tampered private snapshot is rejected, not trusted.
   */
  static async restoreCheckpoint(
    input: unknown,
    verifySignedReceipt: (receipt: MatchReceiptV1) => Promise<boolean>,
  ): Promise<VerifiedTournamentBracket> {
    const checkpoint = TournamentCheckpointSchema.parse(input);
    const bracket = new VerifiedTournamentBracket(checkpoint.entrants);
    for (const { matchId, roomId, receipt } of checkpoint.results) {
      if (roomId !== receipt.roomId || !bracket.bindRoom(matchId, roomId))
        throw new Error("invalid tournament checkpoint room binding");
      if ((await bracket.submitResult(matchId, receipt, verifySignedReceipt)) !== "accepted")
        throw new Error("unverified or conflicting tournament checkpoint receipt");
    }
    for (const { matchId, roomId } of checkpoint.pendingRooms)
      if (!bracket.bindRoom(matchId, roomId))
        throw new Error("duplicate or invalid tournament pending room");
    return bracket;
  }

  champion(): string | null {
    const last = this.rounds.at(-1);
    return last?.length === 1 && last[0]?.winnerId ? last[0].winnerId : null;
  }

  bindRoom(matchId: string, roomId: string): boolean {
    if (!UUID.test(roomId)) return false;
    const match = this.find(matchId);
    if (!match || !match.awayId || match.winnerId) return false;
    if (match.roomId) return match.roomId === roomId;
    if (this.rounds.some((round) => round.some((game) => game.roomId === roomId))) return false;
    match.roomId = roomId;
    return true;
  }

  async submitResult(
    matchId: string,
    input: unknown,
    verifySignedReceipt: (receipt: MatchReceiptV1) => Promise<boolean>,
  ): Promise<TournamentResult> {
    const match = this.find(matchId);
    if (!match) return "not_found";
    if (!match.awayId || !match.roomId) return "wrong_room";
    let receipt: MatchReceiptV1;
    try {
      receipt = parseMatchReceiptV1(input);
    } catch {
      return "invalid_result";
    }
    if (receipt.roomId !== match.roomId) return "wrong_room";
    if (match.receiptId)
      return this.acceptedReceipts.get(matchId) === JSON.stringify(receipt)
        ? "already_recorded"
        : "conflict";
    if (
      (receipt.closureReason !== "completed" && receipt.closureReason !== "forfeit") ||
      receipt.result.winner === "draw"
    )
      return "invalid_result";
    try {
      if (!(await verifySignedReceipt(receipt))) return "unverified";
    } catch {
      return "unverified";
    }
    // A concurrent verified result may have completed during the await.
    if (match.receiptId)
      return this.acceptedReceipts.get(matchId) === JSON.stringify(receipt)
        ? "already_recorded"
        : "conflict";
    match.receiptId = receipt.idempotencyKey;
    this.acceptedReceipts.set(matchId, JSON.stringify(receipt));
    this.acceptedRecords.push({
      matchId,
      roomId: receipt.roomId,
      receipt: structuredClone(receipt),
    });
    match.winnerId = receipt.result.winner === "home" ? match.homeId : match.awayId;
    this.advanceWhenReady();
    return "accepted";
  }

  private find(matchId: string): TournamentMatch | null {
    for (const round of this.rounds) {
      const item = round.find((match) => match.id === matchId);
      if (item) return item;
    }
    return null;
  }

  private advanceWhenReady(): void {
    const round = this.rounds.at(-1)!;
    if (round.some((match) => !match.winnerId) || round.length === 1) return;
    const nextRound = round[0]!.round + 1;
    const matches: TournamentMatch[] = [];
    for (let i = 0; i < round.length; i += 2) {
      matches.push({
        id: `r${nextRound}m${i / 2 + 1}`,
        round: nextRound,
        homeId: round[i]!.winnerId!,
        awayId: round[i + 1]!.winnerId!,
        roomId: null,
        winnerId: null,
        receiptId: null,
      });
    }
    this.rounds.push(matches);
  }
}
