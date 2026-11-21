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
function paired(first: QueuePlayer, second: QueuePlayer) {
  return selectQueuePair([first, second], now);
}

describe("fair matchmaking", () => {
  it("keeps public queues separate from private and tournament queues", () => {
    expect(paired(make(1), make(2, { mode: "friendly" }))).toBeNull();
    expect(paired(make(1), make(2, { mode: "tournament" }))).toBeNull();
    expect(paired(make(1), make(2, { mode: "casual" }))).toBeNull();
  });

  it("matches a compatible ranked pair without trusting a score submitted by the browser", () => {
    const found = paired(make(1), make(2, { rating: 1430 }));
    expect(found?.ratingGap).toBe(30);
    expect(found?.crossRegion).toBe(false);
  });

  it("prefers the oldest eligible waiting player and nearest opponent", () => {
    const oldest = make(1, { joinedAt: now - 20_000 });
    const slightlyNewer = make(2, { joinedAt: now - 12_000, rating: 1410 });
    const other = make(3, { joinedAt: now - 14_000, rating: 1440 });
    const match = selectQueuePair([other, slightlyNewer, oldest], now);
    expect(match?.first.userId).toBe(oldest.userId);
    expect(match?.second.userId).toBe(slightlyNewer.userId);
  });

  it("prevents blocked players from being paired", () => {
    expect(paired(make(1, { blockedUsers: [user(2)] }), make(2))).toBeNull();
  });

  it("requires a long wait for cross-region or immediate rematches", () => {
    expect(paired(make(1, { region: "sa" }), make(2, { region: "eu" }))).toBeNull();
    const afterWait = paired(
      make(1, { joinedAt: now - 100_000, region: "sa" }),
      make(2, { joinedAt: now - 100_000, region: "eu" }),
    );
    expect(afterWait?.crossRegion).toBe(true);
    expect(paired(make(1, { recentOpponents: [user(2)] }), make(2))).toBeNull();
  });

  it("does not pair vast rating differences immediately", () => {
    expect(paired(make(1), make(2, { rating: 2000 }))).toBeNull();
    const afterWait = paired(
      make(1, { joinedAt: now - 120_000 }),
      make(2, { rating: 1650, joinedAt: now - 120_000 }),
    );
    expect(afterWait).not.toBeNull();
  });

  it("rejects malformed identities, future timestamps and impossible ratings", () => {
    expect(paired(make(1), make(2, { userId: "not-a-user" }))).toBeNull();
    expect(paired(make(1), make(2, { joinedAt: now + 1 }))).toBeNull();
    expect(paired(make(1), make(2, { rating: 1e99 }))).toBeNull();
  });

  it("keeps output stable regardless of queue enumeration order", () => {
    const players = [make(3, { rating: 1435 }), make(1), make(2, { rating: 1405 })];
    expect(selectQueuePair(players, now)).toEqual(selectQueuePair([...players].reverse(), now));
  });
});
