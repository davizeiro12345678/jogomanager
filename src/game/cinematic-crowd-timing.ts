/** Distant audience motion is cosmetic. Holding its instance writes below the
 * hero camera rate leaves CPU time for face, hands and camera interpolation. */
export const CINEMATIC_CROWD_HZ = 45;
export const CINEMATIC_CROWD_STEP = 1 / CINEMATIC_CROWD_HZ;

export function cinematicCrowdUpdateAt(
  accumulator: number,
  rawDt: number,
  initialized: boolean,
): { update: boolean; accumulator: number } {
  if (!initialized) return { update: true, accumulator: 0 };
  if (!Number.isFinite(rawDt) || rawDt <= 0) return { update: false, accumulator: 0 };
  const carried = Number.isFinite(accumulator) && accumulator > 0 ? accumulator : 0;
  // A tab wake-up must not request a burst of stale matrix uploads.
  const next = Math.min(CINEMATIC_CROWD_STEP * 2, carried + Math.min(rawDt, 1 / 12));
  if (next + CINEMATIC_CROWD_STEP * 1e-8 < CINEMATIC_CROWD_STEP)
    return { update: false, accumulator: next };
  return { update: true, accumulator: next - CINEMATIC_CROWD_STEP };
}
