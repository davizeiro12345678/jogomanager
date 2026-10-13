import type { CareerState } from "@/game/types";

/** Minimum real time per simulated round; faster progress cannot be attested. */
const MIN_MS_PER_ROUND = 15_000;

type ProgressShape = Pick<CareerState, "leagueId" | "clubId" | "managerName" | "season" | "round" | "results">;

export function sameCareer(a: ProgressShape, b: ProgressShape): boolean {
  return a.leagueId === b.leagueId && a.clubId === b.clubId && a.managerName === b.managerName;
}

/** Monotonic progress score: season, then round, then results played. */
export function progressScore(s: ProgressShape): number {
  return s.season * 1_000_000 + s.round * 1_000 + Math.min(999, s.results?.length ?? 0);
}

/** True when `next` would replace newer progress of the same career. */
export function isStaleSave(stored: ProgressShape, next: ProgressShape): boolean {
  return sameCareer(stored, next) && progressScore(next) < progressScore(stored);
}

const resultKey = (r: CareerState["results"][number]) => `${r.round}:${r.home}:${r.away}:${r.hg}:${r.ag}`;

/**
 * Extends attestation from a verified save to its legitimate continuation:
 * same identity, append-only results within a season, one season at a time,
 * and progress no faster than real time allows.
 */
export function continuesVerifiedCareer(prev: CareerState, next: CareerState, elapsedMs: number): boolean {
  if (!sameCareer(prev, next)) return false;
  if (!Array.isArray(next.results) || !Array.isArray(next.history)) return false;
  const roundsAdvanced =
    next.season === prev.season
      ? next.round - prev.round
      : next.season === prev.season + 1
        ? next.round
        : -1;
  if (roundsAdvanced < 0) return false;
  if (roundsAdvanced > 1 + Math.floor(Math.max(0, elapsedMs) / MIN_MS_PER_ROUND)) return false;
  if (next.season === prev.season) {
    if (next.results.length < prev.results.length) return false;
    if (next.history.length !== prev.history.length) return false;
    for (let i = 0; i < prev.results.length; i++) {
      if (resultKey(prev.results[i]!) !== resultKey(next.results[i]!)) return false;
    }
  } else if (next.history.length !== prev.history.length + 1) {
    return false;
  }
  for (const r of next.results) {
    if (!Number.isInteger(r.hg) || !Number.isInteger(r.ag) || r.hg < 0 || r.ag < 0 || r.hg > 20 || r.ag > 20)
      return false;
  }
  // Value-bearing fields must be structurally consistent, not caller-invented:
  // every result must correspond to a real scheduled fixture of a completed
  // round, with no duplicates, and trophies/history must stay coherent.
  if (Array.isArray(next.fixtures) && next.fixtures.length > 0) {
    const scheduled = new Set<string>();
    for (const f of next.fixtures) {
      if (f && typeof f.round === "number") scheduled.add(`${f.round}:${f.home}:${f.away}`);
    }
    const seen = new Set<string>();
    for (const r of next.results) {
      const key = `${r.round}:${r.home}:${r.away}`;
      if (!scheduled.has(key)) return false; // result for a match that was never scheduled
      if (seen.has(key)) return false; // duplicated fixture result
      seen.add(key);
      if (r.round >= next.round) return false; // result for a round not yet played
    }
  }
  if (Array.isArray(next.trophies)) {
    // Trophies only exist after a completed season; they can never exceed
    // the number of finished seasons plus the competitions of the current one.
    const maxTrophies = next.history.length * 4 + 4;
    if (next.trophies.length > maxTrophies) return false;
  }
  return true;
}
