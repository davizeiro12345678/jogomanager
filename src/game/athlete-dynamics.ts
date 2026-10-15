/** Deterministic pitch-plane mechanics, shared by Worker and server replay.
 * Metres, seconds and kilograms; tactical destinations remain in MatchSim. */
import { HIGH_FIDELITY_PHYSICS_STEP, highFidelitySubsteps } from "./physics-quality";

export interface AthleteBody {
  x: number;
  z: number;
  vx: number;
  vz: number;
  pace: number;
  physical: number;
  stamina: number;
  weightKg?: number;
}
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const mass = (p: AthleteBody) => (Number.isFinite(p.weightKg) ? clamp(p.weightKg!, 45, 130) : 78);
// A 1 / 15 spatial tick plus the retained <1/139 remainder can need eleven
// slices. This applies only to live motion; long recovery intervals still use
// a bounded fallback below.
const MAX_LIVE_ATHLETE_SUBSTEPS = 11;
const liveRemainder = new WeakMap<AthleteBody, number>();
export const athleteRemainder = (body: AthleteBody) => liveRemainder.get(body) ?? 0;
export function restoreAthleteRemainder(body: AthleteBody, remainder: number) {
  if (!Number.isFinite(remainder) || remainder < 0 || remainder >= HIGH_FIDELITY_PHYSICS_STEP)
    throw new Error("Invalid athlete integration remainder");
  liveRemainder.set(body, remainder);
}

/** Bounded acceleration, stopping distance and continuous coasting. Substeps
 * keep a coarse fast-forward tick consistent with the live match clock. */
export function advanceAthlete(
  p: AthleteBody,
  tx: number,
  tz: number,
  maxSpeed: number,
  dt: number,
  traction: number,
) {
  if (!Number.isFinite(dt) || dt <= 0) return;
  const grip = clamp(traction, 0.4, 1.1);
  const force =
    ((4 + clamp(p.pace, 0, 100) * 0.018 + clamp(p.physical, 0, 100) * 0.012) *
      (0.72 + clamp(p.stamina, 0, 100) * 0.0028) *
      78) /
    mass(p);
  const acceleration = clamp(force, 3.2, 7.5) * grip;
  const braking = (7.2 + clamp(p.physical, 0, 100) * 0.02) * grip;
  // Spatial motion resolves at 139 Hz minimum while the deterministic match
  // clock, AI and rules remain at 30 Hz. Ten slices cover the live 1 / 15 s
  // motion interval without letting fast-forward create unbounded work.
  const carried = liveRemainder.get(p) ?? 0;
  const accumulated = dt + carried;
  const fixedSteps = Math.floor(accumulated / HIGH_FIDELITY_PHYSICS_STEP);
  // The ordinary live path runs identical 1 / 139 slices regardless of the
  // outer render or Worker cadence. The weak remainder never becomes career
  // data and is deterministic for the fixed 30 Hz match clock.
  const useFixedSlices = fixedSteps <= MAX_LIVE_ATHLETE_SUBSTEPS;
  const steps = useFixedSlices ? fixedSteps : highFidelitySubsteps(dt, MAX_LIVE_ATHLETE_SUBSTEPS);
  if (useFixedSlices)
    liveRemainder.set(p, Math.max(0, accumulated - steps * HIGH_FIDELITY_PHYSICS_STEP));
  else liveRemainder.delete(p);
  for (let i = 0; i < steps; i++) {
    const h = useFixedSlices ? HIGH_FIDELITY_PHYSICS_STEP : dt / steps;
    const response = 1 - Math.exp(-6 * h);
    const dx = tx - p.x,
      dz = tz - p.z,
      distance = Math.hypot(dx, dz);
    const desiredSpeed = Math.min(
      Math.max(0, maxSpeed),
      Math.sqrt(2 * braking * Math.max(0, distance - 0.08)),
    );
    const ux = distance > 0.00001 ? (dx / distance) * desiredSpeed : 0;
    const uz = distance > 0.00001 ? (dz / distance) * desiredSpeed : 0;
    const dvx = ux - p.vx,
      dvz = uz - p.vz,
      change = Math.hypot(dvx, dvz);
    // Deceleration may use more force than launch, but never teleports velocity.
    const slowing = dvx * p.vx + dvz * p.vz < 0;
    const limit = (slowing ? braking : acceleration) * h;
    const factor = change > 0 ? Math.min(response, limit / change) : 0;
    const oldX = p.vx,
      oldZ = p.vz;
    p.vx += dvx * factor;
    p.vz += dvz * factor;
    p.x += (oldX + p.vx) * 0.5 * h;
    p.z += (oldZ + p.vz) * 0.5 * h;
  }
}

/** Inelastic shoulder contact with limited tangential friction. Equal and
 * opposite impulses conserve momentum and dissipate kinetic energy. */
export function athleteContact(a: AthleteBody, b: AthleteBody, nx: number, nz: number) {
  const closing = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
  if (closing >= 0) return;
  const inverseA = 1 / mass(a),
    inverseB = 1 / mass(b),
    inverse = inverseA + inverseB;
  const impulse = (-closing * 1.06) / inverse;
  const tangent = (b.vx - a.vx) * -nz + (b.vz - a.vz) * nx;
  const friction = clamp(-tangent / inverse, -impulse * 0.18, impulse * 0.18);
  const ix = nx * impulse - nz * friction,
    iz = nz * impulse + nx * friction;
  a.vx -= ix * inverseA;
  a.vz -= iz * inverseA;
  b.vx += ix * inverseB;
  b.vz += iz * inverseB;
}
