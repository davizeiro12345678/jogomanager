/**
 * Plausibility limits for synced careers. A save that breaks them is still kept
 * as the player's personal save, but it can never be attested and the account
 * receives a risk signal for review.
 */
import type { CareerState } from "@/game/types";

type Shape = Pick<CareerState, "season" | "results" | "trophies" | "finances" | "matchLog" | "clubId">;

export const PLAUSIBILITY = {
  /** Goals one club can score in a single match. */
  maxGoalsPerMatch: 15,
  /** Club budget ceiling in millions. */
  maxBudget: 5000,
  /** Trophies a club can win per season (league, cups, continental, super cups). */
  maxTrophiesPerSeason: 6,
  /** Fastest the game can play one match, in seconds, even when auto-simulating. */
  minSecondsPerMatch: 0.5,
  /** Fastest a season can pass, in minutes. */
  minMinutesPerSeason: 2,
} as const;

export type PlausibilityIssue = "goals" | "budget" | "trophies" | "match_pace" | "season_pace";

export function plausibilityIssues(previous: Shape | null, next: Shape, elapsedMs: number | null): PlausibilityIssue[] {
  const issues: PlausibilityIssue[] = [];
  const goals = (next.matchLog ?? []).some((m) => m.gf > PLAUSIBILITY.maxGoalsPerMatch || m.ga > PLAUSIBILITY.maxGoalsPerMatch);
  if (goals || next.results.some((r) => r.hg > PLAUSIBILITY.maxGoalsPerMatch || r.ag > PLAUSIBILITY.maxGoalsPerMatch))
    issues.push("goals");
  if ((next.finances?.budget ?? 0) > PLAUSIBILITY.maxBudget) issues.push("budget");
  if (next.trophies.length > Math.max(1, next.season) * PLAUSIBILITY.maxTrophiesPerSeason) issues.push("trophies");
  if (previous && elapsedMs !== null && elapsedMs >= 0) {
    const seconds = elapsedMs / 1000;
    const newMatches = Math.max(0, (next.matchLog?.length ?? 0) - (previous.matchLog?.length ?? 0));
    if (newMatches > 5 && seconds < newMatches * PLAUSIBILITY.minSecondsPerMatch) issues.push("match_pace");
    const newSeasons = Math.max(0, next.season - previous.season);
    if (newSeasons > 0 && seconds < newSeasons * PLAUSIBILITY.minMinutesPerSeason * 60) issues.push("season_pace");
  }
  return issues;
}

