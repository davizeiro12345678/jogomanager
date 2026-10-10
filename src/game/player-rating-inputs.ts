import type { Player } from "./types";

export function ratingValue(value: unknown, fallback = 60, low = 20, high = 99): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(low, Math.min(high, value))
    : fallback;
}

export function validPlayerSkills(
  p: Pick<
    Player,
    "ovr" | "pace" | "shooting" | "passing" | "defending" | "physical" | "age" | "pos"
  >,
): boolean {
  return (
    [p.ovr, p.pace, p.shooting, p.passing, p.defending, p.physical].every(
      (v) => Number.isFinite(v) && v >= 20 && v <= 99,
    ) &&
    Number.isFinite(p.age) &&
    p.age >= 14 &&
    p.age <= 70 &&
    ["GK", "DF", "MF", "FW"].includes(p.pos)
  );
}

/** Match/profile boundary only: imported records and persisted ratings stay intact. */
export function normalizedPlayerRatings(p: Player): Player {
  return {
    ...p,
    ovr: ratingValue(p.ovr),
    pace: ratingValue(p.pace),
    shooting: ratingValue(p.shooting),
    passing: ratingValue(p.passing),
    defending: ratingValue(p.defending),
    physical: ratingValue(p.physical),
    age: ratingValue(p.age, 25, 14, 70),
    potential: ratingValue(p.potential, ratingValue(p.ovr)),
    condition: ratingValue(p.condition, 100, 0, 100),
    morale: ratingValue(p.morale, 70, 0, 100),
  };
}
