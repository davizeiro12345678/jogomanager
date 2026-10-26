// ============================================================================
//  ground-contact.ts
//  Contato do pé com o gramado e travas anatômicas da pose. Funções puras.
// ============================================================================

import { JOINTS, type Pose } from "./animation-core";
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
  for (const key of JOINTS) {
    const lim = LIMITS[key];
    pose[key] = lim ? clamp(pose[key], lim[0], lim[1]) : clamp(pose[key], -Math.PI, Math.PI);
  }
  return pose;
}

const AIRBORNE_CLIPS =
  /jump|header|headClear|aerialLanding|dive|savehigh|celebrateArms|celebratejump|bicycle|volleyair/i;

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
/** Row-vector multiplication by the skeleton's Rx * Ry * Rz rotation.
 * Mutates one scratch row; no matrix or transformed point allocations. */
function rotateHeightRow(row: Point, pitch: number, yaw: number, roll: number): void {
  const cp = Math.cos(pitch),
    sp = Math.sin(pitch);
  const y = row.y * cp + row.z * sp;
  const z = -row.y * sp + row.z * cp;
  const cy = Math.cos(yaw),
    sy = Math.sin(yaw);
  const x = row.x * cy - z * sy;
  const zz = row.x * sy + z * cy;
  const cr = Math.cos(roll),
    sr = Math.sin(roll);
  row.x = x * cr + y * sr;
  row.y = -x * sr + y * cr;
  row.z = zz;
}

interface ContactFrame {
  row: Point;
  origin: number;
}
interface FootFrame extends ContactFrame {
  footAngle: number;
}

/** Root and pelvis are common to both feet and both ankle projections.
 * This frame belongs to one solve; no pose/input identity cache can go stale. */
function contactFrame(input: GroundContactInput): ContactFrame {
  const { P, pose } = input;
  const cosine = Math.cos(input.leanX);
  const row: Point = {
    x: Math.sin(input.leanZ) * cosine,
    y: Math.cos(input.leanZ) * cosine,
    z: -Math.sin(input.leanX),
  };
  const origin = row.x * input.hipShiftX + row.y * (P.hipY + pose.hipY);
  rotateHeightRow(row, pose.hipPitch, pose.hipYaw, pose.hipRoll + (input.hipRollOffset ?? 0));
  return { row, origin };
}

/** Only the ankle changes during the second ground-clearance projection. */
function footFrame(input: GroundContactInput, left: boolean, frame: ContactFrame): FootFrame {
  const { P, pose } = input;
  const pitch = left ? pose.legLPitch : pose.legRPitch;
  const roll = left ? pose.legLRoll : pose.legRRoll;
  const knee = left ? pose.kneeL : pose.kneeR;
  const row = { ...frame.row };
  let origin = frame.origin;
  origin += row.x * (left ? 1 : -1) * (P.hipW ?? 0.255) * 0.36 - row.y * P.hipH * 0.4;
  rotateHeightRow(row, pitch, 0, roll);
  origin -= row.y * P.thigh;
  rotateHeightRow(row, -knee, 0, 0);
  origin -= row.y * P.shin;
  return { row, origin, footAngle: input.leanX + pose.hipPitch + pitch - knee };
}

function projectSole(input: GroundContactInput, frame: FootFrame, ankle: number): number {
  const { P } = input;
  const cosine = Math.cos(ankle);
  const sine = Math.sin(ankle);
  // The ankle has only one rotational degree of freedom. Keep its height
  // row in scalars rather than allocating a new vector for each projection.
  const axisX = frame.row.x;
  const axisY = frame.row.y * cosine + frame.row.z * sine;
  const axisZ = -frame.row.y * sine + frame.row.z * cosine;
  const footH = P.footH ?? 0.07;
  const footLen = P.footLen ?? 0.26;
  const lateralScale = axisX * footH;
  const depthSquared = (axisY * footH * 0.045) ** 2;
  const centreY = frame.origin - axisY * footH * 0.64;
  let lowest = Infinity;
  // Every physical section remains in the projection, including the full
  // elliptical edge during lateral roll and toe reach during a planted kick.
  for (const section of SOLE_CONTACT_PROFILE) {
    const centre = centreY + axisZ * section.z * footLen;
    const radius = Math.sqrt((lateralScale * section.width) ** 2 + depthSquared);
    lowest = Math.min(lowest, centre - radius);
  }
  return lowest;
}

/** FK for sole, ankle and toe, including pelvis shift/roll and root lean. */
export function soleHeightFor(input: GroundContactInput, left: boolean, ankleDelta = 0) {
  const frame = footFrame(input, left, contactFrame(input));
  const ankle = (left ? input.pose.ankleL : input.pose.ankleR) + ankleDelta;
  return { y: projectSole(input, frame, ankle), footAngle: frame.footAngle };
}

export function solveGroundContact(input: GroundContactInput): GroundContactResult {
  const { pose, airborne, previousRootY, dt } = input;
  const frame = contactFrame(input);
  const left = footFrame(input, true, frame);
  const right = footFrame(input, false, frame);
  const l = { y: projectSole(input, left, pose.ankleL), footAngle: left.footAngle };
  const r = { y: projectSole(input, right, pose.ankleR), footAngle: right.footAngle };
  const lowest = Math.min(l.y, r.y);
  const planted = clamp(0.008 - lowest, -0.6, 0.6);
  const air = clamp(airborne, 0, 1);
  // Authored jump height already lives in pose.hipY. Accumulating the old
  // root offset in flight made repeated headers drift upwards.
  const bodyContact = clamp(input.bodyContact ?? 0, 0, 1);
  const pelvisBottom = (side: number) =>
    frame.origin +
    frame.row.x * (side * (input.P.hipW ?? 0.255) * 0.6) +
    frame.row.y * (-input.P.hipH * 0.7);
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
    const deltaL = clamp(pose.ankleL + ankleLFix, -0.9, 0.9) - pose.ankleL;
    const deltaR = clamp(pose.ankleR + ankleRFix, -0.9, 0.9) - pose.ankleR;
    // A free/already-flat ankle needs no second identical sole projection.
    const finalL = deltaL === 0 ? l.y : projectSole(input, left, pose.ankleL + deltaL);
    const finalR = deltaR === 0 ? r.y : projectSole(input, right, pose.ankleR + deltaR);
    rootY = Math.max(rootY, clamp(0.008 - Math.min(finalL, finalR), -0.6, 0.6));
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
