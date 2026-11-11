/**
 * Deterministic server-side queue policy. The database owns account identity,
 * rating, queue leases and matchmaking transactions; browsers cannot supply
 * or modify those values through this module.
 */
export type QueueMode = "casual" | "ranked" | "friendly" | "tournament";
export type MatchRegion = "sa" | "na" | "eu" | "apac";

export interface QueuePlayer {
  userId: string;
  mode: QueueMode;
  region: MatchRegion;
  rating: number;
  joinedAt: number;
  blockedUsers?: readonly string[];
  recentOpponents?: readonly string[];
}

export interface QueuePair {
  first: QueuePlayer;
  second: QueuePlayer;
  combinedWaitMs: number;
  ratingGap: number;
  crossRegion: boolean;
}

const MAX_WAIT_MS = 5 * 60_000;
const CROSS_REGION_AFTER_MS = 90_000;
const AVOID_REMATCH_MS = 120_000;
const RANKED_BASE_GAP = 80;
const MAX_RANKED_GAP = 450;

function waitingMs(p: QueuePlayer, now: number): number {
  return Math.max(0, Math.min(MAX_WAIT_MS, now - p.joinedAt));
}

function blocked(a: QueuePlayer, b: QueuePlayer): boolean {
  return (
    a.blockedUsers?.includes(b.userId) === true ||
    b.blockedUsers?.includes(a.userId) === true
  );
}

function rematch(a: QueuePlayer, b: QueuePlayer): boolean {
  return (
    a.recentOpponents?.includes(b.userId) === true ||
    b.recentOpponents?.includes(a.userId) === true
  );
}

function valid(p: QueuePlayer, now: number): boolean {
  return (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      p.userId,
    ) &&
    ["casual", "ranked", "friendly", "tournament"].includes(p.mode) &&
    ["sa", "na", "eu", "apac"].includes(p.region) &&
    Number.isSafeInteger(p.rating) &&
    p.rating >= 0 &&
    p.rating <= 5000 &&
    Number.isSafeInteger(p.joinedAt) &&
    p.joinedAt <= now &&
    p.joinedAt >= now - MAX_WAIT_MS
  );
}

function canPair(a: QueuePlayer, b: QueuePlayer, now: number): boolean {
  if (!valid(a, now) || !valid(b, now)) return false;
  if (a.userId === b.userId || a.mode !== b.mode || blocked(a, b)) return false;
  if (a.mode === "friendly" || a.mode === "tournament") {
    // Invitation/competition seats must be explicitly bound by the backend,
    // never silently paired from a public pool.
    return false;
  }
  const wait = Math.min(waitingMs(a, now), waitingMs(b, now));
  if (a.region !== b.region && wait < CROSS_REGION_AFTER_MS) return false;
  if (rematch(a, b) && wait < AVOID_REMATCH_MS) return false;
  if (a.mode === "ranked") {
    const gap = Math.abs(a.rating - b.rating);
    const tolerance = Math.min(MAX_RANKED_GAP, RANKED_BASE_GAP + Math.floor(wait / 10_000) * 20);
    if (gap > tolerance) return false;
  }
  return true;
}

/**
 * Fair, predictable candidate selection. Ranking uses the oldest eligible
 * player first, then minimum rating gap, then stable user ID to break ties.
 * This must run under a database lease/transaction, not in a browser.
 */
export function selectQueuePair(entries: readonly QueuePlayer[], now: number): QueuePair | null {
  if (!Number.isSafeInteger(now) || now < 0) return null;
  const queue = entries
    .filter((p) => valid(p, now))
    .slice()
    .sort((a, b) => a.joinedAt - b.joinedAt || a.userId.localeCompare(b.userId));

  for (let i = 0; i < queue.length; i += 1) {
    const first = queue[i]!;
    const matches = queue
      .slice(i + 1)
      .filter((second) => canPair(first, second, now))
      .sort(
        (a, b) =>
          Number(first.region !== a.region) - Number(first.region !== b.region) ||
          Math.abs(first.rating - a.rating) - Math.abs(first.rating - b.rating) ||
          a.joinedAt - b.joinedAt ||
          a.userId.localeCompare(b.userId),
      );
    const second = matches[0];
    if (!second) continue;
    return {
      first,
      second,
      combinedWaitMs: waitingMs(first, now) + waitingMs(second, now),
      ratingGap: Math.abs(first.rating - second.rating),
      crossRegion: first.region !== second.region,
    };
  }
  return null;
}
