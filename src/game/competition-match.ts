import { CLUBS } from "./data/leagues";
import { makeRng } from "./rng";
import { expectedGoals, regulationScore, type MatchConditions } from "./match-probability";

/** Simulação curta determinística usada pelo worker para ligas e eliminatórias de IA. */
export function competitionScore(
  home: string,
  away: string,
  seed: string,
  ctx: MatchConditions = {},
) {
  const rnd = makeRng(seed);
  return regulationScore(
    expectedGoals(CLUBS[home]?.strength ?? 70, CLUBS[away]?.strength ?? 70, seed, ctx),
    rnd,
  );
}

export interface CompetitionPlayoff {
  home: string;
  away: string;
  first: { hg: number; ag: number };
  second: { hg: number; ag: number };
  winner: string;
  penalties: boolean;
}
export function competitionPlayoff(home: string, away: string, seed: string): CompetitionPlayoff {
  const first = competitionScore(home, away, `${seed}-1`);
  const second = competitionScore(away, home, `${seed}-2`);
  const hg = first.hg + second.ag,
    ag = first.ag + second.hg;
  const penalties = hg === ag;
  const winner = hg > ag ? home : hg < ag ? away : makeRng(`${seed}-pens`)() < 0.5 ? home : away;
  return { home, away, first, second, winner, penalties };
}
