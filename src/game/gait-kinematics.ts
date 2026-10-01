import { emptyPose, JOINTS, type Pose } from "./animation-core";
import type { Proportions } from "./player-model";

const TAU = Math.PI * 2;
const clamp = (n: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, Number.isFinite(n) ? n : lo));
const smooth = (u: number) => u * u * u * (u * (u * 6 - 15) + 10);

/** Full strides per second, scaled to each athlete's actual leg length. */
export function gaitCadence(speed: number, legLength = 0.86): number {
  const s = clamp(speed, 0, 12);
  const base = (0.78 + Math.sqrt(s) * 0.43) / Math.sqrt(clamp(legLength / 0.86, 0.8, 1.25));
  const duty = 0.64 - clamp(s / 6.8, 0, 1) * 0.38;
  // If the anatomical stride limit is reached, increase cadence so support
  // still travels back at the athlete's actual world speed.
  return Math.max(base, (s * duty) / (2 * clamp(legLength, 0.55, 1.3) * 0.48));
}

export function gaitPhaseAt(time: number, seed: number): number {
  return ((time + (seed % 997) / 997) * TAU) % TAU;
}

/** Two-bone IK in the sagittal plane. Pose retains the catalog's negative
 * knee convention; renderers convert it to positive anatomical flexion. */
export function solveLegTarget(
  forward: number,
  down: number,
  thigh: number,
  shin: number,
  lateral = 0,
) {
  const length = clamp(
    Math.hypot(forward, down, lateral),
    Math.abs(thigh - shin) + 0.001,
    thigh + shin - 0.001,
  );
  const cosine = clamp((length * length - thigh * thigh - shin * shin) / (2 * thigh * shin), -1, 1);
  const bend = Math.acos(cosine);
  const verticalReach = thigh + shin * Math.cos(bend);
  const roll = Math.asin(clamp(lateral / Math.max(0.001, verticalReach), -0.95, 0.95));
  const pitch =
    Math.atan2(-forward, down) - Math.atan2(shin * Math.sin(bend), verticalReach * Math.cos(roll));
  return { pitch, knee: -bend, ankle: -(pitch + bend), roll };
}

export interface GaitSample {
  pose: Pose;
  contactL: number;
  contactR: number;
  strideLength: number;
  cadence: number;
}

export interface GaitDirection {
  forward: number;
  lateral: number;
  stamina: number;
  turnRate: number;
  hasBall: boolean;
}

/** Stance and swing are distinct phases: the supporting foot sweeps back
 * linearly while the returning foot clears the turf on a smooth arc. */
export function gaitPoseAt(
  phase: number,
  speed: number,
  p: Pick<Proportions, "thigh" | "shin">,
  out = emptyPose(),
  direction?: GaitDirection,
): GaitSample {
  for (const joint of JOINTS) out[joint] = 0;
  const s = clamp(speed, 0, 12);
  const amount = clamp(s / 6.8, 0, 1);
  const active = clamp(s / 0.65, 0, 1);
  const length = p.thigh + p.shin;
  const fatigue = direction ? 1 - clamp(direction.stamina / 100, 0, 1) : 0;
  const forward = direction ? clamp(direction.forward / Math.max(0.01, s), -1, 1) : 1;
  const lateral = direction ? clamp(direction.lateral / Math.max(0.01, s), -1, 1) : 0;
  const cadence = gaitCadence(s, length);
  const duty = 0.64 - amount * 0.38;
  const halfStride = Math.min(length * 0.48, (s * duty) / (2 * cadence));
  // Leave enough vertical reach for the entire stance sweep. Asking for a
  // nearly straight leg and a long stride forced IK to shorten the step,
  // which made the planted foot slide at heel strike and toe-off.
  const reachDrop = length - Math.sqrt(Math.max(0.001, length * length - halfStride * halfStride));
  const drop = (reachDrop + 0.014 + amount * 0.02) * active;
  const bob = Math.cos(phase * 2) * (0.003 + amount * 0.012) * active;
  const foot = (offset: number) => {
    const cycle = (((phase / TAU + offset) % 1) + 1) % 1;
    const stance = cycle < duty;
    const u = stance ? cycle / duty : (cycle - duty) / (1 - duty);
    // Match the stance velocity at toe-off and heel strike. A zero velocity
    // swing curve made the ankle jerk each time its foot touched the turf.
    const swingVelocity = (2 * (1 - duty)) / duty;
    const z = stance
      ? halfStride * (1 - 2 * u)
      : halfStride * (2 * smooth(u) - 1 - swingVelocity * u * (1 - u) * (1 - 2 * u));
    const lift = stance
      ? 0
      : Math.sin(Math.PI * u) ** 1.4 * (0.04 + amount * 0.23) * active * (1 - fatigue * 0.18);
    const down = length - drop + bob - lift;
    const leg = solveLegTarget(z * forward, down, p.thigh, p.shin, z * lateral);
    // Toe-off and heel strike roll only at the edges of support.
    const roll = stance ? Math.max(0, u - 0.8) * 0.7 - Math.max(0, 0.14 - u) * 0.5 : 0.08;
    return {
      ...leg,
      travel: z,
      ankle: leg.ankle + roll,
      contact: stance ? 1 : 0,
    };
  };
  const left = foot(0);
  const right = foot(0.5);
  out.hipY = -drop + bob;
  out.hipRoll = Math.sin(phase) * 0.022 * active;
  out.hipYaw = -Math.sin(phase) * (0.035 + amount * 0.055) * active;
  out.spine = (0.025 + amount * 0.055) * forward + fatigue * 0.065;
  out.chest = -out.hipYaw * 0.2;
  out.headPitch = -amount * 0.055;
  out.legLPitch = left.pitch;
  out.legRPitch = right.pitch;
  out.legLRoll = left.roll;
  out.legRRoll = right.roll;
  out.kneeL = left.knee;
  out.kneeR = right.knee;
  out.ankleL = left.ankle;
  out.ankleR = right.ankle;
  // An arm moves opposite its own leg, rather than using an unrelated sine
  // wave. The two arms need not be exact opposites during double support.
  const armAmplitude = (0.14 + amount * 0.62) * active;
  out.armLPitch = halfStride > 0.001 ? (left.travel / halfStride) * armAmplitude : 0.04;
  out.armRPitch = halfStride > 0.001 ? (right.travel / halfStride) * armAmplitude : 0.04;
  out.armLRoll = 0.13;
  out.armRRoll = -0.13;
  out.elbowL = -0.26 - amount * 0.74 - Math.max(0, -out.armLPitch) * 0.22;
  out.elbowR = -0.26 - amount * 0.74 - Math.max(0, -out.armRPitch) * 0.22;
  if (direction) {
    const turning = clamp(direction.turnRate, -3, 3) * 0.045 * active;
    out.armLRoll += Math.max(0, -turning) + Math.abs(lateral) * 0.13;
    out.armRRoll -= Math.max(0, turning) + Math.abs(lateral) * 0.13;
    out.hipRoll += turning * 0.35;
    // Dribbling leaves one arm open to protect space, while the opposite arm
    // follows the gait. Pelvis and torso counter-rotate independently.
    if (direction.hasBall) {
      out.armLRoll += 0.13 * active;
      out.armRPitch *= 0.78;
      out.elbowL -= 0.14 * active;
    }
  }
  return {
    pose: out,
    contactL: left.contact,
    contactR: right.contact,
    strideLength: halfStride * 2,
    cadence,
  };
}

/** Actions retain the authored preparation/contact/follow-through. */
export function locomotionWeight(
  speed: number,
  action: string | null | undefined,
  clip: string,
): number {
  if (action || /dive|save|catch|jump|header|tackle|slide|fall|celebrat|gk|limp|slip/i.test(clip))
    return 0;
  return clamp((speed - 0.35) / 1.3, 0, 1);
}
