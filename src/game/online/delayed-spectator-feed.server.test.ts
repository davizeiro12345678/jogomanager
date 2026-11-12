import { describe, expect, it } from "vitest";
import { DelayedSpectatorFeed } from "./delayed-spectator-feed.server";

const roomId = "45fd1d08-4f81-44bc-9072-1e35ce9d1d94";
const otherRoom = "b9e1829a-409a-4885-a149-a4f2a003318f";
const start = 1_700_000_000_000;
const snapshot = (revision: number, score = { home: 0, away: 0 }) => ({
  version: 1 as const,
  roomId,
  revision,
  tick: revision,
  phase: "live" as const,
  publicState: {
    minute: 0,
    score,
    possession: { home: 50, away: 50 },
  },
  presentationEvents: [],
});

describe("anti-stream-sniping spectator delay", () => {
  it("never reveals the live score before the fixed server delay", () => {
    const feed = new DelayedSpectatorFeed(roomId, 30_000);
    expect(feed.push(snapshot(1), start)).toBe(true);
    expect(feed.push(snapshot(2, { home: 1, away: 0 }), start + 1_000)).toBe(true);
    expect(feed.poll(start + 29_999)).toBeNull();
    expect(feed.replayLastReleased()).toBeNull();
    expect(feed.poll(start + 30_000)?.revision).toBe(1);
    expect(feed.poll(start + 30_999)).toBeNull();
    expect(feed.poll(start + 31_000)?.publicState.score.home).toBe(1);
    expect(feed.poll(start + 60_000)).toBeNull();
  });

  it("does not accept cross-room, duplicate, backwards or private frames", () => {
    const feed = new DelayedSpectatorFeed(roomId);
    expect(feed.push({ ...snapshot(1), roomId: otherRoom }, start)).toBe(false);
    expect(feed.push(snapshot(2), start)).toBe(true);
    expect(feed.push(snapshot(2), start + 1)).toBe(false);
    expect(feed.push(snapshot(1), start + 2)).toBe(false);
    expect(feed.push({ ...snapshot(3), seed: "private" }, start + 3)).toBe(false);
    expect(feed.size()).toBe(1);
  });

  it("bounds queued frames and releases only the newest eligible frame", () => {
    const feed = new DelayedSpectatorFeed(roomId, 10_000, 3);
    for (let i = 1; i <= 10; i += 1) expect(feed.push(snapshot(i), start + i)).toBe(true);
    expect(feed.size()).toBe(3);
    expect(feed.poll(start + 10_009)?.revision).toBe(9);
    expect(feed.poll(start + 10_010)?.revision).toBe(10);
    expect(feed.replayLastReleased()?.revision).toBe(10);
  });

  it("returns detached public snapshots and resets state on room disposal", () => {
    const feed = new DelayedSpectatorFeed(roomId);
    expect(feed.push(snapshot(1), start)).toBe(true);
    const released = feed.poll(start + 30_000)!;
    released.publicState.score.home = 99;
    expect(feed.replayLastReleased()?.publicState.score.home).toBe(0);
    feed.clear();
    expect(feed.replayLastReleased()).toBeNull();
    expect(feed.size()).toBe(0);
  });

  it("requires meaningful delay and does not accept unsafe timestamps", () => {
    expect(() => new DelayedSpectatorFeed(roomId, 9_999)).toThrow();
    expect(() => new DelayedSpectatorFeed(roomId, 300_001)).toThrow();
    const feed = new DelayedSpectatorFeed(roomId);
    expect(feed.push(snapshot(1), Number.MAX_SAFE_INTEGER)).toBe(false);
    expect(feed.push(snapshot(1), Number.NaN)).toBe(false);
    expect(feed.poll(Number.POSITIVE_INFINITY)).toBeNull();
  });
});
