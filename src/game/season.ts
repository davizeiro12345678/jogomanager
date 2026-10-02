import { getLeague } from "./data/leagues";
import { leagueClubIds } from "./pyramid";
import { makeRng } from "./rng";
import type { CareerState, Fixture, TableRow } from "./types";
import { tableFromFixtures } from "./standings";

/** marcador de folga usado quando a divisão tem número ímpar de clubes */
const BYE = "__bye__";

export function generateFixtures(leagueId: string, seed: string, clubIds?: string[]): Fixture[] {
  const clubs = clubIds?.length ? [...clubIds] : getLeague(leagueId).clubs.map((c) => c.id);
  const rnd = makeRng(`fix-${seed}`);
  const list = [...clubs];
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [list[i], list[j]] = [list[j]!, list[i]!];
  }
  // número ímpar de clubes: um time folga a cada rodada
  if (list.length % 2 === 1) list.push(BYE);

  const n = list.length;
  const rounds: Fixture[] = [];
  const rotation = [...list];
  const half = n / 2;

  for (let r = 0; r < n - 1; r++) {
    for (let i = 0; i < half; i++) {
      const a = rotation[i]!;
      const b = rotation[n - 1 - i]!;
      if (a === BYE || b === BYE) continue;
      const homeFirst = (r + i) % 2 === 0;
      rounds.push({
        round: r + 1,
        home: homeFirst ? a : b,
        away: homeFirst ? b : a,
        homeGoals: null,
        awayGoals: null,
      });
    }
    const fixed = rotation[0]!;
    const rest = rotation.slice(1);
    rest.unshift(rest.pop()!);
    rotation.splice(0, rotation.length, fixed, ...rest);
  }

  const first = [...rounds];
  const second = first.map((f) => ({
    round: f.round + (n - 1),
    home: f.away,
    away: f.home,
    homeGoals: null,
    awayGoals: null,
  }));

  return leagueId === "x5686" ? first : [...first, ...second];
}

export function computeTable(state: CareerState): TableRow[] {
  return tableFromFixtures(leagueClubIds(state), state.fixtures, getLeague(state.leagueId).country);
}

export function nextFixture(state: CareerState): Fixture | undefined {
  return state.fixtures.find(
    (f) => f.round === state.round && (f.home === state.clubId || f.away === state.clubId),
  );
}

export function roundFixtures(state: CareerState, round: number): Fixture[] {
  return state.fixtures.filter((f) => f.round === round);
}
