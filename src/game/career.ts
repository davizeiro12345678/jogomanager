import { CLUBS } from "./data/leagues";
import { FORMATIONS } from "./formations";
import { makeRng } from "./rng";
import { generateFixtures } from "./season";
import { buildSquad } from "./squad";
import type { CareerState, FormationKey, Player, Position } from "./types";

export function pickLineup(players: Player[], formation: FormationKey) {
  const slots = FORMATIONS[formation];
  const available = [...players].sort((a, b) => b.ovr - a.ovr);
  const taken = new Set<string>();
  const lineup: string[] = [];

  for (const slot of slots) {
    const exact = available.find((p) => !taken.has(p.id) && p.pos === slot.pos);
    const fallback = available.find((p) => !taken.has(p.id) && p.pos !== "GK");
    const chosen = exact ?? fallback;
    if (chosen) {
      taken.add(chosen.id);
      lineup.push(chosen.id);
    }
  }

  const bench = available.filter((p) => !taken.has(p.id)).slice(0, 7).map((p) => p.id);
  return { lineup, bench };
}

export function initCareer(
  leagueId: string,
  clubId: string,
  managerName: string,
): CareerState {
  const squad = buildSquad(clubId);
  const formation: FormationKey = "4-3-3";
  const { lineup, bench } = pickLineup(squad, formation);

  return {
    version: 1,
    leagueId,
    clubId,
    managerName,
    round: 1,
    tactics: { formation, mentality: 2, pressing: 1, width: 1, tempo: 1 },
    lineup,
    bench,
    fixtures: generateFixtures(leagueId, `${clubId}-${managerName}`),
    players: Object.fromEntries(squad.map((p) => [p.id, p])),
    results: [],
  };
}

export function orderedPositions(): Position[] {
  return ["GK", "DF", "MF", "FW"];
}

/** Simulação rápida (sem 3D) para as outras partidas da rodada. */
export function quickSimulate(homeId: string, awayId: string, seed: string) {
  const rnd = makeRng(seed);
  const h = (CLUBS[homeId]?.strength ?? 70) + 4;
  const a = CLUBS[awayId]?.strength ?? 70;
  const diff = (h - a) / 10;
  const expH = Math.max(0.25, 1.35 + diff * 0.42);
  const expA = Math.max(0.2, 1.15 - diff * 0.42);
  return { hg: poisson(expH, rnd), ag: poisson(expA, rnd) };
}

function poisson(lambda: number, rnd: () => number) {
  const l = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rnd();
  } while (p > l && k < 12);
  return k - 1;
}

export function advanceRound(state: CareerState, userResult: { hg: number; ag: number }) {
  const round = state.round;
  const fixtures = state.fixtures.map((f) => {
    if (f.round !== round || f.homeGoals !== null) return f;
    if (f.home === state.clubId || f.away === state.clubId) {
      return { ...f, homeGoals: userResult.hg, awayGoals: userResult.ag };
    }
    const { hg, ag } = quickSimulate(f.home, f.away, `${state.clubId}-${round}-${f.home}`);
    return { ...f, homeGoals: hg, awayGoals: ag };
  });

  const played = state.fixtures.find(
    (f) => f.round === round && (f.home === state.clubId || f.away === state.clubId),
  );

  return {
    ...state,
    fixtures,
    round: Math.min(round + 1, 38),
    results: played
      ? [
          ...state.results,
          {
            round,
            home: played.home,
            away: played.away,
            hg: userResult.hg,
            ag: userResult.ag,
          },
        ]
      : state.results,
  };
}
