// ============================================================================
//  ground-contact.ts
//  Contato do pé com o gramado e travas anatômicas da pose. Funções puras.
// ============================================================================

import type { Pose } from "./animation-core";
import { SOLE_CONTACT_PROFILE } from "./boot-profile";

const clamp = (v: number, lo: number, hi: number) =>
  Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : 0;

/** Limites (rad) por junta. O joelho só dobra para trás (valores negativos). */
const LIMITS: Partial<Record<keyof Pose, readonly [number, number]>> = {
  hipY: [-0.6, 0.6],
  hipPitch: [-1.2, 1.2],
  hipRoll: [-1.35, 1.35],
  hipYaw: [-1.2, 1.2],
  spine: [-0.9, 0.9],
  chest: [-0.9, 0.9],
  headPitch: [-0.8, 0.8],
  headYaw: [-1.3, 1.3],
  armLPitch: [-3.1, 3.1],
  armLRoll: [-0.3, 3.0],
  elbowL: [-2.5, 0.1],
  armRPitch: [-3.1, 3.1],
  armRRoll: [-3.0, 0.3],
  elbowR: [-2.5, 0.1],
  legLPitch: [-2.0, 1.2],
  legLRoll: [-0.7, 0.7],
  kneeL: [-2.4, 0.02],
  ankleL: [-0.9, 0.9],
  legRPitch: [-2.0, 1.2],
  legRRoll: [-0.7, 0.7],
  kneeR: [-2.4, 0.02],
  ankleR: [-0.9, 0.9],
};

/** Trava a pose nos limites anatômicos e remove NaN (in-place). */
export function clampPoseAnatomy(pose: Pose): Pose {
  for (const key of Object.keys(pose) as (keyof Pose)[]) {
    const lim = LIMITS[key];
    pose[key] = lim ? clamp(pose[key], lim[0], lim[1]) : clamp(pose[key], -Math.PI, Math.PI);
  }
  return pose;
}

const AIRBORNE_CLIPS =
  /jump|header|headClear|dive|savehigh|celebrateArms|celebratejump|bicycle|volleyair/i;

/** 0 = pés no chão, 1 = no ar (o contato não puxa a raiz para baixo). */
export function airborneFactor(clip: string, hipY: number): number {
  if (!AIRBORNE_CLIPS.test(clip)) return 0;
  return clamp(hipY / 0.08, 0, 1);
}

export interface GroundContactInput {
  P: {
    hipY: number;
    thigh: number;
    shin: number;
    hipH: number;
    hipW?: number;
    footH?: number;
    footLen?: number;
  };
  pose: Pose;
  hipShiftX: number;
  hipRollOffset?: number;
  leanX: number;
  leanZ: number;
  airborne: number;
  previousRootY: number;
  dt: number;
  /** The free foot retains its authored orientation at ball contact. */
  plantedFoot?: "left" | "right" | undefined;
  /** Landing on the hip/seat during a slide or goalkeeper recovery. */
  bodyContact?: number | undefined;
}

export interface GroundContactResult {
  rootY: number;
  contactL: number;
  contactR: number;
  ankleLFix: number;
  ankleRFix: number;
  stanceSpread: number;
}

type Point = { x: number; y: number; z: number };
/** Same XYZ order as the skeleton's local rotations. */
function rotate(v: Point, pitch: number, yaw: number, roll: number): Point {
  const x1 = v.x * Math.cos(roll) - v.y * Math.sin(roll);
  const y1 = v.x * Math.sin(roll) + v.y * Math.cos(roll);
  const x2 = x1 * Math.cos(yaw) + v.z * Math.sin(yaw);
  const z2 = -x1 * Math.sin(yaw) + v.z * Math.cos(yaw);
  return {
    x: x2,
    y: y1 * Math.cos(pitch) - z2 * Math.sin(pitch),
    z: y1 * Math.sin(pitch) + z2 * Math.cos(pitch),
  };
}

/** FK for sole, ankle and toe. Includes pelvis shift, hip roll, leg abduction
 * and the root lean, so side steps and goalkeeping do not use a flat guess. */
export function soleHeightFor(input: GroundContactInput, left: boolean, ankleDelta = 0) {
  const { P, pose } = input;
  const pitch = left ? pose.legLPitch : pose.legRPitch;
  const roll = left ? pose.legLRoll : pose.legRRoll;
  const knee = left ? pose.kneeL : pose.kneeR;
  const ankle = (left ? pose.ankleL : pose.ankleR) + ankleDelta;
  const footH = P.footH ?? 0.07;
  const footLen = P.footLen ?? 0.26;
  const transform = (point: Point) => {
    let v = rotate(point, ankle, 0, 0);
    v.y -= P.shin;
    v = rotate(v, -knee, 0, 0);
    v.y -= P.thigh;
    v = rotate(v, pitch, 0, roll);
    v.x += (left ? 1 : -1) * (P.hipW ?? 0.255) * 0.36;
    v.y -= P.hipH * 0.4;
    v = rotate(v, pose.hipPitch, pose.hipYaw, pose.hipRoll + (input.hipRollOffset ?? 0));
    v.x += input.hipShiftX;
    v.y += P.hipY + pose.hipY;
    // YXZ root yaw has no effect on height: roll then pitch are sufficient.
    return rotate(v, input.leanX, 0, input.leanZ).y;
  };
  const origin = transform({ x: 0, y: 0, z: 0 });
  const axisX = transform({ x: 1, y: 0, z: 0 }) - origin;
  const axisY = transform({ x: 0, y: 1, z: 0 }) - origin;
  const axisZ = transform({ x: 0, y: 0, z: 1 }) - origin;
  const lateralScale = axisX * footH;
  const depthSquared = (axisY * footH * 0.045) ** 2;
  const centreY = origin - axisY * footH * 0.64;
  let lowest = Infinity;
  // Project each real elliptical sole section. This includes its outer edge
  // during lateral roll and its full toe reach during a planted kick.
  for (const section of SOLE_CONTACT_PROFILE) {
    const centre = centreY + axisZ * section.z * footLen;
    const radius = Math.sqrt((lateralScale * section.width) ** 2 + depthSquared);
    lowest = Math.min(lowest, centre - radius);
  }
  const angle = input.leanX + pose.hipPitch + pitch - knee;
  return { y: lowest, footAngle: angle };
}

export function solveGroundContact(input: GroundContactInput): GroundContactResult {
  const { pose, airborne, previousRootY, dt } = input;
  const l = soleHeightFor(input, true);
  const r = soleHeightFor(input, false);
  const lowest = Math.min(l.y, r.y);
  const planted = clamp(0.008 - lowest, -0.6, 0.6);
  const air = clamp(airborne, 0, 1);
  // Authored jump height already lives in pose.hipY. Accumulating the old
  // root offset in flight made repeated headers drift upwards.
  const bodyContact = clamp(input.bodyContact ?? 0, 0, 1);
  const pelvisBottom = (side: number) => {
    const point = rotate(
      { x: side * (input.P.hipW ?? 0.255) * 0.6, y: -input.P.hipH * 0.7, z: 0 },
      pose.hipPitch,
      pose.hipYaw,
      pose.hipRoll + (input.hipRollOffset ?? 0),
    );
    point.x += input.hipShiftX;
    point.y += input.P.hipY + pose.hipY;
    return rotate(point, input.leanX, 0, input.leanZ).y;
  };
  const bodyPlanted =
    bodyContact > 0
      ? clamp(0.012 - Math.min(pelvisBottom(-1), pelvisBottom(1)), -1.2, 0.6)
      : planted;
  // Feet remain protected against penetration while the seat/side of the
  // pelvis becomes the support surface. Flight remains an authored offset.
  const supported = planted + (Math.max(planted, bodyPlanted) - planted) * bodyContact;
  const target = supported * (1 - air);
  const k = 1 - Math.exp(-20 * Math.max(0, dt));
  const eased = previousRootY + (target - previousRootY) * k;
  // Ground penetration must be corrected immediately; upward/downward
  // suspension can settle smoothly when the sole has clearance.
  let rootY = air < 0.1 ? Math.max(eased, supported) : eased;

  const band = 0.05;
  const contactL =
    clamp(1 - Math.max(0, l.y + rootY - 0.008) / band, 0, 1) *
    (1 - air) *
    (input.plantedFoot === "right" ? 0 : 1);
  const contactR =
    clamp(1 - Math.max(0, r.y + rootY - 0.008) / band, 0, 1) *
    (1 - air) *
    (input.plantedFoot === "left" ? 0 : 1);

  const ankleLFix = clamp(-l.footAngle - pose.ankleL, -0.6, 0.6) * contactL * 0.5;
  const ankleRFix = clamp(-r.footAngle - pose.ankleR, -0.6, 0.6) * contactR * 0.5;
  // Flattening the sole changes toe/heel clearance. Measure the final ankle
  // angle after its anatomical clamp, before placing the root.
  if (air < 0.1) {
    const finalL = soleHeightFor(
      input,
      true,
      clamp(pose.ankleL + ankleLFix, -0.9, 0.9) - pose.ankleL,
    );
    const finalR = soleHeightFor(
      input,
      false,
      clamp(pose.ankleR + ankleRFix, -0.9, 0.9) - pose.ankleR,
    );
    rootY = Math.max(rootY, clamp(0.008 - Math.min(finalL.y, finalR.y), -0.6, 0.6));
  }

  return {
    rootY: Number.isFinite(rootY) ? rootY : 0,
    contactL,
    contactR,
    ankleLFix,
    ankleRFix,
    stanceSpread: clamp(Math.abs(pose.legLPitch - pose.legRPitch) / 1.2, 0, 1),
  };
}
