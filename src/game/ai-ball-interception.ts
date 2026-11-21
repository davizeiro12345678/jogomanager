/**
 * Deterministic loose-ball pursuit for the opt-in contact-physics revision.
 * Pure spatial heuristics: no RNG and no mutation of the simulation or ball.
 * The real collision/contact solver still decides who can control the ball.
 */
import { FIELD_X, FIELD_Z } from "./sim-rules";

export interface InterceptionInput {
  playerX: number;
  playerZ: number;
  playerVx: number;
  playerVz: number;
  pace: number;
  stamina: number;
  ballX: number;
  ballZ: number;
  ballVx: number;
  ballVz: number;
}

export interface InterceptionTarget {
  x: number;
  z: number;
  /** Lower means a more plausible interceptor. */
  score: number;
}

const clamp = (n: number, lower: number, upper: number) => Math.max(lower, Math.min(upper, n));

/**
 * Biases the chaser toward where a rolling ball will be soon, not its old
 * location. Includes a bounded turn-time penalty so an athlete moving away
 * from the ball doesn't magically pivot at full speed.
 */
export function predictLooseBallInterception(input: InterceptionInput): InterceptionTarget {
  const { playerX, playerZ, playerVx, playerVz, ballX, ballZ, ballVx, ballVz } = input;
  if (
    ![
      playerX,
      playerZ,
      playerVx,
      playerVz,
      ballX,
      ballZ,
      ballVx,
      ballVz,
      input.pace,
      input.stamina,
    ].every(Number.isFinite)
  ) {
    return {
      x: clamp(Number.isFinite(ballX) ? ballX : 0, -FIELD_X + 1, FIELD_X - 1),
      z: clamp(Number.isFinite(ballZ) ? ballZ : 0, -FIELD_Z + 1, FIELD_Z - 1),
      score: 1_000_000,
    };
  }
  const staminaFactor = 0.78 + (clamp(input.stamina, 0, 100) / 100) * 0.22;
  const speed = (2.45 + (clamp(input.pace, 0, 100) / 100) * 3.65) * staminaFactor;
  const directDistance = Math.hypot(ballX - playerX, ballZ - playerZ);
  const forecastSeconds = clamp(directDistance / Math.max(speed, 0.1), 0, 1.2);
  // Approximate deceleration for target choice only. The ball physics itself
  // is still authoritative and must not be modified by this AI function.
  const rollDistance = forecastSeconds * (1 - 0.18 * forecastSeconds);
  // Never ask a runner to intercept beyond the field while an out-of-play
  // decision is pending. The target is planning only, not a ball teleport.
  const x = clamp(ballX + ballVx * rollDistance, -FIELD_X + 1, FIELD_X - 1);
  const z = clamp(ballZ + ballVz * rollDistance, -FIELD_Z + 1, FIELD_Z - 1);
  const dx = x - playerX;
  const dz = z - playerZ;
  const remaining = Math.hypot(dx, dz);
  const playerSpeed = Math.hypot(playerVx, playerVz);
  const alignment =
    remaining > 0.001 && playerSpeed > 0.001
      ? (dx * playerVx + dz * playerVz) / (remaining * playerSpeed)
      : 0;
  const turnPenalty = playerSpeed > 2 ? clamp((0.3 - alignment) * 0.18, 0, 0.22) : 0;
  return { x, z, score: remaining / Math.max(speed, 0.1) + turnPenalty };
}
