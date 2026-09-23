import { describe, expect, it } from "vitest";

import {
  MATCH_PROTOCOL_VERSION,
  assertCurrentTicket,
  parseMatchCommandV1,
  parseMatchReceiptV1,
  parseMatchSnapshotV1,
  parseMatchTicketV1,
} from "./match-protocol";

const roomId = "45fd1d08-4f81-44bc-9072-1e35ce9d1d94";
const userId = "7b40bcbe-a4ca-430c-9b49-61aa9c5118e9";

function ticket(overrides: Record<string, unknown> = {}) {
  return {
    version: MATCH_PROTOCOL_VERSION,
    roomId,
    userId,
    seat: "home",
    issuedAt: 1_700_000_000_000,
    expiresAt: 1_700_000_060_000,
    nonce: "eW91LWNhbi10cnVzdC10aGUtY2xpZW50",
    signature: "server-signed-ticket-v1",
    ...overrides,
  };
}

describe("Match protocol V1", () => {
  it("accepts a ticket only when its version, claims, nonce and signature are explicit", () => {
    const parsed = parseMatchTicketV1(ticket());

    expect(parsed).toMatchObject({
      version: 1,
      roomId,
      userId,
      seat: "home",
    });
  });

  it("rejects an expired ticket before a session can be joined", () => {
    const parsed = parseMatchTicketV1(ticket({ expiresAt: 1_700_000_000_001 }));

    expect(() => assertCurrentTicket(parsed, 1_700_000_000_002)).toThrow(/expired/i);
  });

  it("rejects a ticket with an incompatible protocol version", () => {
    expect(() => parseMatchTicketV1(ticket({ version: 2 }))).toThrow();
  });

  it("allows only explicit, monotonically sequenced commands", () => {
    const parsed = parseMatchCommandV1({
      version: MATCH_PROTOCOL_VERSION,
      roomId,
      sequence: 3,
      kind: "set_tactics",
      payload: {
        formation: "4-3-3",
        mentality: "balanced",
        pressing: "high",
        width: "wide",
        tempo: "fast",
        lineHeight: "high",
      },
    });

    expect(parsed).toMatchObject({ sequence: 3, kind: "set_tactics" });
  });

  it.each([
    { sequence: 0 },
    { sequence: -1 },
    { kind: "set_tactics", payload: { seed: "client-seed" } },
    { kind: "ready", payload: { ready: true, score: { home: 99, away: 0 } } },
    { kind: "forfeit", payload: { confirmed: true, state: { winner: "home" } } },
  ])("rejects client authority fields and invalid sequence: %o", (override) => {
    expect(() =>
      parseMatchCommandV1({
        version: MATCH_PROTOCOL_VERSION,
        roomId,
        sequence: 1,
        kind: "ready",
        payload: { ready: true },
        ...override,
      }),
    ).toThrow();
  });

  it("accepts public presentation snapshots but rejects private simulation data", () => {
    const snapshot = parseMatchSnapshotV1({
      version: MATCH_PROTOCOL_VERSION,
      roomId,
      tick: 1_200,
      revision: 9,
      phase: "live",
      publicState: {
        minute: 23,
        score: { home: 1, away: 0 },
        possession: { home: 55, away: 45 },
      },
      presentationEvents: [{ id: "goal-1200", type: "goal", tick: 1_200, team: "home" }],
    });

    expect(snapshot.publicState.score).toEqual({ home: 1, away: 0 });
    expect(() =>
      parseMatchSnapshotV1({
        ...snapshot,
        publicState: { ...snapshot.publicState, seed: "secret" },
      }),
    ).toThrow();
  });

  it("accepts only a signed, idempotent receipt with a server result", () => {
    const receipt = parseMatchReceiptV1({
      version: MATCH_PROTOCOL_VERSION,
      roomId,
      simulationVersion: "match-sim/1",
      commandHash: "a".repeat(64),
      result: { homeGoals: 2, awayGoals: 1, winner: "home" },
      closureReason: "completed",
      idempotencyKey: "42711d45-34a3-4d6b-81bb-a67db8b7e4f0",
      issuedAt: 1_700_000_060_000,
      signature: "server-signed-receipt-v1",
    });

    expect(receipt.result.winner).toBe("home");
    expect(() => parseMatchReceiptV1({ ...receipt, result: { homeGoals: -1 } })).toThrow();
  });
});
