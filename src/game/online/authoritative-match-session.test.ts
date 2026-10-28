import { describe, expect, it } from "vitest";

import {
  MATCH_PROTOCOL_VERSION,
  parseMatchCommandV1,
  parseMatchTicketV1,
  type MatchCommandV1,
  type MatchPublicStateV1,
  type MatchReceiptV1,
  type MatchSeat,
  type MatchTicketV1,
  type PresentationEventV1,
} from "./match-protocol";
import {
  AuthoritativeMatchSession,
  type AuthoritativeMatchEngine,
  type MatchReceiptSigner,
} from "./authoritative-match-session";
import { GENESIS_SESSION_HASH, appendCommandHash } from "./session-hash";

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

function createSession(
  options: { limits?: Partial<Record<"set_tactics", { limit: number; windowMs: number }>> } = {},
) {
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
  it("does not advance the server simulation until both authenticated seats explicitly confirm ready", async () => {
    const { session, engine } = createSession();
    const home = ticket("home");
    const away = ticket("away");

    session.connect(home, issuedAt);
    session.connect(away, issuedAt);
    expect(session.phase).toBe("waiting");
    session.advanceFixedTick();
    expect(session.snapshot().tick).toBe(0);

    await session.receive(home, command(1, "ready"), issuedAt + 1);
    expect(session.phase).toBe("waiting");
    await session.receive(away, command(1, "ready"), issuedAt + 2);
    expect(session.phase).toBe("live");

    session.advanceFixedTick();
    expect(session.snapshot().tick).toBe(1);
    expect(engine.publicState().minute).toBe(1);
  });

  it("binds each connection to the signed ticket room, user and seat", () => {
    const { session } = createSession();

    expect(session.connect(ticket("home"), issuedAt)).toBe("home");
    expect(() =>
      session.connect(
        parseMatchTicketV1({ ...ticket("away"), roomId: "7008a399-62df-4d47-a314-0c2eb2d4c4c5" }),
        issuedAt,
      ),
    ).toThrow(/room/i);
  });

  it("rejects a human match whose two seats belong to the same account", () => {
    const home = ticket("home");
    const away = { ...ticket("away"), userId: home.userId };
    expect(
      () =>
        new AuthoritativeMatchSession({
          roomId,
          homeTicket: home,
          awayTicket: away,
          engine: new FakeEngine(),
          signer: { sign: async () => "authoritative-server-receipt-signature" },
          simulationVersion: "match-sim/1",
          idempotencyKey: "42711d45-34a3-4d6b-81bb-a67db8b7e4f0",
        }),
    ).toThrow();
  });

  it("does not accept a forged extension of an expired signed ticket", () => {
    const { session } = createSession();
    const original = ticket("home");
    const forged = { ...original, expiresAt: original.expiresAt + 120_000 };

    expect(() => session.connect(forged, original.expiresAt + 1)).toThrow();
  });

  it("does not accept a changed issue time with the original signature", () => {
    const { session } = createSession();
    const original = ticket("home");
    const forged = { ...original, issuedAt: original.issuedAt - 10_000 };

    expect(() => session.connect(forged, original.issuedAt)).toThrow();
  });

  it("rejects an unsupported ticket version at the session boundary", () => {
    const { session } = createSession();
    const forged = { ...ticket("home"), version: 2 } as unknown as MatchTicketV1;
    expect(() => session.connect(forged, issuedAt)).toThrow();
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

  it("rejects malformed command payloads before they reach the engine", async () => {
    const { session, engine } = createSession();
    const malformed = {
      ...command(1, "set_tactics"),
      payload: { formation: "4-3-3", score: { home: 99, away: 0 } },
    } as unknown as MatchCommandV1;

    expect(await session.receive(ticket("home"), malformed, issuedAt)).toMatchObject({
      accepted: false,
      reason: "command_rejected",
    });
    expect(engine.tacticalChanges).toHaveLength(0);
  });

  it("applies an independent rate window for each command category", async () => {
    const { session, engine } = createSession({
      limits: { set_tactics: { limit: 1, windowMs: 5_000 } },
    });
    const home = ticket("home");
    session.connect(home, issuedAt);

    await session.receive(home, command(1, "set_tactics"), issuedAt);
    const limited = await session.receive(home, command(2, "set_tactics"), issuedAt + 1);
    const acknowledgement = await session.receive(home, command(2, "ack_snapshot"), issuedAt + 2);

    expect(limited).toMatchObject({ accepted: false, reason: "rate_limited" });
    expect(acknowledgement).toMatchObject({ accepted: true });
    expect(engine.tacticalChanges).toHaveLength(1);
  });

  it("limits tactical command floods even without custom limits", async () => {
    const { session, engine } = createSession();
    let rejected = 0;
    for (let sequence = 1; sequence <= 30; sequence++) {
      const result = await session.receive(
        ticket("home"),
        command(sequence, "set_tactics"),
        issuedAt,
      );
      if (result.reason === "rate_limited") rejected++;
    }
    expect(rejected).toBeGreaterThan(0);
    expect(engine.tacticalChanges.length).toBeLessThan(30);
    expect(
      (await session.receive(ticket("home"), command(31, "set_tactics"), issuedAt + 60_001))
        .accepted,
    ).toBe(true);
  });

  it("rejects excess queued commands while a match operation is stalled", async () => {
    let release = () => {};
    let started = () => {};
    const signingStarted = new Promise<void>((resolve) => {
      started = resolve;
    });
    const session = new AuthoritativeMatchSession({
      roomId,
      homeTicket: ticket("home"),
      awayTicket: ticket("away"),
      engine: new FakeEngine(),
      signer: {
        sign: async () => {
          started();
          await new Promise<void>((resolve) => {
            release = resolve;
          });
          return "authoritative-server-receipt-signature";
        },
      },
      simulationVersion: "match-sim/1",
      idempotencyKey: "42711d45-34a3-4d6b-81bb-a67db8b7e4f0",
    });
    const finalizing = session.finalize("completed", issuedAt + 1);
    await signingStarted;
    const queued = Array.from({ length: 100 }, (_, i) =>
      session.receive(ticket("home"), command(i + 1, "ready"), issuedAt + 2),
    );
    const result = await Promise.race([queued[99]!, Promise.resolve(null)]);
    release();
    await Promise.all([finalizing, ...queued]);

    expect(result).toMatchObject({ accepted: false, reason: "rate_limited" });
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

  it("does not finalize a queued expiration after the player has reconnected", async () => {
    const { session } = createSession();
    const home = ticket("home");
    await session.receive(home, command(1, "ready"), issuedAt);
    await session.receive(ticket("away"), command(1, "ready"), issuedAt);
    session.disconnect(home.userId, issuedAt + 1);

    const expiration = session.expireReconnects(issuedAt + 60_002);
    session.connect(home, issuedAt + 60_000);

    expect(await expiration).toBeNull();
    expect(session.phase).toBe("live");
  });

  it("does not let a player rejoin after the reconnection window expired", async () => {
    const { session } = createSession();
    const home = ticket("home");
    session.connect(home, issuedAt);
    session.disconnect(home.userId, issuedAt + 1);

    expect(() => session.connect(home, issuedAt + 60_001)).toThrow();
    expect(await session.expireReconnects(issuedAt + 60_001)).toMatchObject({
      closureReason: "abandoned",
      result: { winner: "away" },
    });
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

  it("serializes concurrent commands so the receipt contains the entire command chain", async () => {
    const { session } = createSession();
    const first = command(1, "set_tactics");
    const second = command(2, "set_tactics");
    const [one, two] = await Promise.all([
      session.receive(ticket("home"), first, issuedAt + 1),
      session.receive(ticket("home"), second, issuedAt + 2),
    ]);
    expect(one.accepted && two.accepted).toBe(true);
    const h1 = await appendCommandHash(GENESIS_SESSION_HASH, first);
    const h2 = await appendCommandHash(h1.hash, second);
    const receipt = await session.finalize("completed", issuedAt + 3);
    expect(receipt.commandHash).toBe(h2.hash);
  });

  it("records a forfeit before signing and signs just once under concurrent retries", async () => {
    const { session, signatureCount } = createSession();
    const forfeit = command(1, "forfeit");
    const [first, second] = await Promise.all([
      session.receive(ticket("home"), forfeit, issuedAt + 1),
      session.receive(ticket("home"), forfeit, issuedAt + 1),
    ]);
    expect(first.accepted).toBe(true);
    expect(second.accepted).toBe(false);
    const receipt = await session.finalize("completed", issuedAt + 2);
    expect(receipt.closureReason).toBe("forfeit");
    expect(receipt.commandHash).toBe((await appendCommandHash(GENESIS_SESSION_HASH, forfeit)).hash);
    expect(signatureCount()).toBe(1);
  });

  it("only publishes sanitized presentation state", async () => {
    const { session } = createSession();
    const home = ticket("home");
    const away = ticket("away");
    session.connect(home, issuedAt);
    session.connect(away, issuedAt);
    await session.receive(home, command(1, "ready"), issuedAt + 1);
    await session.receive(away, command(1, "ready"), issuedAt + 2);
    session.advanceFixedTick();

    const snapshot = session.snapshot();

    expect(snapshot).toMatchObject({ tick: 1, revision: 1, phase: "live" });
    expect(JSON.stringify(snapshot)).not.toMatch(/seed|internal|reward/i);
    expect(snapshot.publicState.score).toEqual({ home: 1, away: 0 });
  });
});
