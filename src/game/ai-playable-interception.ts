import { athleteAcceleration } from "./athlete-dynamics";
import { FIELD_X, FIELD_Z } from "./sim-rules";
import type { Side, SimView, SimPlayer } from "./sim-contracts";

export interface PlannedInterception {
  id: string;
  x: number;
  z: number;
  time: number;
}

// Project the current pitch-plane momentum onto the path to the intercept.
// Accelerate up to the pursuit speed, then complete the distance at that speed.
function arrival(
  player: SimPlayer,
  speed: number,
  acceleration: number,
  x: number,
  z: number,
  reach: number,
  time: number,
): number {
  const dx = x - player.x;
  const dz = z - player.z;
  const squared = dx * dx + dz * dz;
  const range = time * speed + reach;
  if (squared > range * range) return Infinity;
  if (squared <= reach * reach) return 0;
  const direct = Math.sqrt(squared);
  const distance = direct - reach;
  const initial = Math.min(speed, Math.max(-speed, (dx * player.vx + dz * player.vz) / direct));
  const accelerationTime = (speed - initial) / acceleration;
  const accelerationDistance = ((speed + initial) * accelerationTime) / 2;
  if (distance > accelerationDistance)
    return accelerationTime + (distance - accelerationDistance) / speed;
  const finalSpeed = Math.sqrt(initial * initial + 2 * acceleration * distance);
  return (finalSpeed - initial) / acceleration;
}

/** Plan one runner per side from observed ball motion. The collision model still resolves possession. */
export function firstPlayableInterception(
  ball: SimView["ball"],
  vy: number,
  players: readonly SimPlayer[],
  side: Side,
  traction: number,
  contactRevision: 2 | 3 | null,
): PlannedInterception | null {
  const grip = Math.max(0.4, Math.min(1.1, traction));
  const airborne = ball.height > 0.12 || vy > 0;
  // The forecast is monotonic on [0, 2] in both pitch axes. Even a fully
  // accelerated runner outside this rectangle cannot reach the trajectory.
  const horizon = 2;
  const travelLimit = airborne ? horizon : horizon * (1 - 0.18 * horizon);
  const endX = ball.x + ball.vx * travelLimit;
  const endZ = ball.z + ball.vz * travelLimit;
  const minX = Math.min(ball.x, endX),
    maxX = Math.max(ball.x, endX);
  const minZ = Math.min(ball.z, endZ),
    maxZ = Math.max(ball.z, endZ);
  const maxReach = contactRevision !== null ? 1.3 : 1.9;
  let best: SimPlayer | undefined;
  let bestStep = 20;
  let fastest = Infinity;
  let targetX = 0,
    targetZ = 0;
  for (const player of players) {
    if (player.side !== side || player.pos === "GK" || player.sentOff) continue;
    const speed =
      (2.45 + (player.pace / 100) * 3.65) * 1.22 * (0.78 + (player.stamina / 100) * 0.22);
    const radius = speed * horizon + maxReach;
    if (
      player.x < minX - radius ||
      player.x > maxX + radius ||
      player.z < minZ - radius ||
      player.z > maxZ + radius
    )
      continue;
    const acceleration = athleteAcceleration(player, grip);
    for (let step = 0; step <= bestStep; step++) {
      const time = step / 10;
      const travel = airborne ? time : time * (1 - 0.18 * time);
      const x = ball.x + ball.vx * travel,
        z = ball.z + ball.vz * travel;
      if (Math.abs(x) > FIELD_X || Math.abs(z) > FIELD_Z) break;
      const height = Math.max(0.12, ball.height + vy * time - (9.81 * time * time) / 2);
      if (height > 2.4) continue;
      const reach = contactRevision !== null ? (height > 0.9 ? 1.3 : 1.05) : 1.9;
      const eta = arrival(player, speed, acceleration, x, z, reach, time);
      if (!(eta <= time)) continue;
      if (!best || step < bestStep || eta < fastest || (eta === fastest && player.id < best.id)) {
        best = player;
        bestStep = step;
        fastest = eta;
        targetX = x;
        targetZ = z;
      }
      break;
    }
  }
  return best ? { id: best.id, x: targetX, z: targetZ, time: bestStep / 10 } : null;
}
