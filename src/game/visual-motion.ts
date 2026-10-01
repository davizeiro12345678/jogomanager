import { gaitCadence, gaitPhaseAt } from "./gait-kinematics";

export interface VisualMotion {
  time: number;
  yaw: number;
  leanX: number;
  leanZ: number;
  accelerationLean: number;
  phase: number;
  speed: number;
  vx: number;
  vz: number;
  forward: number;
  lateral: number;
  turnRate: number;
}
const caches = new WeakMap<object, Map<string, VisualMotion>>();
const wrap = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

/** Presentation only. Both render paths share the phase and inertia, so LOD
 * promotion keeps the current stride. A frame is sampled at most once. */
export function visualMotionFor(
  owner: object,
  player: { id: string; x: number; z: number; vx: number; vz: number },
  ball: { x: number; z: number },
  seed: number,
  legLength: number,
  time: number,
  trackBall = false,
): VisualMotion {
  let players = caches.get(owner);
  if (!players) {
    players = new Map();
    caches.set(owner, players);
  }
  const speed = Math.hypot(player.vx, player.vz);
  const desired =
    speed > 0.5 && !(trackBall && speed < 3.1)
      ? Math.atan2(player.vx, player.vz)
      : Math.atan2(ball.x - player.x, ball.z - player.z);
  let state = players.get(player.id);
  if (!state || time < state.time) {
    state = {
      time,
      yaw: desired,
      leanX: Math.min(0.18, speed * 0.022),
      leanZ: 0,
      accelerationLean: 0,
      phase: gaitPhaseAt(0, seed),
      speed,
      vx: player.vx,
      vz: player.vz,
      forward: player.vx * Math.sin(desired) + player.vz * Math.cos(desired),
      lateral: player.vx * Math.cos(desired) - player.vz * Math.sin(desired),
      turnRate: 0,
    };
    players.set(player.id, state);
    return state;
  }
  if (time === state.time) return state;
  const elapsed = Math.max(0, time - state.time);
  const dt = clamp(elapsed, 0, 0.1);
  const turn = wrap(desired - state.yaw) * (1 - Math.exp(-(speed > 0.5 ? 13 : 5) * dt));
  state.yaw = wrap(state.yaw + turn);
  const acceleration =
    ((player.vx - state.vx) * Math.sin(state.yaw) + (player.vz - state.vz) * Math.cos(state.yaw)) /
    Math.max(dt, 1 / 120);
  const inertia = 1 - Math.exp(-9 * dt);
  state.accelerationLean +=
    (clamp(acceleration * 0.009, -0.085, 0.1) - state.accelerationLean) * inertia;
  const ease = 1 - Math.exp(-7 * dt);
  state.leanX += (Math.min(0.18, speed * 0.022) + state.accelerationLean - state.leanX) * ease;
  state.leanZ +=
    (clamp((-turn / Math.max(dt, 1 / 120)) * 0.065 * Math.min(1, speed / 5), -0.22, 0.22) -
      state.leanZ) *
    ease;
  state.turnRate += (clamp(turn / Math.max(dt, 1 / 120), -5, 5) - state.turnRate) * ease;
  state.forward = player.vx * Math.sin(state.yaw) + player.vz * Math.cos(state.yaw);
  state.lateral = player.vx * Math.cos(state.yaw) - player.vz * Math.sin(state.yaw);
  // A long frame advances the stride by the full elapsed time. Clamping the
  // animation clock used to slow only the legs whenever rendering stalled.
  state.phase =
    (state.phase + elapsed * gaitCadence(speed, legLength) * Math.PI * 2) % (Math.PI * 2);
  state.time = time;
  state.speed = speed;
  state.vx = player.vx;
  state.vz = player.vz;
  return state;
}
