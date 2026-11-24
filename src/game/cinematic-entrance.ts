/** Physical entrance shared by the actor, the camera and garment motion. */
export const ARRIVAL_DURATION = 4.8;
export const ARRIVAL_DISTANCE = 3;
export const ARRIVAL_HEADING = 0.1;
export const ARRIVAL_SPEED = ARRIVAL_DISTANCE / ARRIVAL_DURATION;

export function cinematicEntranceAt(time: number, heading = ARRIVAL_HEADING) {
  const t = Number.isFinite(time) ? Math.max(0, Math.min(ARRIVAL_DURATION, time)) : 0;
  const remaining = ARRIVAL_DISTANCE * (1 - t / ARRIVAL_DURATION);
  return {
    x: -Math.sin(heading) * remaining,
    z: -Math.cos(heading) * remaining,
    moving: t < ARRIVAL_DURATION,
    speed: t < ARRIVAL_DURATION ? ARRIVAL_SPEED : 0,
  };
}
