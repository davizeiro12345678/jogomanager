// ============================================================================
//  ground-contact.ts
//  Contato do pé com o gramado e travas anatômicas da pose. Funções puras.
// ============================================================================

import type { Pose } from "./animation-core";

const clamp = (v: number, lo: number, hi: number) =>
  Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : 0;

/** Limites (rad) por junta. O joelho só dobra para trás (valores negativos). */
const LIMITS: Partial<Record<keyof Pose, readonly [number, number]>> = {
  hipY: [-0.6, 0.6],
  hipPitch: [-1.2, 1.2],
  hipRoll: [-0.8, 0.8],
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

const AIRBORNE_CLIPS = new Set(["jump", "header", "dive", "fall", "celebrate"]);

/** 0 = pés no chão, 1 = no ar (o contato não puxa a raiz para baixo). */
export function airborneFactor(clip: string, hipY: number): number {
  if (!AIRBORNE_CLIPS.has(clip)) return 0;
  return clamp(0.5 + hipY * 2, 0, 1);
}

export interface GroundContactInput {
  P: { hipY: number; thigh: number; shin: number; hipH: number };
  pose: Pose;
  hipShiftX: number;
  leanX: number;
  leanZ: number;
  airborne: number;
  previousRootY: number;
  dt: number;
}

export interface GroundContactResult {
  rootY: number;
  contactL: number;
  contactR: number;
  ankleLFix: number;
  ankleRFix: number;
  stanceSpread: number;
}

/** Altura da sola relativa à raiz via cinemática direta no plano sagital. */
function footHeight(
  P: GroundContactInput["P"],
  hipY: number,
  hipPitch: number,
  legPitch: number,
  knee: number,
  lean: number,
) {
  const a1 = hipPitch + legPitch + lean;
  const a2 = a1 + knee;
  const y = P.hipY + hipY - P.hipH * 0.4 - Math.cos(a1) * P.thigh - Math.cos(a2) * P.shin;
  return { y, footAngle: a2 };
}

export function solveGroundContact(input: GroundContactInput): GroundContactResult {
  const { P, pose, leanX, leanZ, airborne, previousRootY, dt } = input;
  const l = footHeight(P, pose.hipY, pose.hipPitch, pose.legLPitch, pose.kneeL, leanX);
  const r = footHeight(P, pose.hipY, pose.hipPitch, pose.legRPitch, pose.kneeR, leanX);
  const lowest = Math.min(l.y, r.y) - Math.abs(Math.sin(leanZ)) * 0.05;
  // sola ~ à altura do tornozelo modelado; P.hipY já inclui isso em repouso
  const rest = footHeight(P, 0, 0, 0, 0, 0).y;
  const planted = clamp(rest - lowest, -0.25, 0.4);
  const target = planted * (1 - airborne) + Math.max(0, previousRootY) * airborne;
  const k = Math.min(1, dt * 20);
  const rootY = previousRootY + (target - previousRootY) * k;

  const band = 0.05;
  const contactL = clamp(1 - (l.y - lowest) / band, 0, 1) * (1 - airborne);
  const contactR = clamp(1 - (r.y - lowest) / band, 0, 1) * (1 - airborne);

  return {
    rootY: Number.isFinite(rootY) ? rootY : 0,
    contactL,
    contactR,
    ankleLFix: clamp(-l.footAngle - pose.ankleL, -0.6, 0.6) * contactL * 0.5,
    ankleRFix: clamp(-r.footAngle - pose.ankleR, -0.6, 0.6) * contactR * 0.5,
    stanceSpread: clamp(Math.abs(pose.legLPitch - pose.legRPitch) / 1.2, 0, 1),
  };
}
