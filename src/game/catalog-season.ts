import { getLeague } from "./data/leagues";
import { pyramidTiers, leagueClubIds } from "./pyramid";
import { sameClub } from "./competition-season";
import { calendarYear } from "./competition-regulations";
import type { CareerState } from "./types";

/** Apply the new field only between seasons, preserving the manager and earned moves. */
export function updatedSeasonComposition(
  state: CareerState,
  proposed: Record<string, string[]> | undefined,
  nextLeagueId: string,
  earned: string[] = [],
): Record<string, string[]> | undefined {
  if (!state.catalogCalendarPending) return proposed;
  const ids = [...new Set(pyramidTiers(nextLeagueId)?.flat() ?? [nextLeagueId])];
  const protectedIds = new Set([state.clubId, ...earned]);
  const capacities = Object.fromEntries(
    ids.map((id) => [
      id,
      id === "bra3"
        ? getLeague(id).clubs.length +
          4 * Math.max(0, Math.min(2028, calendarYear(state) + 1) - 2026)
        : getLeague(id).clubs.length,
    ]),
  );
  const assigned: string[] = [];
  const next = { ...proposed };
  const spill: string[] = [];
  // Handle the manager's destination first so an old catalog alias cannot remove them.
  const order = [nextLeagueId, ...ids.filter((id) => id !== nextLeagueId)];
  for (const id of order) {
    const candidates = [...(proposed?.[id] ?? leagueClubIds(state, id))];
    if (id === nextLeagueId && !candidates.includes(state.clubId)) candidates.unshift(state.clubId);
    const valid = candidates
      .filter((club) => !assigned.some((other) => sameClub(club, other)))
      .sort((a, b) => Number(protectedIds.has(b)) - Number(protectedIds.has(a)));
    const unique: string[] = [];
    for (const club of valid) if (!unique.some((other) => sameClub(club, other))) unique.push(club);
    next[id] = unique.slice(0, capacities[id]);
    assigned.push(...next[id]!);
    spill.push(...unique.slice(capacities[id]));
  }
  const all = ids.flatMap((id) => getLeague(id).clubs.map((c) => c.id));
  for (const id of order) {
    const preferred = getLeague(id).clubs.map((c) => c.id);
    for (const candidate of [...preferred, ...spill, ...all]) {
      if (next[id]!.length >= capacities[id]!) break;
      if (assigned.some((other) => sameClub(candidate, other))) continue;
      next[id]!.push(candidate);
      assigned.push(candidate);
    }
  }
  return next;
}
