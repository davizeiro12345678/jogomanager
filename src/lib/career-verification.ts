import type { CareerState } from "@/game/types";
import { CLUBS, getLeague } from "@/game/data/leagues";
import { initCareer } from "@/game/career/setup";
import { assertSafeJsonValue, record, textField } from "./import-validation";
// A newly started career has no result to attest. Offline/imported results
// remain personal saves, not trusted achievements or official progress.
function verifyInitialCareer(state: CareerState): boolean {
  if (state.season !== 1 || !CLUBS[state.clubId]) return false;
  const league = getLeague(state.leagueId);
  if (league.id !== state.leagueId || !league.clubs.some((club) => club.id === state.clubId))
    return false;
  const initial = initCareer(state.leagueId, state.clubId, state.managerName);
  if (state.fixtures.length !== initial.fixtures.length) return false;
  const byFixture = new Map(initial.fixtures.map((f) => [`${f.round}:${f.home}:${f.away}`, f]));
  if (
    state.round !== 1 ||
    state.results.length !== 0 ||
    !state.finances ||
    !Array.isArray(state.trophies) ||
    !Array.isArray(state.history) ||
    (state.matchLog !== undefined && !Array.isArray(state.matchLog))
  )
    return false;
  for (const fixture of state.fixtures) {
    const key = `${fixture.round}:${fixture.home}:${fixture.away}`;
    if (!byFixture.delete(key)) return false;
    if (fixture.homeGoals !== null || fixture.awayGoals !== null) return false;
  }
  return (
    byFixture.size === 0 &&
    state.finances.budget === initial.finances.budget &&
    state.finances.income === initial.finances.income &&
    state.finances.spent === initial.finances.spent &&
    state.trophies.length === 0 &&
    state.history.length === 0 &&
    (state.matchLog?.length ?? 0) === 0
  );
}

/** Personal JSON is never evidence of played matches. Reject malformed data without throwing. */
export function verifyCareerProgress(value: unknown): value is CareerState {
  try {
    assertSafeJsonValue(value);
    if (
      !record(value) ||
      !textField(value["clubId"], 80) ||
      !textField(value["leagueId"], 80) ||
      !textField(value["managerName"], 80) ||
      !Array.isArray(value["fixtures"]) ||
      !Array.isArray(value["results"])
    )
      return false;
    return verifyInitialCareer(value as unknown as CareerState);
  } catch {
    return false;
  }
}
