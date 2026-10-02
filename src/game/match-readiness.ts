import { bounded, teamDay } from "./match-probability";
import { makeRng } from "./rng";
import type { Player } from "./types";

/** Select fit starters without turning recent results into permanent overall changes. */
export function selectionRating(p: Player): number {
  return (
    p.ovr +
    (bounded(p.form, 60, 0, 100) - 60) * 0.035 -
    Math.max(0, 85 - bounded(p.condition, 100, 0, 100)) * 0.18
  );
}

/** Temporary match attributes; persisted ratings, imported records and development stay intact. */
export function matchAttributes(p: Player, seed: string, side: "home" | "away") {
  const rnd = makeRng(`player-day:${seed}:${side}:${p.id}`);
  const consistency =
    p.personality === "temperamental" ? 1.4 : p.personality === "profissional" ? 0.7 : 1;
  const variation = teamDay(seed, side) + (rnd() + rnd() - 1) * 3 * consistency;
  const readiness =
    (bounded(p.form, 60, 0, 100) - 60) * 0.045 +
    (bounded(p.morale, 70, 0, 100) - 70) * 0.02 -
    Math.max(0, 85 - bounded(p.condition, 100, 0, 100)) * 0.12;
  const technical = (v: number) => bounded(v + variation + readiness, 60, 35, 99);
  return {
    pace: bounded(p.pace + (variation + readiness) * 0.25, 60, 35, 99),
    shooting: technical(p.shooting),
    passing: technical(p.passing),
    defending: technical(p.defending),
    physical: technical(p.physical),
    stamina: bounded(p.condition, 100, 12, 100),
  };
}
