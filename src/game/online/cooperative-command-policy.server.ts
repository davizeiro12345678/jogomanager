import { z } from "zod";
import type { MatchCommandKind, MatchSeat } from "./match-protocol";

export interface CooperativeSide {
  captainId: string;
  partnerId: string;
}

export interface CooperativeTeamRoster {
  home: CooperativeSide;
  away: CooperativeSide;
}

export type CooperativeVoteOutcome =
  | { status: "pending"; votes: 1 }
  | { status: "approved"; votes: 2 }
  | { status: "rejected"; reason: "unauthorized" | "expired" | "already_approved" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FORFEIT_VOTE_WINDOW_MS = 30_000;
const CooperativeSideSchema = z
  .object({ captainId: z.string().uuid(), partnerId: z.string().uuid() })
  .strict();
const CooperativeRosterSchema = z
  .object({ home: CooperativeSideSchema, away: CooperativeSideSchema })
  .strict();
const CooperativeCheckpointSchema = z
  .object({
    version: z.literal(1),
    roster: CooperativeRosterSchema,
    votes: z
      .object({
        home: z.array(z.tuple([z.string().uuid(), z.number().int().nonnegative()])).max(1),
        away: z.array(z.tuple([z.string().uuid(), z.number().int().nonnegative()])).max(1),
      })
      .strict(),
    approved: z.array(z.enum(["home", "away"])).max(2),
  })
  .strict();

export type CooperativeCheckpointV1 = z.infer<typeof CooperativeCheckpointSchema>;

/**
 * Defensive 2x2 authorization boundary. It does not enable a public 2x2 mode.
 * Membership must come from the authenticated, server-persisted roster, never
 * from user IDs claimed in WebSocket frames. The existing 1x1 authority
 * session is intentionally unchanged.
 */
export class CooperativeCommandPolicy {
  private readonly roster: CooperativeTeamRoster;
  private readonly forfeitVotes: Record<MatchSeat, Map<string, number>> = {
    home: new Map(),
    away: new Map(),
  };
  private readonly approvedForfeit = new Set<MatchSeat>();

  /**
   * Private durable state. The trusted room owner must write it before it
   * acknowledges a vote or captain transfer. Never expose it to spectators.
   */
  checkpoint(): CooperativeCheckpointV1 {
    return {
      version: 1,
      roster: structuredClone(this.roster),
      votes: {
        home: [...this.forfeitVotes.home],
        away: [...this.forfeitVotes.away],
      },
      approved: [...this.approvedForfeit].sort(),
    };
  }

  /** Reject mismatched team memberships, forged votes and stale revisions. */
  static restoreCheckpoint(
    trustedRoster: CooperativeTeamRoster,
    checkpointInput: unknown,
    now: number,
  ): CooperativeCommandPolicy {
    if (!Number.isSafeInteger(now) || now < 0) throw new Error("invalid recovery clock");
    const checkpoint = CooperativeCheckpointSchema.parse(checkpointInput);
    const expected = new CooperativeCommandPolicy(trustedRoster);
    for (const seat of ["home", "away"] as const) {
      const actual = checkpoint.roster[seat];
      const verified = trustedRoster[seat];
      if (
        new Set([actual.captainId, actual.partnerId]).size !== 2 ||
        ![actual.captainId, actual.partnerId].every(
          (id) => id === verified.captainId || id === verified.partnerId,
        )
      )
        throw new Error("cooperative checkpoint membership mismatch");
    }
    if (new Set(checkpoint.approved).size !== checkpoint.approved.length)
      throw new Error("duplicate approved team");
    expected.roster.home = { ...checkpoint.roster.home };
    expected.roster.away = { ...checkpoint.roster.away };
    for (const seat of ["home", "away"] as const) {
      if (checkpoint.approved.includes(seat) && checkpoint.votes[seat].length)
        throw new Error("approved forfeit cannot also have pending votes");
      for (const [userId, time] of checkpoint.votes[seat]) {
        if (expected.seatForUser(userId) !== seat || time > now)
          throw new Error("forged cooperative forfeit vote");
        if (now - time < FORFEIT_VOTE_WINDOW_MS)
          expected.forfeitVotes[seat].set(userId, time);
      }
    }
    for (const seat of checkpoint.approved) expected.approvedForfeit.add(seat);
    return expected;
  }

  constructor(roster: CooperativeTeamRoster) {
    const ids = [
      roster.home.captainId,
      roster.home.partnerId,
      roster.away.captainId,
      roster.away.partnerId,
    ];
    if (ids.some((id) => !UUID.test(id)) || new Set(ids).size !== 4)
      throw new Error("cooperative teams require four distinct valid user IDs");
    this.roster = structuredClone(roster);
  }

  seatForUser(userId: string): MatchSeat | null {
    if (this.roster.home.captainId === userId || this.roster.home.partnerId === userId)
      return "home";
    if (this.roster.away.captainId === userId || this.roster.away.partnerId === userId)
      return "away";
    return null;
  }

  canExecute(userId: string, seat: MatchSeat, kind: MatchCommandKind): boolean {
    if (this.seatForUser(userId) !== seat) return false;
    const side = this.roster[seat];
    if (kind === "ready" || kind === "ack_snapshot") return true;
    if (kind === "set_tactics" || kind === "substitute") return side.captainId === userId;
    // Forfeit must pass both members' server-recorded votes first.
    return false;
  }

  transferCaptain(seat: MatchSeat, requesterId: string, newCaptainId: string): boolean {
    const side = this.roster[seat];
    if (side.captainId !== requesterId || side.partnerId !== newCaptainId) return false;
    this.roster[seat] = { captainId: newCaptainId, partnerId: requesterId };
    this.forfeitVotes[seat].clear();
    return true;
  }

  /**
   * Both teammates must vote within the same 30-second window to forfeit.
   * An approved vote can be consumed only once by the canonical session
   * owner; no score or closure receipt is produced here.
   */
  voteToForfeit(userId: string, seat: MatchSeat, now: number): CooperativeVoteOutcome {
    if (this.seatForUser(userId) !== seat) return { status: "rejected", reason: "unauthorized" };
    if (!Number.isSafeInteger(now) || now < 0) return { status: "rejected", reason: "expired" };
    if (this.approvedForfeit.has(seat)) return { status: "rejected", reason: "already_approved" };
    const votes = this.forfeitVotes[seat];
    for (const [voter, timestamp] of votes)
      if (now < timestamp || now - timestamp >= FORFEIT_VOTE_WINDOW_MS) votes.delete(voter);
    votes.set(userId, now);
    const side = this.roster[seat];
    if (!votes.has(side.captainId) || !votes.has(side.partnerId))
      return { status: "pending", votes: 1 };
    this.approvedForfeit.add(seat);
    votes.clear();
    return { status: "approved", votes: 2 };
  }

  isForfeitApproved(seat: MatchSeat): boolean {
    return this.approvedForfeit.has(seat);
  }
}
