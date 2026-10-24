import { BALL_LINEAR_DAMPING, BALL_FLIGHT_PREDICTION_STEP } from "./ball-flight-prediction";
import { BALL_RADIUS, GOAL_H, GOAL_Z } from "./sim-rules";
import type { BallFlightProbe, RapierBallState } from "./rapier-ball-authority";

export const FREE_KICK_FLIGHT_CANDIDATES = 8;
// MatchSim's current first-touch envelope. The ball must clear the complete
// sphere, rather than barely placing its centre above the header threshold.
export const FREE_KICK_WALL_REACH = 1.9;
export const FREE_KICK_WALL_HEIGHT = 2.4;
const HORIZONTAL_FRACTIONS = [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.425, 0.35] as const;

export interface FreeKickObstacle {
  x: number;
  z: number;
  vx: number;
  vz: number;
}
export interface FreeKickTarget {
  x: number;
  z: number;
  height: number;
}

function crossingOf(previous: RapierBallState, next: RapierBallState, targetX: number) {
  const dir = Math.sign(targetX - previous.x);
  if (!dir || (next.x - targetX) * dir < 0) return null;
  const span = next.x - previous.x;
  if (Math.abs(span) < 1e-9) return null;
  const ratio = Math.max(0, Math.min(1, (targetX - previous.x) / span));
  return {
    z: previous.z + (next.z - previous.z) * ratio,
    height: previous.height + (next.height - previous.height) * ratio,
  };
}

/** Chooses an initial condition only. Every candidate is verified by a separate
 * Rapier world; the live ball, match RNG, defenders and scoring remain untouched.
 * Eight candidates and 120 samples each are hard bounds, independent of input. */
export function planFreeKickFlight(
  initial: RapierBallState,
  target: FreeKickTarget,
  obstacles: readonly FreeKickObstacle[],
  wind: { x: number; z: number },
  probe: BallFlightProbe,
): RapierBallState | null {
  const dx = target.x - initial.x,
    dz = target.z - initial.z;
  const distance = Math.hypot(dx, dz),
    speed = Math.hypot(initial.vx, initial.vz);
  if (
    ![distance, speed, target.height, initial.vy].every(Number.isFinite) ||
    distance < 1 ||
    speed < 1
  )
    return null;
  const ux = dx / distance,
    uz = dz / distance;
  const maximumEnergySpeed = Math.hypot(speed, initial.vy);
  for (const fraction of HORIZONTAL_FRACTIONS) {
    const horizontal = speed * fraction;
    const dampingRatio = (BALL_LINEAR_DAMPING * distance) / horizontal;
    if (dampingRatio >= 1) continue;
    const time = -Math.log(1 - dampingRatio) / BALL_LINEAR_DAMPING;
    if (!Number.isFinite(time) || time > 4 || time <= 0) continue;
    const response = (1 - Math.exp(-BALL_LINEAR_DAMPING * time)) / BALL_LINEAR_DAMPING;
    const accelerationResponse = (time - response) / BALL_LINEAR_DAMPING;
    const spin = (initial.spin * (1 - Math.exp(-0.28 * time))) / (0.28 * time);
    const ax = wind.x - uz * spin,
      az = wind.z + ux * spin;
    const vx = (dx - ax * accelerationResponse) / response;
    const vz = (dz - az * accelerationResponse) / response;
    const vy = (target.height - initial.height + 9.81 * accelerationResponse) / response;
    if (
      Math.hypot(vx, vz, vy) > maximumEnergySpeed ||
      Math.atan2(vy, Math.hypot(vx, vz)) > Math.PI / 3
    )
      continue;
    const candidate = { ...initial, vx, vz, vy };
    const samples = probe.sample(candidate);
    let blocked = false;
    for (let index = 1; index < samples.length; index++) {
      const state = samples[index]!;
      const elapsed = index * BALL_FLIGHT_PREDICTION_STEP;
      for (const obstacle of obstacles) {
        const x = obstacle.x + obstacle.vx * elapsed,
          z = obstacle.z + obstacle.vz * elapsed;
        if (
          Math.hypot(state.x - x, state.z - z) < FREE_KICK_WALL_REACH + BALL_RADIUS &&
          state.height - BALL_RADIUS <= FREE_KICK_WALL_HEIGHT
        ) {
          blocked = true;
          break;
        }
      }
      if (blocked) break;
      const crossing = crossingOf(samples[index - 1]!, state, target.x);
      if (crossing) {
        if (
          Math.abs(crossing.z) + BALL_RADIUS < GOAL_Z &&
          crossing.height >= BALL_RADIUS &&
          crossing.height + BALL_RADIUS < GOAL_H
        )
          return candidate;
        break;
      }
    }
  }
  return null;
}
