import type { Pose } from "./animation-core";

const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, Number.isFinite(n) ? n : lo));

/** Scapula/clavicle motion is local to the upper chest, preserving the arm's
 * resting length while allowing overhead actions without a low torso pivot. */
export function shoulderPose(pitch: number, roll: number) {
  const safePitch = clamp(pitch, -3.1, 3.1);
  const safeRoll = clamp(roll, -2.7, 2.7);
  const raised = clamp((Math.max(Math.abs(safePitch), Math.abs(safeRoll)) - 0.7) / 1.7, 0, 1);
  const clavPitch = safePitch * (0.07 + raised * 0.17);
  const clavRoll =
    Math.sign(safeRoll) * (Math.abs(safeRoll) * (0.12 + raised * 0.14) + raised * 0.14);
  return {
    clavPitch,
    clavRoll,
    armPitch: safePitch - clavPitch,
    armRoll: safeRoll - clavRoll,
    armYaw: -Math.sin(safePitch) * Math.abs(safeRoll) * 0.08,
  };
}

export interface AthletePostureInput {
  time: number;
  phase: number;
  speed: number;
  seed: number;
  stamina: number;
  accelerationLean: number;
  turnRate: number;
  hasAction: boolean;
  defending: boolean;
}

/** Small balance responses are driven by the actual stride, acceleration and
 * fatigue. No extra independent arm oscillator fights the planted foot. */
export function refineAthletePosture(pose: Pose, input: AthletePostureInput): Pose {
  const effort = clamp(input.speed / 8, 0, 1);
  const fatigue = 1 - clamp(input.stamina / 100, 0, 1);
  const breath = Math.sin(input.time * (1.4 + fatigue * 2.4 + effort * 1.2) + input.seed);
  const actionFree = input.hasAction ? 0 : 1;
  const acceleration = clamp(input.accelerationLean, -0.1, 0.12) * actionFree;
  pose.spine += acceleration * 0.72 + fatigue * 0.075 + breath * (0.003 + fatigue * 0.023);
  pose.chest -= acceleration * 0.32;
  pose.chest += breath * (0.002 + fatigue * 0.012);
  pose.headPitch += fatigue * 0.06 - acceleration * 0.28;
  const turn = clamp(input.turnRate, -4, 4) * effort * actionFree;
  pose.hipYaw += turn * 0.012;
  // The gaze and upper trunk lead a turn; the pelvis and support catch up.
  pose.headYaw += turn * 0.04;
  pose.chest += turn * 0.02;
  pose.armLRoll += Math.max(0, -turn) * 0.025;
  pose.armRRoll -= Math.max(0, turn) * 0.025;
  // Upper arms lag the hip cycle; retain authored actions and quiet idle arms.
  const secondary = Math.sin(input.phase - 0.32) * effort * 0.035 * actionFree;
  pose.armLPitch += secondary;
  pose.armRPitch -= secondary;
  if (input.speed < 0.5 && actionFree) {
    const shift = Math.sin(input.time * 0.62 + input.seed * 0.17) * (1 - input.speed / 0.5);
    pose.hipRoll += shift * 0.026;
    pose.kneeL -= Math.max(0, shift) * 0.045;
    pose.kneeR -= Math.max(0, -shift) * 0.045;
  }
  if (input.defending && input.speed < 3.2 && actionFree) {
    const readiness = clamp((3.2 - input.speed) / 3.2, 0, 1) * 0.045;
    pose.spine += readiness;
    pose.armLRoll += readiness * 1.5;
    pose.armRRoll -= readiness * 1.5;
  }
  if (fatigue > 0.6 && input.speed < 0.6 && actionFree) {
    const exhausted = (fatigue - 0.6) / 0.4;
    pose.spine += exhausted * 0.2;
    pose.headPitch += exhausted * 0.08;
    pose.armLPitch -= exhausted * 0.28;
    pose.armRPitch -= exhausted * 0.28;
  }
  return pose;
}
