import { describe, expect, it } from "vitest";

import {
  MATCH_PROTOCOL_VERSION,
  parseMatchCommandV1,
  parseMatchTicketV1,
  type MatchPublicStateV1,
  type MatchReceiptV1,
  type MatchSeat,
  type PresentationEventV1,
} from "./match-protocol";
import {
  AuthoritativeMatchSession,
  type AuthoritativeMatchEngine,
  type MatchReceiptSigner,
} from "./authoritative-match-session";

const roomId = "45fd1d08-4f81-44bc-9072-1e35ce9d1d94";
const homeUserId = "7b40bcbe-a4ca-430c-9b49-61aa9c5118e9";
const awayUserId = "37bb485a-6ff6-4bd2-a1f4-6df6a0a1e4ef";
const issuedAt = 1_700_000_000_000;

function ticket(seat: MatchSeat) {
  return parseMatchTicketV1({
    version: MATCH_PROTOCOL_VERSION,
    roomId,
    userId: seat === "home" ? homeUserId : awayUserId,
    seat,
    issuedAt,
    expiresAt: issuedAt + 120_000,
    nonce: `ticket-nonce-for-${seat}-seat`,
    signature: `server-signature-for-${seat}-seat`,
  });
}

class FakeEngine implements AuthoritativeMatchEngine {
  readonly tacticalChanges: Array<{ seat: MatchSeat; formation: string }> = [];
  readonly substitutions: Array<{ seat: MatchSeat; playerOut: string; playerIn: string }> = [];
  private stepCount = 0;

  advanceFixedStep() {
    this.stepCount += 1;
  }

  publicState(): MatchPublicStateV1 {
    return {
      minute: Math.min(90, this.stepCount),
      score: { home: 1, away: 0 },
      possession: { home: 56, away: 44 },
    };
  }

  presentationEvents(): PresentationEventV1[] {
    return this.stepCount
      ? [{ id: `tick-${this.stepCount}`, type: "chance", tick: this.stepCount, team: "home" }]
      : [];
  }

  applyTactics(seat: MatchSeat, payload: { formation: string }) {
    this.tacticalChanges.push({ seat, formation: payload.formation });
    return true;
  }

  substitute(seat: MatchSeat, playerOut: string, playerIn: string) {
    this.substitutions.push({ seat, playerOut, playerIn });
    return true;
  }

  finalResult(loser?: MatchSeat) {
    if (loser === "home") return { homeGoals: 0, awayGoals: 3, winner: "away" as const };
    if (loser === "away") return { homeGoals: 3, awayGoals: 0, winner: "home" as const };
    return { homeGoals: 1, awayGoals: 0, winner: "home" as const };
  }
}

function command(
  sequence: number,
  kind: "ready" | "set_tactics" | "substitute" | "forfeit" | "ack_snapshot" = "ready",
) {
  const payloads = {
    ready: { ready: true },
    set_tactics: {
      formation: "4-3-3",
      mentality: "balanced",
      pressing: "high",
      width: "wide",
      tempo: "fast",
      lineHeight: "high",
    },
    substitute: { playerOut: "home-7", playerIn: "home-12" },
    forfeit: { confirmed: true },
    ack_snapshot: { revision: 1 },
  };
  return parseMatchCommandV1({
    version: MATCH_PROTOCOL_VERSION,
    roomId,
    sequence,
    kind,
    payload: payloads[kind],
  });
}

function createSession(options: { limits?: Partial<Record<"set_tactics", { limit: number; windowMs: number }>> } = {}) {
  const engine = new FakeEngine();
  let signatures = 0;
  const signer: MatchReceiptSigner = {
    sign: async () => {
      signatures += 1;
      return "authoritative-server-receipt-signature";
    },
  };
  const session = new AuthoritativeMatchSession({
    roomId,
    homeTicket: ticket("home"),
    awayTicket: ticket("away"),
    engine,
    signer,
    simulationVersion: "match-sim/1",
    idempotencyKey: "42711d45-34a3-4d6b-81bb-a67db8b7e4f0",
    commandLimits: options.limits,
  });
  return { session, engine, signatureCount: () => signatures };
}

describe("AuthoritativeMatchSession", () => {
  it("binds each connection to the signed ticket room, user and seat", () => {
    const { session } = createSession();

    expect(session.connect(ticket("home"), issuedAt)).toBe("home");
    expect(() =>
      session.connect(parseMatchTicketV1({ ...ticket("away"), roomId: "7008a399-62df-4d47-a314-0c2eb2d4c4c5" }), issuedAt),
    ).toThrow(/room/i);
  });

  it("rejects repeated or stale command sequence without mutating the engine", async () => {
    const { session, engine } = createSession();
    const home = ticket("home");
    session.connect(home, issuedAt);

    expect((await session.receive(home, command(2, "set_tactics"), issuedAt)).accepted).toBe(true);
    const repeated = await session.receive(home, command(2, "set_tactics"), issuedAt + 1);
    const stale = await session.receive(home, command(1, "set_tactics"), issuedAt + 2);

    expect(repeated).toMatchObject({ accepted: false, reason: "sequence_not_monotonic" });
    expect(stale).toMatchObject({ accepted: false, reason: "sequence_not_monotonic" });
    expect(engine.tacticalChanges).toHaveLength(1);
    expect(session.invalidAttempts).toHaveLength(2);
  });

  it("applies an independent rate window for each command category", async () => {
    const { session, engine } = createSession({ limits: { set_tactics: { limit: 1, windowMs: 5_000 } } });
    const home = ticket("home");
    session.connect(home, issuedAt);

    await session.receive(home, command(1, "set_tactics"), issuedAt);
    const limited = await session.receive(home, command(2, "set_tactics"), issuedAt + 1);
    const acknowledgement = await session.receive(home, command(2, "ack_snapshot"), issuedAt + 2);

    expect(limited).toMatchObject({ accepted: false, reason: "rate_limited" });
    expect(acknowledgement).toMatchObject({ accepted: true });
    expect(engine.tacticalChanges).toHaveLength(1);
  });

  it("keeps the last tactical plan during the 60-second reconnection window", async () => {
    const { session } = createSession();
    const home = ticket("home");
    session.connect(home, issuedAt);
    await session.receive(home, command(1, "set_tactics"), issuedAt);

    session.disconnect(home.userId, issuedAt + 100);
    expect(session.phase).toBe("reconnecting");
    expect(session.lastTacticsFor("home")?.formation).toBe("4-3-3");
    expect(await session.expireReconnects(issuedAt + 60_099)).toBeNull();

    session.connect(home, issuedAt + 60_099);
    expect(session.phase).toBe("waiting");
    expect(session.lastTacticsFor("home")?.formation).toBe("4-3-3");
  });

  it("closes as abandoned after the reconnection window and emits a signed receipt", async () => {
    const { session } = createSession();
    const home = ticket("home");
    session.connect(home, issuedAt);
    session.disconnect(home.userId, issuedAt + 1);

    const receipt = await session.expireReconnects(issuedAt + 60_001);

    expect(receipt).toMatchObject({ closureReason: "abandoned", result: { winner: "away" } });
    expect(session.phase).toBe("finalized");
  });

  it("creates a final receipt once even when finalization is retried", async () => {
    const { session, signatureCount } = createSession();

    const first = await session.finalize("completed", issuedAt + 1);
    const repeated = await session.finalize("completed", issuedAt + 2);

    expect(first).toEqual(repeated);
    expect(first.idempotencyKey).toBe("42711d45-34a3-4d6b-81bb-a67db8b7e4f0");
    expect(signatureCount()).toBe(1);
  });

  it("only publishes sanitized presentation state", () => {
    const { session } = createSession();
    session.advanceFixedTick();

    const snapshot = session.snapshot();

    expect(snapshot).toMatchObject({ tick: 1, revision: 1, phase: "waiting" });
    expect(JSON.stringify(snapshot)).not.toMatch(/seed|internal|reward/i);
    expect(snapshot.publicState.score).toEqual({ home: 1, away: 0 });
  });
});
