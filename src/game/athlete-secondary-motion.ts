export type AthleteLooseHairStyle = "braids" | "dreads" | "ponytail" | "none";

export interface AthleteHairMotionState {
  pitch: number;
  yaw: number;
  roll: number;
  pitchVelocity: number;
  yawVelocity: number;
  rollVelocity: number;
}

export interface AthleteHairMotionInput {
  dt: number;
  speed: number;
  accelerationLean: number;
  turnRate: number;
  phase: number;
  style: AthleteLooseHairStyle;
}

export function createAthleteHairMotionState(): AthleteHairMotionState {
  return { pitch: 0, yaw: 0, roll: 0, pitchVelocity: 0, yawVelocity: 0, rollVelocity: 0 };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function integrateAxis(
  state: AthleteHairMotionState,
  angleKey: "pitch" | "yaw" | "roll",
  velocityKey: "pitchVelocity" | "yawVelocity" | "rollVelocity",
  target: number,
  dt: number,
  limit: number,
): void {
  let angle = state[angleKey];
  let velocity = state[velocityKey];
  const steps = Math.max(1, Math.min(3, Math.ceil(dt / (1 / 60))));
  const step = dt / steps;
  const omega = 18;
  for (let index = 0; index < steps; index++) {
    const acceleration = (target - angle) * omega * omega - 2 * omega * velocity;
    velocity = clamp(velocity + acceleration * step, -3.2, 3.2);
    angle = clamp(angle + velocity * step, -limit, limit);
  }
  state[angleKey] = angle;
  state[velocityKey] = velocity;
}

/** Mutates the tiny spring state in place; the render loop allocates nothing. */
export function advanceAthleteHairMotion(
  state: AthleteHairMotionState,
  input: AthleteHairMotionInput,
): void {
  const dt = Number.isFinite(input.dt) ? clamp(input.dt, 0, 0.05) : 0;
  const styleWeight =
    input.style === "ponytail"
      ? 1
      : input.style === "dreads"
        ? 0.8
        : input.style === "braids"
          ? 0.68
          : 0;
  const cadence = clamp(input.speed / 7, 0, 1);
  const targetPitch = clamp(
    (-input.accelerationLean * 1.7 + Math.sin(input.phase * 2) * cadence * 0.024) * styleWeight,
    -0.15,
    0.15,
  );
  const targetYaw = clamp(
    (-input.turnRate * 0.03 + Math.sin(input.phase) * cadence * 0.018) * styleWeight,
    -0.15,
    0.15,
  );
  const targetRoll = clamp(
    (input.turnRate * 0.018 + Math.sin(input.phase + 1) * cadence * 0.012) * styleWeight,
    -0.11,
    0.11,
  );
  integrateAxis(state, "pitch", "pitchVelocity", targetPitch, dt, 0.16);
  integrateAxis(state, "yaw", "yawVelocity", targetYaw, dt, 0.16);
  integrateAxis(state, "roll", "rollVelocity", targetRoll, dt, 0.12);
}
