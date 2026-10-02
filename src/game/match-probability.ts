import { makeRng } from "./rng";
import type { Tactics } from "./types";

export interface MatchConditions {
  homeStrength?: number;
  awayStrength?: number;
  homeForm?: number;
  awayForm?: number;
  homeFatigue?: number;
  awayFatigue?: number;
  homeTactics?: Pick<Tactics, "mentality" | "pressing" | "tempo">;
  awayTactics?: Pick<Tactics, "mentality" | "pressing" | "tempo">;
  neutralVenue?: boolean;
}

export function bounded(
  value: number | undefined,
  fallback: number,
  lo: number,
  hi: number,
): number {
  return Math.max(lo, Math.min(hi, Number.isFinite(value) ? value! : fallback));
}

/** A smooth quality advantage: modest league gaps matter without deciding a result. */
export function strengthEdge(home: number, away: number): number {
  return Math.tanh((bounded(home, 70, 35, 99) - bounded(away, 70, 35, 99)) / 23) * 0.62;
}

/** Independent seed stream: a good/bad day cannot alter identity or consume the event RNG. */
export function teamDay(seed: string, side: "home" | "away"): number {
  const rnd = makeRng(`match-day:${seed}:${side}`);
  return (rnd() + rnd() + rnd() - 1.5) * 4;
}

export function expectedGoals(home: number, away: number, seed: string, ctx: MatchConditions = {}) {
  const quality = strengthEdge(ctx.homeStrength ?? home, ctx.awayStrength ?? away);
  const form = (value?: number) => (bounded(value, 60, 0, 100) - 60) / 40;
  const fatigue = (value?: number) => -Math.max(0, bounded(value, 0, 0, 100) - 15) / 190;
  const risk = (t?: MatchConditions["homeTactics"]) =>
    t
      ? (bounded(t.mentality, 2, 0, 4) - 2) * 0.045 +
        (bounded(t.pressing, 1, 0, 2) - 1) * 0.018 +
        (bounded(t.tempo, 1, 0, 2) - 1) * 0.012
      : 0;
  const edge = quality + (form(ctx.homeForm) - form(ctx.awayForm)) * 0.075;
  const hr = risk(ctx.homeTactics),
    ar = risk(ctx.awayTactics);
  return {
    home:
      1.24 *
      Math.exp(
        edge +
          (ctx.neutralVenue ? 0 : 0.15) +
          fatigue(ctx.homeFatigue) +
          hr +
          ar * 0.5 +
          teamDay(seed, "home") * 0.04,
      ),
    away:
      1.24 *
      Math.exp(
        -edge -
          (ctx.neutralVenue ? 0 : 0.09) +
          fatigue(ctx.awayFatigue) +
          ar +
          hr * 0.5 +
          teamDay(seed, "away") * 0.04,
      ),
  };
}

function poissonBuckets(lambda: number): number[] {
  const p = [Math.exp(-lambda)];
  for (let i = 1; i < 8; i++) p.push((p[i - 1]! * lambda) / i);
  // The final bucket owns the tail; no rejection loop or lost probability mass.
  p.push(Math.max(0, 1 - p.reduce((sum, v) => sum + v, 0)));
  return p;
}

/** Joint Poisson with the four Dixon-Coles low-score corrections, not a rewritten draw. */
export function regulationScore(rates: { home: number; away: number }, rnd: () => number) {
  const home = bounded(rates.home, 1.4, 0.15, 4.5);
  const away = bounded(rates.away, 1.1, 0.15, 4.5);
  const hp = poissonBuckets(home),
    ap = poissonBuckets(away);
  const rho = -0.06;
  let roll = rnd();
  for (let hg = 0; hg < hp.length; hg++) {
    for (let ag = 0; ag < ap.length; ag++) {
      const tau =
        hg === 0 && ag === 0
          ? 1 - home * away * rho
          : hg === 0 && ag === 1
            ? 1 + home * rho
            : hg === 1 && ag === 0
              ? 1 + away * rho
              : hg === 1 && ag === 1
                ? 1 - rho
                : 1;
      roll -= hp[hg]! * ap[ag]! * tau;
      if (roll <= 0) return { hg, ag };
    }
  }
  return { hg: 8, ag: 8 };
}

export function poissonGoals(lambda: number, rnd: () => number): number {
  const threshold = Math.exp(-bounded(lambda, 0.4, 0, 4.5));
  let count = 0,
    product = 1;
  do {
    count++;
    product *= rnd();
  } while (product > threshold && count < 12);
  return count - 1;
}
