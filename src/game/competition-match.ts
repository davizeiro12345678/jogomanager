import { CLUBS } from "./data/leagues";
import { makeRng } from "./rng";

/** Simulação curta determinística usada pelo worker para ligas e eliminatórias de IA. */
export function competitionScore(home: string, away: string, seed: string) {
  const rnd = makeRng(seed);
  const edge = Math.tanh(((CLUBS[home]?.strength ?? 60) - (CLUBS[away]?.strength ?? 60)) / 18);
  const goals = (expected: number) => {
    let product = 1,
      count = 0;
    const threshold = Math.exp(expected);
    do {
      product *= rnd();
      count++;
    } while (product * threshold > 1 && count < 9);
    return count - 1;
  };
  return { hg: goals(1.45 * Math.exp(edge * 0.5)), ag: goals(1.15 * Math.exp(-edge * 0.5)) };
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
