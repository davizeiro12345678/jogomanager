import { footballContactAt } from "./motion-metadata";

/** Feed cloth from the shown action's contact marker, never from frame count. */
export function clothContactPulse(
  action: string | null,
  remaining: number,
  duration: number,
): number {
  if (
    !action ||
    !/pass|cross|shoot|shot|kick|header|tackle|slide|duel|block|save|catch|volley/i.test(action) ||
    !Number.isFinite(remaining) ||
    !Number.isFinite(duration) ||
    duration <= 0 ||
    remaining < 0 ||
    remaining > duration
  )
    return 0;
  const progress = 1 - remaining / duration;
  const distance = Math.abs(progress - footballContactAt(action)) / 0.12;
  const pulse = Math.max(0, 1 - distance);
  return pulse * pulse;
}
