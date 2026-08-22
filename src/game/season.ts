import { getLeague } from "./data/leagues";
import { makeRng } from "./rng";
import type { CareerState, Fixture, TableRow } from "./types";

export function generateFixtures(leagueId: string, seed: string): Fixture[] {
  const clubs = getLeague(leagueId).clubs.map((c) => c.id);
  const rnd = makeRng(`fix-${seed}`);
  const list = [...clubs];
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [list[i], list[j]] = [list[j]!, list[i]!];
  }

  const n = list.length;
  const rounds: Fixture[] = [];
  const rotation = [...list];
  const half = n / 2;

  for (let r = 0; r < n - 1; r++) {
    for (let i = 0; i < half; i++) {
      const a = rotation[i]!;
      const b = rotation[n - 1 - i]!;
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

  return [...first, ...second];
}

export function computeTable(state: CareerState): TableRow[] {
  const clubs = getLeague(state.leagueId).clubs;
  const rows: Record<string, TableRow> = {};
  clubs.forEach((c) => {
    rows[c.id] = { clubId: c.id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 };
  });

  for (const f of state.fixtures) {
    if (f.homeGoals === null || f.awayGoals === null) continue;
    const h = rows[f.home];
    const a = rows[f.away];
    if (!h || !a) continue;
    h.p++;
    a.p++;
    h.gf += f.homeGoals;
    h.ga += f.awayGoals;
    a.gf += f.awayGoals;
    a.ga += f.homeGoals;
    if (f.homeGoals > f.awayGoals) {
      h.w++;
      h.pts += 3;
      a.l++;
    } else if (f.homeGoals < f.awayGoals) {
      a.w++;
      a.pts += 3;
      h.l++;
    } else {
      h.d++;
      a.d++;
      h.pts++;
      a.pts++;
    }
  }

  return Object.values(rows).sort(
    (x, y) => y.pts - x.pts || y.gf - y.ga - (x.gf - x.ga) || y.gf - x.gf,
  );
}

export function nextFixture(state: CareerState): Fixture | undefined {
  return state.fixtures.find(
    (f) => f.round === state.round && (f.home === state.clubId || f.away === state.clubId),
  );
}

export function roundFixtures(state: CareerState, round: number): Fixture[] {
  return state.fixtures.filter((f) => f.round === round);
}
