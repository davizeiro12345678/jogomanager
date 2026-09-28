export interface FootGaitPose {
  /** Forward/backward swing around the hip, in radians. */
  stride: number;
  /** Knee flex during swing, in radians. */
  kneeFlex: number;
  /** Ankle roll from toe-off through landing, in radians. */
  anklePitch: number;
  /** 0 during stance, 0..1 while the foot is in swing. */
  swing: number;
}

export interface GaitPose {
  cadence: number;
  intensity: number;
  hipBob: number;
  armCounterSwing: number;
  torsoCounterRotation: number;
  left: FootGaitPose;
  right: FootGaitPose;
}

const TAU = Math.PI * 2;
const STANCE_FRACTION = 0.62;

function cyclePhase(phase: number): number {
  return ((phase % TAU) + TAU) % TAU;
}

function footPose(phase: number, intensity: number, strideAmplitude: number): FootGaitPose {
  const normalized = cyclePhase(phase) / TAU;
  const swing =
    normalized <= STANCE_FRACTION
      ? 0
      : Math.sin(((normalized - STANCE_FRACTION) / (1 - STANCE_FRACTION)) * Math.PI);

  return {
    stride: Math.sin(phase) * strideAmplitude,
    kneeFlex: intensity * (0.045 + swing * 0.9),
    anklePitch: intensity * (-0.035 + swing * 0.22),
    swing,
  };
}

/**
 * Converts forward speed into an actual stride cycle. The cadence tracks
 * distance traveled, so faster players accelerate the leg cycle instead of
 * skating through a fixed-frequency walk animation.
 */
export function gaitCadence(speed: number): number {
  const safeSpeed = Number.isFinite(speed) ? Math.max(0, speed) : 0;
  if (safeSpeed < 0.2) return 0;
  const strideLength = Math.max(1.15, safeSpeed / 2.35);
  return safeSpeed / strideLength;
}

export function gaitPoseAt(phase: number, speed: number): GaitPose {
  const safeSpeed = Number.isFinite(speed) ? Math.max(0, speed) : 0;
  const linear = Math.max(0, Math.min(1, (safeSpeed - 0.2) / 6.8));
  const intensity = linear * linear * (3 - 2 * linear);
  const strideAmplitude = intensity * (0.16 + 0.48 * intensity);
  const leftPhase = cyclePhase(phase);
  const rightPhase = cyclePhase(phase + Math.PI);
  const cycle = Math.sin(phase);

  return {
    cadence: gaitCadence(safeSpeed),
    intensity,
    hipBob: (0.5 - Math.cos(phase * 2) * 0.5) * intensity * 0.025,
    armCounterSwing: -cycle * intensity * 0.42,
    torsoCounterRotation: -cycle * intensity * 0.075,
    left: footPose(leftPhase, intensity, strideAmplitude),
    right: footPose(rightPhase, intensity, strideAmplitude),
  };
}
