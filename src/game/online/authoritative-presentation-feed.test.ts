import { describe, expect, it } from "vitest";
import { AuthoritativePresentationFeed } from "./authoritative-presentation-feed";

const room = "45fd1d08-4f81-44bc-9072-1e35ce9d1d94";
const strangerRoom = "7008a399-62df-4d47-a314-0c2eb2d4c4c5";
const frame = (body: object) => JSON.stringify({ version: 1, ...body });
const snapshot = (
  revision: number,
  tick: number,
  score = { home: 0, away: 0 },
  phase: "waiting" | "live" | "reconnecting" | "finalized" = "live",
) => ({
  version: 1,
  roomId: room,
  revision,
  tick,
  phase,
  publicState: { minute: Math.floor(tick / 30), score, possession: { home: 50, away: 50 } },
  presentationEvents: [],
});
const receipt = {
  version: 1,
  roomId: room,
  simulationVersion: "contact-2",
  commandHash: "a".repeat(64),
  idempotencyKey: "42711d45-34a3-4d6b-81bb-a67db8b7e4f0",
  issuedAt: 1_700_000_050_000,
  closureReason: "completed",
  result: { homeGoals: 2, awayGoals: 1, winner: "home" },
  signature: "valid-format-does-not-prove-HMAC",
};

describe("browser-side authoritative presentation reducer", () => {
  it("accepts only a server-shaped ready state for the intended match and seat", () => {
    const feed = new AuthoritativePresentationFeed(room);
    const event = feed.accept(frame({ type: "ready", seat: "home", snapshot: snapshot(1, 1) }));
    expect(event.kind).toBe("ready");
    expect(feed.confirmedSeat()).toBe("home");
    expect(feed.snapshot()?.publicState.score).toEqual({ home: 0, away: 0 });
    expect(feed.accept(frame({ type: "ready", seat: "away", snapshot: snapshot(2, 2) }))).toEqual({
      kind: "ignored",
      reason: "conflict",
    });
    expect(feed.confirmedSeat()).toBe("home");
  });

  it("rejects room-hopping frames, browser seeds and unknown presentation fields", () => {
    const feed = new AuthoritativePresentationFeed(room);
    expect(
      feed.accept(frame({ type: "snapshot", snapshot: { ...snapshot(1, 1), roomId: strangerRoom } })),
    ).toEqual({ kind: "ignored", reason: "foreign_room" });
    expect(
      feed.accept(
        frame({
          type: "snapshot",
          snapshot: { ...snapshot(1, 1), seed: "private-server-secret" },
        }),
      ),
    ).toEqual({ kind: "ignored", reason: "malformed" });
    expect(feed.snapshot()).toBeNull();
  });

  it("never rolls the scoreboard back across reconnect, duplicate or conflicting revisions", () => {
    const feed = new AuthoritativePresentationFeed(room);
    const first = snapshot(2, 10, { home: 1, away: 0 });
    expect(feed.accept(frame({ type: "snapshot", snapshot: first })).kind).toBe("snapshot");
    expect(feed.accept(frame({ type: "snapshot", snapshot: first }))).toEqual({
      kind: "ignored",
      reason: "stale",
    });
    expect(
      feed.accept(
        frame({ type: "snapshot", snapshot: snapshot(2, 10, { home: 7, away: 0 }) }),
      ),
    ).toEqual({ kind: "ignored", reason: "conflict" });
    expect(feed.accept(frame({ type: "snapshot", snapshot: snapshot(1, 9) }))).toEqual({
      kind: "ignored",
      reason: "stale",
    });
    expect(feed.accept(frame({ type: "snapshot", snapshot: snapshot(3, 9) }))).toEqual({
      kind: "ignored",
      reason: "stale",
    });
    expect(feed.snapshot()?.publicState.score.home).toBe(1);
  });

  it("rejects impossible event time and a finalized phase regression", () => {
    const feed = new AuthoritativePresentationFeed(room);
    const bad = {
      ...snapshot(1, 2),
      presentationEvents: [{ id: "future", type: "goal", tick: 3, team: "home" }],
    };
    expect(feed.accept(frame({ type: "snapshot", snapshot: bad })).kind).toBe("ignored");
    expect(
      feed.accept(frame({ type: "snapshot", snapshot: snapshot(4, 120, { home: 1, away: 0 }, "finalized") }))
        .kind,
    ).toBe("snapshot");
    expect(feed.accept(frame({ type: "snapshot", snapshot: snapshot(5, 121) }))).toEqual({
      kind: "ignored",
      reason: "stale",
    });
  });

  it("accepts a bounded forward progression and does not expose mutable state", () => {
    const feed = new AuthoritativePresentationFeed(room);
    expect(feed.accept(frame({ type: "snapshot", snapshot: snapshot(1, 10) })).kind).toBe("snapshot");
    expect(
      feed.accept(frame({ type: "snapshot", snapshot: snapshot(2, 40, { home: 2, away: 1 }) }))
        .kind,
    ).toBe("snapshot");
    const copy = feed.snapshot()!;
    copy.publicState.score.home = 99;
    expect(feed.snapshot()?.publicState.score).toEqual({ home: 2, away: 1 });
  });

  it("fences one terminal receipt and refuses a second result or later snapshot", () => {
    const feed = new AuthoritativePresentationFeed(room);
    feed.accept(frame({ type: "snapshot", snapshot: snapshot(1, 2) }));
    expect(feed.accept(frame({ type: "final", receipt })).kind).toBe("final");
    expect(feed.accept(frame({ type: "final", receipt }))).toEqual({
      kind: "ignored",
      reason: "stale",
    });
    expect(
      feed.accept(
        frame({
          type: "final",
          receipt: { ...receipt, result: { homeGoals: 9, awayGoals: 0, winner: "home" } },
        }),
      ),
    ).toEqual({ kind: "ignored", reason: "conflict" });
    expect(
      feed.accept(frame({ type: "snapshot", snapshot: snapshot(5, 100) })),
    ).toEqual({ kind: "ignored", reason: "stale" });
    expect(feed.receipt()?.result.homeGoals).toBe(2);
  });

  it("rejects a foreign or malformed final receipt before it becomes official", () => {
    const feed = new AuthoritativePresentationFeed(room);
    expect(feed.accept(frame({ type: "final", receipt: { ...receipt, roomId: strangerRoom } }))).toEqual({
      kind: "ignored",
      reason: "foreign_room",
    });
    expect(feed.accept(frame({ type: "final", receipt: { ...receipt, signature: "" } }))).toEqual({
      kind: "ignored",
      reason: "malformed",
    });
    expect(feed.receipt()).toBeNull();
  });

  it("bounded ACK/NACK progression drops replay and invalid version", () => {
    const feed = new AuthoritativePresentationFeed(room);
    expect(feed.accept(frame({ type: "ack", sequence: 3 }))).toEqual({
      kind: "ack",
      sequence: 3,
    });
    expect(feed.accept(frame({ type: "nack", sequence: 3, reason: "rate_limited" }))).toEqual({
      kind: "ignored",
      reason: "stale",
    });
    expect(feed.accept(frame({ type: "nack", sequence: 4, reason: "command_rejected" }))).toEqual({
      kind: "nack",
      sequence: 4,
      reason: "command_rejected",
    });
    expect(feed.accept(JSON.stringify({ type: "pong", version: 5 }))).toEqual({
      kind: "ignored",
      reason: "malformed",
    });
    expect(feed.accept(frame({ type: "pong" }))).toEqual({ kind: "pong" });
  });

  it("discards oversized frames, unsupported envelopes and malformed JSON", () => {
    const feed = new AuthoritativePresentationFeed(room);
    expect(feed.accept("x".repeat(100_000))).toEqual({
      kind: "ignored",
      reason: "malformed",
    });
    expect(feed.accept(new Uint8Array([1, 2, 3]))).toEqual({
      kind: "ignored",
      reason: "malformed",
    });
    expect(feed.accept("{")).toEqual({ kind: "ignored", reason: "malformed" });
    expect(feed.accept(frame({ type: "snapshot", snapshot: snapshot(1, 1), score: "forged" }))).toEqual({
      kind: "ignored",
      reason: "malformed",
    });
    expect(feed.snapshot()).toBeNull();
  });
});
