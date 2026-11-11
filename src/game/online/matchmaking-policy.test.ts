import { describe, expect, it } from "vitest";
import { selectQueuePair, type QueuePlayer } from "./matchmaking-policy";

const now = 1_700_000_200_000;
const user = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
function make(n: number, extra: Partial<QueuePlayer> = {}): QueuePlayer {
  return {
    userId: user(n),
    mode: "ranked",
    region: "sa",
    rating: 1400,
    joinedAt: now - 15_000,
    ...extra,
  };
}

describe("fair matchmaking", () => {
  it("keeps public queues separate from private and tournament queues", () => {
    expect(selectQueuePair([make(1), make(2, { mode: "friendly" })], now)).toBeNull();
    expect(selectQueuePair([make(1), make(2, { mode: "tournament" })], now)).toBeNull();
    expect(selectQueuePair([make(1), make(2, { mode: "casual" })], now)).toBeNull();
  });

  it("matches a compatible ranked pair without trusting a score submitted by the browser", () => {
    const found = selectQueuePair([make(1), make(2, { rating: 1430 })], now);
    expect(found?.ratingGap).toBe(30);
    expect(found?.crossRegion).toBe(false);
  });

  it("prefers the oldest eligible waiting player and nearest opponent", () => {
    const oldest = make(1, { joinedAt: now - 20_000 });
    const slightlyNewer = make(2, { joinedAt: now - 12_000, rating: 1410 });
    const other = make(3, { joinedAt: now - 14_000, rating: 1440 });
    const pair = selectQueuePair([other, slightlyNewer, oldest], now);
    expect(pair?.first.userId).toBe(oldest.userId);
    expect(pair?.second.userId).toBe(slightlyNewer.userId);
  });

  it("prevents blocked players from being paired", () => {
    expect(
      selectQueuePair([make(1, { blockedUsers: [user(2)] }), make(2)], now),
    ).toBeNull();
  });

  it("requires a long wait for cross-region or immediate rematches", () => {
    expect(selectQueuePair([
      make(1, { region: "sa" }),
      make(2, { region: "eu" }),
    ], now)).toBeNull();
    expect(selectQueuePair([
      make(1, { joinedAt: now - 100_000, region: "sa" }),
      make(2, { joinedAt: now - 100_000, region: "eu" }),
    ], now)?.crossRegion).toBe(true);
    expect(selectQueuePair([
      make(1, { recentOpponents: [user(2)] }),
      make(2),
    ], now)).toBeNull();
  });

  it("does not pair vast rating differences immediately", () => {
    expect(selectQueuePair([make(1), make(2, { rating: 2000 })], now)).toBeNull();
    expect(selectQueuePair([
      make(1, { joinedAt: now - 120_000 }),
      make(2, { rating: 1650, joinedAt: now - 120_000 }),
    ], now)).not.toBeNull();
  });

  it("rejects malformed identities, future timestamps and impossible ratings", () => {
    expect(selectQueuePair([make(1), make(2, { userId: "not-a-user" })], now)).toBeNull();
    expect(selectQueuePair([make(1), make(2, { joinedAt: now + 1 })], now)).toBeNull();
    expect(selectQueuePair([make(1), make(2, { rating: 1e99 })], now)).toBeNull();
  });

  it("keeps output stable regardless of queue enumeration order", () => {
    const players = [make(3, { rating: 1435 }), make(1), make(2, { rating: 1405 })];
    const a = selectQueuePair(players, now);
    const b = selectQueuePair([...players].reverse(), now);
    expect(a).toEqual(b);
  });
});
