/** Deterministic pitch-plane mechanics, shared by Worker and server replay.
 * Metres, seconds and kilograms; tactical destinations remain in MatchSim. */
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
  // Live ticks use 120 Hz integration; fast-forward caps work per player so
  // sequential season simulation does not spend every tick on tiny substeps.
  const steps = Math.min(8, Math.ceil(dt * 120)),
    h = dt / steps;
  const response = 1 - Math.exp(-6 * h);
  for (let i = 0; i < steps; i++) {
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
