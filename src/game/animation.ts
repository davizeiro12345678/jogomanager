// Sistema de animação procedural dos jogadores (148 clipes).
// Cada clipe devolve ângulos por articulação; a malha 3D aplica com blend suave.
//
// Os tipos e utilidades vivem em `animation-core.ts` e os 89 clipes novos em
// `animation-extra.ts`; aqui ficam os clipes base e a máquina de estados.

import { EXTRA_CLIPS } from "./animation-extra";
import {
  JOINTS,
  emptyPose,
  mixPose,
  type Clip,
  type ClipCtx,
  type JointName,
  type Pose,
} from "./animation-core";

export { JOINTS, emptyPose, mixPose };
export type { Clip, ClipCtx, JointName, Pose };

function pose(partial: Partial<Pose>): Pose {
  const p = emptyPose();
  Object.assign(p, partial);
  return p;
}

const sin = Math.sin;
const cos = Math.cos;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
/** curva de impacto: sobe, bate e volta */
const hit = (u: number, peak = 0.45) =>
  u < peak ? u / peak : 1 - clamp01((u - peak) / (1 - peak));
const ease = (u: number) => u * u * (3 - 2 * u);

/** ciclo genérico de passada (caminhar / correr / sprintar) */
function gait(c: ClipCtx, opts: { rate: number; amp: number; knee: number; armAmp: number; lean: number; bob: number }): Pose {
  const t = c.t * opts.rate + c.seed;
  const s = sin(t);
  const s2 = sin(t + Math.PI);
  return pose({
    hipY: Math.abs(sin(t * 2)) * opts.bob,
    hipPitch: opts.lean,
    hipRoll: sin(t) * 0.04,
    hipYaw: -s * 0.08,
    spine: opts.lean * 0.5,
    chest: sin(t * 2) * 0.04,
    headPitch: -opts.lean * 0.7,
    legLPitch: s * opts.amp,
    legRPitch: s2 * opts.amp,
    kneeL: -clamp01(-s + 0.35) * opts.knee,
    kneeR: -clamp01(-s2 + 0.35) * opts.knee,
    ankleL: s * 0.25,
    ankleR: s2 * 0.25,
    armLPitch: s2 * opts.armAmp,
    armRPitch: s * opts.armAmp,
    elbowL: -0.5 - Math.abs(s2) * 0.5,
    elbowR: -0.5 - Math.abs(s) * 0.5,
    armLRoll: 0.14,
    armRRoll: -0.14,
  });
}

/** pose base em pé, com respiração */
function idleBase(c: ClipCtx, k = 1): Pose {
  const b = sin(c.t * 1.5 + c.seed) * 0.02 * k;
  return pose({
    hipY: b * 0.5,
    spine: 0.05 + b,
    chest: 0.03,
    headPitch: -0.02,
    armLPitch: 0.06,
    armRPitch: 0.06,
    armLRoll: 0.16,
    armRRoll: -0.16,
    elbowL: -0.32,
    elbowR: -0.32,
    kneeL: -0.06,
    kneeR: -0.06,
  });
}

// ---------------------------------------------------------------- clipes

const CLIPS: Record<string, Clip> = {
  // ---- locomoção (12)
  idle: (c) => idleBase(c),
  breathe: (c) => mixPose(idleBase(c), pose({ chest: 0.1, spine: 0.1, headPitch: 0.06 }), 0.4 + sin(c.t * 1.2) * 0.3),
  weightShift: (c) =>
    mixPose(idleBase(c), pose({ hipRoll: sin(c.t * 0.8 + c.seed) * 0.12, hipYaw: sin(c.t * 0.5) * 0.1, kneeL: -0.2 }), 0.6),
  walk: (c) => gait(c, { rate: 4.4, amp: 0.42, knee: 0.7, armAmp: 0.3, lean: 0.05, bob: 0.02 }),
  jog: (c) => gait(c, { rate: 7, amp: 0.6, knee: 1.05, armAmp: 0.55, lean: 0.12, bob: 0.035 }),
  run: (c) => gait(c, { rate: 9, amp: 0.78, knee: 1.35, armAmp: 0.8, lean: 0.2, bob: 0.05 }),
  sprint: (c) => gait(c, { rate: 11.5, amp: 0.95, knee: 1.65, armAmp: 1.05, lean: 0.32, bob: 0.06 }),
  decelerate: (c) =>
    mixPose(gait(c, { rate: 5, amp: 0.5, knee: 0.9, armAmp: 0.5, lean: -0.12, bob: 0.02 }), pose({ hipPitch: -0.22, legLPitch: 0.5, kneeR: -0.7, armLRoll: 0.6, armRRoll: -0.6 }), 0.5),
  turn: (c) =>
    mixPose(gait(c, { rate: 7, amp: 0.5, knee: 1, armAmp: 0.5, lean: 0.1, bob: 0.03 }), pose({ hipYaw: 0.35, hipRoll: 0.14, chest: -0.12, headYaw: 0.3 }), 0.6),
  sideStep: (c) =>
    pose({
      hipY: Math.abs(sin(c.t * 6)) * 0.03,
      hipRoll: sin(c.t * 6) * 0.1,
      legLPitch: 0.1,
      legRPitch: 0.1,
      legLRoll: 0.2 + sin(c.t * 6) * 0.18,
      legRRoll: -0.2 - sin(c.t * 6) * 0.18,
      kneeL: -0.4,
      kneeR: -0.4,
      armLRoll: 0.5,
      armRRoll: -0.5,
      elbowL: -0.7,
      elbowR: -0.7,
      spine: 0.12,
    }),
  backpedal: (c) =>
    mixPose(gait(c, { rate: 6.5, amp: 0.45, knee: 0.9, armAmp: 0.45, lean: -0.16, bob: 0.03 }), pose({ headPitch: 0.12, chest: -0.1 }), 0.5),
  tired: (c) =>
    mixPose(gait(c, { rate: 5, amp: 0.4, knee: 0.8, armAmp: 0.25, lean: 0.28, bob: 0.02 }), pose({ spine: 0.4, headPitch: 0.3, armLRoll: 0.4, armRRoll: -0.4, elbowL: -1.1, elbowR: -1.1 }), 0.55),

  // ---- com a bola (10)
  dribbleLight: (c) => mixPose(gait(c, { rate: 6, amp: 0.5, knee: 1, armAmp: 0.4, lean: 0.14, bob: 0.03 }), pose({ headPitch: 0.22, spine: 0.16 }), 0.5),
  dribbleFast: (c) => mixPose(gait(c, { rate: 10, amp: 0.85, knee: 1.4, armAmp: 0.9, lean: 0.28, bob: 0.05 }), pose({ headPitch: 0.16 }), 0.35),
  feint: (c) =>
    pose({
      hipRoll: sin(c.t * 9) * 0.28,
      hipYaw: sin(c.t * 9 + 1) * 0.3,
      chest: -0.1,
      spine: 0.18,
      legLPitch: sin(c.t * 9) * 0.5,
      legRPitch: -sin(c.t * 9) * 0.5,
      kneeL: -0.7,
      kneeR: -0.7,
      armLRoll: 0.6,
      armRRoll: -0.6,
      elbowL: -0.8,
      elbowR: -0.8,
      headPitch: 0.2,
    }),
  cut: (c) =>
    pose({
      hipRoll: 0.3 * hit(c.u),
      hipYaw: 0.4 * hit(c.u),
      spine: 0.24,
      legLPitch: 0.6 * hit(c.u),
      kneeR: -1.1 * hit(c.u),
      ankleL: 0.3,
      armLRoll: 0.7,
      armRRoll: -0.35,
      headYaw: 0.3 * hit(c.u),
    }),
  stepover: (c) => {
    const p = c.t * 8 + c.seed;
    return pose({
      hipRoll: sin(p) * 0.16,
      spine: 0.2,
      legLPitch: 0.35 + sin(p) * 0.5,
      legLRoll: 0.4 + cos(p) * 0.35,
      kneeL: -1.2,
      legRPitch: -0.1,
      kneeR: -0.35,
      armLRoll: 0.7,
      armRRoll: -0.7,
      headPitch: 0.24,
    });
  },
  elastico: (c) =>
    pose({
      hipYaw: sin(c.u * Math.PI * 2) * 0.35,
      hipRoll: cos(c.u * Math.PI * 2) * 0.2,
      spine: 0.22,
      legRPitch: 0.5 * hit(c.u, 0.3),
      legRRoll: -0.5 * sin(c.u * Math.PI * 2),
      kneeR: -1.3 * hit(c.u, 0.3),
      armLRoll: 0.8,
      armRRoll: -0.5,
      headPitch: 0.26,
    }),
  passShort: (c) =>
    pose({
      hipYaw: -0.18 * hit(c.u),
      spine: 0.1,
      chest: -0.08 * hit(c.u),
      legRPitch: -0.35 + 1.0 * hit(c.u, 0.4),
      legRRoll: -0.35 * hit(c.u),
      kneeR: -0.7 + 0.55 * hit(c.u, 0.4),
      ankleR: -0.3 * hit(c.u),
      legLPitch: 0.12,
      kneeL: -0.22,
      armLPitch: -0.5 * hit(c.u),
      armLRoll: 0.75,
      armRRoll: -0.4,
      elbowL: -0.6,
      headPitch: 0.18,
    }),
  passLong: (c) =>
    pose({
      hipYaw: -0.26 * hit(c.u),
      spine: -0.12 * hit(c.u),
      chest: -0.16 * hit(c.u),
      legRPitch: -0.7 + 1.7 * hit(c.u, 0.42),
      kneeR: -1.1 + 1.0 * hit(c.u, 0.42),
      ankleR: -0.35,
      legLPitch: 0.2,
      kneeL: -0.3,
      armLPitch: -1.1 * hit(c.u),
      armLRoll: 0.9,
      armRPitch: 0.5 * hit(c.u),
      armRRoll: -0.6,
      headPitch: 0.05,
    }),
  cross: (c) =>
    pose({
      hipYaw: -0.4 * hit(c.u),
      hipRoll: -0.16 * hit(c.u),
      spine: -0.1,
      legRPitch: -0.6 + 1.5 * hit(c.u, 0.42),
      legRRoll: -0.6 * hit(c.u),
      kneeR: -0.9 + 0.85 * hit(c.u, 0.42),
      legLPitch: 0.3,
      kneeL: -0.45,
      armLPitch: -1.3 * hit(c.u),
      armLRoll: 1.1,
      armRRoll: -0.8,
      headPitch: 0.02,
    }),
  trap: (c) =>
    pose({
      hipY: -0.05 * hit(c.u),
      spine: 0.26,
      headPitch: 0.4,
      legRPitch: 0.55 * hit(c.u),
      kneeR: -0.6,
      ankleR: 0.4 * hit(c.u),
      kneeL: -0.35,
      armLRoll: 0.7,
      armRRoll: -0.7,
      elbowL: -0.8,
      elbowR: -0.8,
    }),

  // ---- finalização (8)
  shotLow: (c) =>
    pose({
      hipYaw: -0.3 * hit(c.u, 0.4),
      spine: 0.12 * hit(c.u),
      chest: -0.14,
      legRPitch: -0.9 + 2.1 * hit(c.u, 0.4),
      kneeR: -1.3 + 1.3 * hit(c.u, 0.4),
      ankleR: -0.4,
      legLPitch: 0.25,
      kneeL: -0.4,
      armLPitch: -1.2 * hit(c.u),
      armLRoll: 0.9,
      armRPitch: 0.6 * hit(c.u),
      armRRoll: -0.7,
      headPitch: 0.1,
    }),
  shotPower: (c) =>
    pose({
      hipY: 0.06 * hit(c.u, 0.55),
      hipYaw: -0.42 * hit(c.u, 0.4),
      spine: -0.24 * hit(c.u, 0.3) + 0.2 * clamp01((c.u - 0.5) * 2),
      chest: -0.2,
      legRPitch: -1.25 + 2.7 * hit(c.u, 0.4),
      kneeR: -1.6 + 1.6 * hit(c.u, 0.4),
      ankleR: -0.5,
      legLPitch: 0.35,
      kneeL: -0.5,
      armLPitch: -1.7 * hit(c.u),
      armLRoll: 1.15,
      armRPitch: 0.9 * hit(c.u),
      armRRoll: -0.9,
      headPitch: 0.14,
    }),
  shotPlaced: (c) =>
    pose({
      hipYaw: -0.24 * hit(c.u, 0.45),
      spine: 0.1,
      legRPitch: -0.6 + 1.5 * hit(c.u, 0.45),
      legRRoll: -0.45 * hit(c.u),
      kneeR: -0.9 + 0.8 * hit(c.u, 0.45),
      legLPitch: 0.2,
      kneeL: -0.35,
      armLPitch: -0.9 * hit(c.u),
      armLRoll: 0.8,
      armRRoll: -0.6,
      headPitch: 0.16,
    }),
  chip: (c) =>
    pose({
      spine: -0.2 * hit(c.u),
      legRPitch: -0.4 + 1.0 * hit(c.u, 0.35),
      kneeR: -0.5,
      ankleR: 0.55 * hit(c.u),
      legLPitch: 0.18,
      kneeL: -0.3,
      armLPitch: -0.8 * hit(c.u),
      armLRoll: 0.85,
      armRRoll: -0.7,
      headPitch: 0.05,
    }),
  volley: (c) =>
    pose({
      hipY: 0.28 * hit(c.u, 0.5),
      hipRoll: -0.4 * hit(c.u, 0.5),
      spine: -0.3 * hit(c.u, 0.5),
      legRPitch: -0.3 + 1.2 * hit(c.u, 0.45),
      legRRoll: -1.0 * hit(c.u, 0.45),
      kneeR: -0.5,
      legLPitch: -0.5 * hit(c.u, 0.5),
      kneeL: -1.0 * hit(c.u, 0.5),
      armLPitch: -1.6 * hit(c.u, 0.5),
      armLRoll: 1.3,
      armRPitch: -1.2 * hit(c.u, 0.5),
      armRRoll: -1.3,
      headPitch: -0.15,
    }),
  bicycle: (c) =>
    pose({
      hipY: 0.75 * hit(c.u, 0.5),
      hipPitch: -1.9 * hit(c.u, 0.5),
      spine: -0.4 * hit(c.u, 0.5),
      legRPitch: -1.9 * hit(c.u, 0.42),
      kneeR: -0.3,
      legLPitch: 1.1 * hit(c.u, 0.55),
      kneeL: -1.0,
      armLPitch: -2.4 * hit(c.u, 0.5),
      armRPitch: -2.4 * hit(c.u, 0.5),
      armLRoll: 0.8,
      armRRoll: -0.8,
      headPitch: -0.4,
    }),
  header: (c) =>
    pose({
      hipY: 0.55 * hit(c.u, 0.5),
      spine: -0.35 * hit(c.u, 0.35) + 0.45 * clamp01((c.u - 0.45) * 2.4),
      chest: -0.2 * hit(c.u, 0.35),
      headPitch: -0.4 * hit(c.u, 0.35) + 0.5 * clamp01((c.u - 0.45) * 2.4),
      legLPitch: -0.5 * hit(c.u, 0.5),
      legRPitch: 0.35 * hit(c.u, 0.5),
      kneeL: -1.1 * hit(c.u, 0.5),
      kneeR: -0.5,
      armLPitch: -1.5 * hit(c.u, 0.5),
      armRPitch: -1.5 * hit(c.u, 0.5),
      armLRoll: 0.9,
      armRRoll: -0.9,
    }),
  firstTime: (c) =>
    pose({
      hipYaw: -0.34 * hit(c.u, 0.35),
      spine: -0.1,
      legRPitch: -0.5 + 1.9 * hit(c.u, 0.3),
      kneeR: -1.1 + 1.1 * hit(c.u, 0.3),
      ankleR: -0.4,
      legLPitch: 0.3,
      kneeL: -0.45,
      armLPitch: -1.3 * hit(c.u, 0.3),
      armLRoll: 1.0,
      armRRoll: -0.8,
    }),

  // ---- defesa (8)
  mark: (c) =>
    pose({
      hipY: -0.1,
      spine: 0.24,
      hipRoll: sin(c.t * 3 + c.seed) * 0.07,
      kneeL: -0.55,
      kneeR: -0.55,
      legLPitch: 0.22,
      legRPitch: 0.16,
      legLRoll: 0.16,
      legRRoll: -0.16,
      armLRoll: 0.75,
      armRRoll: -0.75,
      elbowL: -0.7,
      elbowR: -0.7,
      headPitch: 0.16,
    }),
  slideTackle: (c) =>
    pose({
      hipY: -0.62 * ease(clamp01(c.u * 2)),
      hipPitch: -0.5 * ease(clamp01(c.u * 2)),
      hipRoll: 0.6 * ease(clamp01(c.u * 2)),
      spine: 0.3,
      legLPitch: 1.35 * ease(clamp01(c.u * 2)),
      kneeL: -0.2,
      legRPitch: -0.2,
      kneeR: -1.5 * ease(clamp01(c.u * 2)),
      armLPitch: -1.2,
      armRPitch: 0.9,
      armLRoll: 1.0,
      armRRoll: -0.5,
      headPitch: 0.1,
    }),
  standTackle: (c) =>
    pose({
      hipY: -0.16,
      spine: 0.34,
      legRPitch: 0.95 * hit(c.u, 0.4),
      kneeR: -0.5,
      ankleR: -0.2,
      kneeL: -0.7,
      armLRoll: 0.9,
      armRRoll: -0.9,
      elbowL: -0.6,
      elbowR: -0.6,
      headPitch: 0.24,
    }),
  block: (c) =>
    pose({
      hipY: -0.2 * hit(c.u, 0.4),
      spine: 0.4,
      legLPitch: 0.5,
      legRPitch: 0.5,
      legLRoll: 0.28,
      legRRoll: -0.28,
      kneeL: -0.85,
      kneeR: -0.85,
      armLPitch: -0.4,
      armRPitch: -0.4,
      armLRoll: 1.15,
      armRRoll: -1.15,
      elbowL: -0.3,
      elbowR: -0.3,
      headPitch: 0.34,
    }),
  headClear: (c) =>
    pose({
      hipY: 0.5 * hit(c.u, 0.45),
      spine: -0.45 * hit(c.u, 0.35) + 0.3 * clamp01((c.u - 0.45) * 2.4),
      headPitch: -0.55 * hit(c.u, 0.35),
      legLPitch: -0.4 * hit(c.u, 0.45),
      kneeL: -1.0 * hit(c.u, 0.45),
      kneeR: -0.6,
      armLPitch: -1.9 * hit(c.u, 0.45),
      armRPitch: -1.9 * hit(c.u, 0.45),
      armLRoll: 0.7,
      armRRoll: -0.7,
    }),
  shoulderDuel: (c) =>
    pose({
      hipRoll: 0.3,
      spine: 0.28,
      chest: 0.16,
      hipYaw: -0.2,
      legLPitch: 0.35,
      legRPitch: -0.2,
      kneeL: -0.7,
      kneeR: -0.5,
      armLPitch: -0.5,
      armLRoll: 1.25,
      elbowL: -1.1,
      armRRoll: -0.4,
      headYaw: -0.3,
      headPitch: 0.1,
    }),
  intercept: (c) =>
    pose({
      hipY: -0.08,
      hipYaw: 0.3 * hit(c.u, 0.4),
      spine: 0.26,
      legLPitch: 0.9 * hit(c.u, 0.4),
      legLRoll: 0.4 * hit(c.u, 0.4),
      kneeL: -0.45,
      kneeR: -0.8,
      armLPitch: -0.9 * hit(c.u),
      armLRoll: 1.0,
      armRRoll: -0.9,
      headPitch: 0.2,
    }),
  recover: (c) => mixPose(gait(c, { rate: 10, amp: 0.85, knee: 1.4, armAmp: 0.9, lean: 0.3, bob: 0.05 }), pose({ headYaw: sin(c.t * 2) * 0.35 }), 0.4),

  // ---- goleiro (8)
  gkStance: (c) =>
    pose({
      hipY: -0.16,
      spine: 0.3,
      hipRoll: sin(c.t * 2.4 + c.seed) * 0.05,
      legLPitch: 0.2,
      legRPitch: 0.2,
      legLRoll: 0.26,
      legRRoll: -0.26,
      kneeL: -0.7,
      kneeR: -0.7,
      armLPitch: -0.55,
      armRPitch: -0.55,
      armLRoll: 1.0,
      armRRoll: -1.0,
      elbowL: -0.9,
      elbowR: -0.9,
      headPitch: 0.18,
    }),
  gkShuffle: (c) =>
    pose({
      hipY: -0.18 + Math.abs(sin(c.t * 7)) * 0.05,
      spine: 0.3,
      hipRoll: sin(c.t * 7) * 0.12,
      legLRoll: 0.32 + sin(c.t * 7) * 0.2,
      legRRoll: -0.32 - sin(c.t * 7) * 0.2,
      kneeL: -0.75,
      kneeR: -0.75,
      armLPitch: -0.6,
      armRPitch: -0.6,
      armLRoll: 1.05,
      armRRoll: -1.05,
      elbowL: -0.8,
      elbowR: -0.8,
      headPitch: 0.16,
    }),
  gkSaveLow: (c) =>
    pose({
      hipY: -0.6 * ease(clamp01(c.u * 2.2)),
      hipPitch: 0.5 * ease(clamp01(c.u * 2.2)),
      spine: 0.5,
      legLPitch: 0.8,
      legRPitch: 0.5,
      kneeL: -1.4,
      kneeR: -1.2,
      armLPitch: -0.2,
      armRPitch: -0.2,
      armLRoll: 1.35,
      armRRoll: -1.35,
      headPitch: 0.45,
    }),
  gkSaveHigh: (c) =>
    pose({
      hipY: 0.5 * hit(c.u, 0.5),
      spine: -0.35 * hit(c.u, 0.5),
      armLPitch: -2.6 * hit(c.u, 0.5),
      armRPitch: -2.6 * hit(c.u, 0.5),
      armLRoll: 0.5,
      armRRoll: -0.5,
      elbowL: -0.15,
      elbowR: -0.15,
      legLPitch: -0.35 * hit(c.u, 0.5),
      legRPitch: 0.3 * hit(c.u, 0.5),
      kneeL: -0.9,
      kneeR: -0.5,
      headPitch: -0.35,
    }),
  gkDiveLeft: (c) =>
    pose({
      hipY: 0.35 * hit(c.u, 0.45) - 0.35 * clamp01((c.u - 0.6) * 2.5),
      hipRoll: 1.35 * ease(clamp01(c.u * 1.8)),
      hipPitch: -0.25,
      spine: -0.2,
      armLPitch: -2.0 * ease(clamp01(c.u * 1.8)),
      armLRoll: 0.9,
      elbowL: -0.1,
      armRPitch: -0.9,
      armRRoll: -0.7,
      legLPitch: -0.4,
      legRPitch: 0.35,
      kneeL: -0.5,
      kneeR: -0.9,
      headYaw: 0.3,
    }),
  gkDiveRight: (c) =>
    pose({
      hipY: 0.35 * hit(c.u, 0.45) - 0.35 * clamp01((c.u - 0.6) * 2.5),
      hipRoll: -1.35 * ease(clamp01(c.u * 1.8)),
      hipPitch: -0.25,
      spine: -0.2,
      armRPitch: -2.0 * ease(clamp01(c.u * 1.8)),
      armRRoll: -0.9,
      elbowR: -0.1,
      armLPitch: -0.9,
      armLRoll: 0.7,
      legRPitch: -0.4,
      legLPitch: 0.35,
      kneeR: -0.5,
      kneeL: -0.9,
      headYaw: -0.3,
    }),
  gkCatch: (c) =>
    pose({
      hipY: -0.12 + 0.18 * hit(c.u, 0.4),
      spine: 0.2 - 0.2 * hit(c.u, 0.4),
      armLPitch: -1.5 * hit(c.u, 0.4),
      armRPitch: -1.5 * hit(c.u, 0.4),
      armLRoll: 0.55,
      armRRoll: -0.55,
      elbowL: -0.75 - 0.5 * clamp01((c.u - 0.5) * 2),
      elbowR: -0.75 - 0.5 * clamp01((c.u - 0.5) * 2),
      kneeL: -0.6,
      kneeR: -0.6,
      headPitch: -0.1,
    }),
  gkDistribute: (c) =>
    pose({
      hipYaw: -0.35 * hit(c.u, 0.45),
      spine: -0.22 * hit(c.u, 0.35),
      legRPitch: -1.0 + 2.2 * hit(c.u, 0.45),
      kneeR: -1.3 + 1.3 * hit(c.u, 0.45),
      legLPitch: 0.3,
      kneeL: -0.45,
      armLPitch: -1.5 * hit(c.u, 0.45),
      armLRoll: 1.0,
      armRPitch: 0.8 * hit(c.u, 0.45),
      armRRoll: -0.8,
    }),

  // ---- bola parada e jogo (7)
  goalKick: (c) =>
    pose({
      hipY: 0.05 * hit(c.u, 0.55),
      hipYaw: -0.4 * hit(c.u, 0.45),
      spine: -0.3 * hit(c.u, 0.4) + 0.2 * clamp01((c.u - 0.55) * 2),
      legRPitch: -1.4 + 2.9 * hit(c.u, 0.45),
      kneeR: -1.6 + 1.6 * hit(c.u, 0.45),
      legLPitch: 0.4,
      kneeL: -0.5,
      armLPitch: -1.8 * hit(c.u, 0.45),
      armLRoll: 1.2,
      armRPitch: 1.0 * hit(c.u, 0.45),
      armRRoll: -1.0,
    }),
  throwIn: (c) =>
    pose({
      spine: -0.45 * hit(c.u, 0.45) + 0.3 * clamp01((c.u - 0.5) * 2),
      chest: -0.2 * hit(c.u, 0.45),
      armLPitch: -2.7 + 1.6 * clamp01((c.u - 0.45) * 2),
      armRPitch: -2.7 + 1.6 * clamp01((c.u - 0.45) * 2),
      armLRoll: 0.35,
      armRRoll: -0.35,
      elbowL: -0.4,
      elbowR: -0.4,
      legLPitch: 0.3,
      legRPitch: -0.2,
      kneeL: -0.4,
      kneeR: -0.3,
      headPitch: -0.15,
    }),
  cornerKick: (c) =>
    pose({
      hipYaw: -0.45 * hit(c.u, 0.5),
      spine: -0.18,
      legRPitch: -1.2 + 2.5 * hit(c.u, 0.5),
      legRRoll: -0.5 * hit(c.u, 0.5),
      kneeR: -1.4 + 1.4 * hit(c.u, 0.5),
      legLPitch: 0.35,
      kneeL: -0.45,
      armLPitch: -1.6 * hit(c.u, 0.5),
      armLRoll: 1.15,
      armRRoll: -0.9,
    }),
  freeKick: (c) =>
    pose({
      hipY: -0.04,
      hipYaw: -0.3 * hit(c.u, 0.5),
      spine: 0.1 - 0.25 * hit(c.u, 0.4),
      legRPitch: -1.1 + 2.3 * hit(c.u, 0.5),
      kneeR: -1.4 + 1.4 * hit(c.u, 0.5),
      legLPitch: 0.3,
      kneeL: -0.4,
      armLPitch: -1.4 * hit(c.u, 0.5),
      armLRoll: 1.1,
      armRPitch: 0.7 * hit(c.u, 0.5),
      armRRoll: -0.9,
      headPitch: 0.12,
    }),
  penalty: (c) =>
    pose({
      hipYaw: -0.22 * hit(c.u, 0.6),
      spine: 0.12 - 0.16 * hit(c.u, 0.55),
      legRPitch: -0.8 + 2.0 * hit(c.u, 0.6),
      kneeR: -1.2 + 1.2 * hit(c.u, 0.6),
      legLPitch: 0.25,
      kneeL: -0.35,
      armLPitch: -1.1 * hit(c.u, 0.6),
      armLRoll: 0.95,
      armRRoll: -0.75,
      headPitch: 0.2,
    }),
  whistleStop: (c) =>
    mixPose(idleBase(c, 0.6), pose({ hipRoll: 0.06, armLRoll: 0.3, armRRoll: -0.3, headYaw: sin(c.t * 0.9) * 0.35, spine: 0.08 }), 0.7),
  restart: (c) =>
    mixPose(idleBase(c, 0.5), pose({ legLPitch: 0.18, kneeL: -0.3, armLRoll: 0.4, armRRoll: -0.4, headPitch: 0.12, hipRoll: sin(c.t * 1.6) * 0.08 }), 0.75),

  // ---- reações (6)
  celebrateArms: (c) =>
    pose({
      hipY: Math.abs(sin(c.t * 6 + c.seed)) * 0.22,
      spine: -0.2,
      chest: -0.14,
      headPitch: -0.3,
      armLPitch: -2.5,
      armRPitch: -2.5,
      armLRoll: 0.85,
      armRRoll: -0.85,
      elbowL: -0.15,
      elbowR: -0.15,
      legLPitch: sin(c.t * 6) * 0.3,
      legRPitch: -sin(c.t * 6) * 0.3,
      kneeL: -0.35,
      kneeR: -0.35,
    }),
  celebrateRun: (c) =>
    mixPose(gait(c, { rate: 10, amp: 0.8, knee: 1.3, armAmp: 0.3, lean: 0.1, bob: 0.06 }), pose({ armLPitch: -2.2, armRPitch: -2.2, armLRoll: 1.1, armRRoll: -1.1, headPitch: -0.25, elbowL: -0.2, elbowR: -0.2 }), 0.65),
  kneeSlide: (c) =>
    pose({
      hipY: -0.42,
      hipPitch: -0.35,
      spine: -0.3,
      headPitch: -0.4,
      legLPitch: 1.3,
      legRPitch: 1.3,
      kneeL: -1.7,
      kneeR: -1.7,
      armLPitch: -2.4,
      armRPitch: -2.4,
      armLRoll: 1.0,
      armRRoll: -1.0,
      hipRoll: sin(c.t * 4) * 0.08,
    }),
  groupHug: (c) =>
    pose({
      hipY: Math.abs(sin(c.t * 4)) * 0.06,
      spine: 0.14,
      chest: 0.1,
      armLPitch: -1.3,
      armRPitch: -1.3,
      armLRoll: 1.35,
      armRRoll: -1.35,
      elbowL: -1.5,
      elbowR: -1.5,
      headPitch: 0.1,
      headYaw: sin(c.t * 2) * 0.2,
      kneeL: -0.3,
      kneeR: -0.3,
    }),
  dejected: (c) =>
    pose({
      spine: 0.45,
      chest: 0.2,
      headPitch: 0.55,
      armLPitch: -0.9,
      armRPitch: -0.9,
      armLRoll: 0.9,
      armRRoll: -0.9,
      elbowL: -1.9,
      elbowR: -1.9,
      hipY: -0.06 + sin(c.t * 1.4) * 0.02,
      kneeL: -0.25,
      kneeR: -0.25,
    }),
  protest: (c) =>
    pose({
      spine: -0.12,
      chest: -0.1,
      headPitch: -0.2,
      headYaw: sin(c.t * 3.4) * 0.28,
      armLPitch: -1.5 + sin(c.t * 5) * 0.5,
      armRPitch: -1.5 - sin(c.t * 5) * 0.5,
      armLRoll: 1.25,
      armRRoll: -1.25,
      elbowL: -1.4,
      elbowR: -1.4,
      hipRoll: sin(c.t * 2.2) * 0.08,
    }),
};

export type ClipName = keyof typeof CLIPS;

export const CLIP_NAMES = Object.keys(CLIPS) as ClipName[];
/** número total de animações disponíveis (59) */
export const CLIP_COUNT = CLIP_NAMES.length;

export function getClip(name: ClipName): Clip {
  return CLIPS[name] ?? CLIPS['idle']!;
}

// ------------------------------------------------------ máquina de estados

export type PlayerAction =
  | "shot"
  | "shotPower"
  | "shotPlaced"
  | "bicycle"
  | "headClear"
  | "duel"
  | "decelerate"
  | "turn"
  | "backpedal"
  | "chip"
  | "volley"
  | "header"
  | "firstTime"
  | "pass"
  | "passLong"
  | "cross"
  | "trap"
  | "tackle"
  | "slide"
  | "block"
  | "intercept"
  | "save"
  | "saveHigh"
  | "diveLeft"
  | "diveRight"
  | "catch"
  | "distribute"
  | "goalKick"
  | "throwIn"
  | "corner"
  | "freeKick"
  | "penalty"
  | "celebrate"
  | "celebrateRun"
  | "kneeSlide"
  | "hug"
  | "dejected"
  | "protest"
  | "feint"
  | "cut"
  | "stepover"
  | "elastico";

const ACTION_CLIP: Record<PlayerAction, ClipName> = {
  shot: "shotLow",
  shotPower: "shotPower",
  shotPlaced: "shotPlaced",
  bicycle: "bicycle",
  headClear: "headClear",
  duel: "shoulderDuel",
  decelerate: "decelerate",
  turn: "turn",
  backpedal: "backpedal",
  chip: "chip",
  volley: "volley",
  header: "header",
  firstTime: "firstTime",
  pass: "passShort",
  passLong: "passLong",
  cross: "cross",
  trap: "trap",
  tackle: "standTackle",
  slide: "slideTackle",
  block: "block",
  intercept: "intercept",
  save: "gkSaveLow",
  saveHigh: "gkSaveHigh",
  diveLeft: "gkDiveLeft",
  diveRight: "gkDiveRight",
  catch: "gkCatch",
  distribute: "gkDistribute",
  goalKick: "goalKick",
  throwIn: "throwIn",
  corner: "cornerKick",
  freeKick: "freeKick",
  penalty: "penalty",
  celebrate: "celebrateArms",
  celebrateRun: "celebrateRun",
  kneeSlide: "kneeSlide",
  hug: "groupHug",
  dejected: "dejected",
  protest: "protest",
  feint: "feint",
  cut: "cut",
  stepover: "stepover",
  elastico: "elastico",
};

export interface SelectCtx {
  isGK: boolean;
  action: PlayerAction | null;
  speed: number;
  hasBall: boolean;
  ballDist: number;
  stamina: number;
  defending: boolean;
  stopped: boolean;
  seed: number;
  time: number;
}

export function selectClip(c: SelectCtx): ClipName {
  if (c.action) return ACTION_CLIP[c.action];

  if (c.isGK) {
    if (c.speed > 1.6) return "gkShuffle";
    return "gkStance";
  }

  if (c.stopped) return c.seed % 3 === 0 ? "whistleStop" : "restart";

  const sp = c.speed;
  if (c.hasBall) {
    if (sp > 5.4) return "dribbleFast";
    if (sp > 1.2) return "dribbleLight";
    return (c.seed + Math.floor(c.time * 0.5)) % 2 === 0 ? "feint" : "stepover";
  }

  if (sp < 0.35) {
    if (c.defending && c.ballDist < 18) return "mark";
    const k = (c.seed + Math.floor(c.time / 4)) % 3;
    return k === 0 ? "idle" : k === 1 ? "breathe" : "weightShift";
  }
  if (sp < 1.2) return c.defending && c.ballDist < 12 ? "sideStep" : "walk";
  if (sp < 2.6) return c.stamina < 45 ? "tired" : "walk";
  if (sp < 4.2) return c.stamina < 40 ? "tired" : "jog";
  if (sp < 6.2) return c.defending ? "recover" : "run";
  return "sprint";
}
