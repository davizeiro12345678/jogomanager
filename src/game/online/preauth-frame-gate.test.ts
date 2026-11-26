import { describe, expect, it } from "vitest";
import { AuthoritativePresentationFeed } from "./authoritative-presentation-feed";

const roomId = "45fd1d08-4f81-44bc-9072-1e35ce9d1d94";
const message = (input: object) => JSON.stringify({ version: 1, ...input });
const snapshot = {
  version: 1,
  roomId,
  revision: 1,
  tick: 1,
  phase: "live",
  publicState: { minute: 0, score: { home: 0, away: 0 }, possession: { home: 50, away: 50 } },
  presentationEvents: [],
};

describe("authoritative pre-auth frame gate", () => {
  it("accepts only the expected seat's ready handshake", () => {
    const feed = new AuthoritativePresentationFeed(roomId);
    feed.bindSeat("home");
    expect(feed.accept(message({ type: "ready", snapshot }), "authenticating")).toEqual({
      kind: "ignored",
      reason: "malformed",
    });
    expect(
      feed.accept(message({ type: "ready", seat: "away", snapshot }), "authenticating"),
    ).toEqual({
      kind: "ignored",
      reason: "seat_mismatch",
    });
    expect(
      feed.accept(message({ type: "ready", seat: "home", snapshot }), "authenticating"),
    ).toEqual({
      kind: "ready",
      seat: "home",
      snapshot,
    });
  });

  it("accepts a fully validated sequence negotiation for the bound seat", () => {
    const feed = new AuthoritativePresentationFeed(roomId);
    feed.bindSeat("home");
    expect(
      feed.accept(
        message({ type: "sequence_resume", roomId, seat: "home", sequence: 12 }),
        "authenticating",
      ),
    ).toEqual({ kind: "sequence_resume", seat: "home", sequence: 12 });
  });

  it("never accepts a provisional result, snapshot or command acknowledgement", () => {
    const feed = new AuthoritativePresentationFeed(roomId);
    for (const frame of [
      { type: "snapshot", snapshot },
      { type: "final" },
      { type: "ack", sequence: 1 },
      { type: "nack", sequence: 1 },
      { type: "pong" },
      { type: "command" },
    ]) {
      expect(feed.accept(message(frame), "authenticating")).toEqual({
        kind: "ignored",
        reason: "wrong_phase",
      });
    }
    expect(feed.snapshot()).toBeNull();
    expect(feed.receipt()).toBeNull();
  });

  it("rejects malformed, binary and oversized handshake frames", () => {
    const feed = new AuthoritativePresentationFeed(roomId);
    for (const raw of [
      null,
      new Uint8Array(3),
      "{bad",
      "null",
      "[]",
      "0",
      "x".repeat(65_537),
      message({ type: "ready", seat: "away", snapshot, padding: "é".repeat(33_000) }),
    ]) {
      expect(feed.accept(raw, "authenticating")).toEqual({ kind: "ignored", reason: "malformed" });
    }
  });
});
