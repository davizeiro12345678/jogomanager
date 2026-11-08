/** Infractions older than this no longer count toward a mute. */
export const INFRACTION_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Progressive mutes: infraction count in the window → mute length after the
 * latest one. Automated moderation always has a finite end; a permanent block
 * requires a separate human review/appeal decision.
 */
export const MUTE_STEPS: ReadonlyArray<{ count: number; durationMs: number }> = [
  { count: 10, durationMs: 30 * 24 * 60 * 60 * 1000 },
  { count: 7, durationMs: 7 * 24 * 60 * 60 * 1000 },
  { count: 5, durationMs: 24 * 60 * 60 * 1000 },
  { count: 3, durationMs: 10 * 60 * 1000 },
];

/**
 * Returns when the finite mute ends (ms epoch), or null when the user may talk.
 * `infractionTimes` are ms epochs, any order.
 */
export function muteUntil(infractionTimes: readonly number[], now: number): number | null {
  const recent = infractionTimes.filter((t) => now - t < INFRACTION_WINDOW_MS);
  if (recent.length === 0) return null;
  const latest = Math.max(...recent);
  const step = MUTE_STEPS.find((s) => recent.length >= s.count);
  if (!step) return null;
  const end = latest + step.durationMs;
  return end > now ? end : null;
}
