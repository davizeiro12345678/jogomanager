import { getLeague } from "./data/leagues";
import { leagueClubIds } from "./pyramid";
import { makeRng } from "./rng";
import type { CareerState, Fixture, TableRow } from "./types";
import { tableFromFixtures } from "./standings";

/** marcador de folga usado quando a divisão tem número ímpar de clubes */
const BYE = "__bye__";

export function generateFixtures(leagueId: string, seed: string, clubIds?: string[]): Fixture[] {
  const rotation = clubIds?.length ? [...clubIds] : getLeague(leagueId).clubs.map((c) => c.id);
  const rnd = makeRng(`fix-${seed}`);
  for (let i = rotation.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [rotation[i], rotation[j]] = [rotation[j]!, rotation[i]!];
  }
  // número ímpar de clubes: um time folga a cada rodada
  if (rotation.length % 2 === 1) rotation.push(BYE);

  const n = rotation.length;
  const clubs = rotation.reduce((count, id) => count + Number(id !== BYE), 0);
  const firstLegLength = (clubs * (clubs - 1)) / 2;
  const singleLeg = leagueId === "x5686";
  const rounds = new Array<Fixture>(firstLegLength * (singleLeg ? 1 : 2));
  const half = n / 2;
  let index = 0;

  for (let r = 0; r < n - 1; r++) {
    for (let i = 0; i < half; i++) {
      const a = rotation[i]!;
      const b = rotation[n - 1 - i]!;
      if (a === BYE || b === BYE) continue;
      const homeFirst = (r + i) % 2 === 0;
      const home = homeFirst ? a : b;
      const away = homeFirst ? b : a;
      rounds[index] = {
        round: r + 1,
        home,
        away,
        homeGoals: null,
        awayGoals: null,
      };
      // Write the return leg at its final offset: no growing arrays or second
      // traversal, while keeping the complete original round/fixture order.
      if (!singleLeg)
        rounds[index + firstLegLength] = {
          round: r + n,
          home: away,
          away: home,
          homeGoals: null,
          awayGoals: null,
        };
      index++;
    }
    const last = rotation[n - 1]!;
    for (let i = n - 1; i > 1; i--) rotation[i] = rotation[i - 1]!;
    rotation[1] = last;
  }

  return rounds;
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
