import {
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

/**
 * Server-owned single elimination with deterministic first-round byes.
 * Registration, room creation and signed-receipt verification are separate
 * trusted services. No client writes a winner, score or progression directly.
 */
export class VerifiedTournamentBracket {
  private readonly rounds: TournamentMatch[][] = [];

  constructor(entrants: readonly string[]) {
    if (
      entrants.length < 2 ||
      entrants.length > 32 ||
      entrants.some((id) => !UUID.test(id)) ||
      new Set(entrants).size !== entrants.length
    )
      throw new Error("invalid tournament entrants");
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

  champion(): string | null {
    const last = this.rounds.at(-1);
    return last?.length === 1 && last[0]?.winnerId ? last[0].winnerId : null;
  }

  bindRoom(matchId: string, roomId: string): boolean {
    if (!UUID.test(roomId)) return false;
    const match = this.find(matchId);
    if (!match || !match.awayId || match.winnerId) return false;
    if (match.roomId) return match.roomId === roomId;
    if (this.rounds.some((round) => round.some((game) => game.roomId === roomId)))
      return false;
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
      return match.receiptId === receipt.idempotencyKey ? "already_recorded" : "conflict";
    if (receipt.closureReason !== "completed" || receipt.result.winner === "draw")
      return "invalid_result";
    try {
      if (!(await verifySignedReceipt(receipt))) return "unverified";
    } catch {
      return "unverified";
    }
    // A concurrent verified result may have completed during the await.
    if (match.receiptId)
      return match.receiptId === receipt.idempotencyKey ? "already_recorded" : "conflict";
    match.receiptId = receipt.idempotencyKey;
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
