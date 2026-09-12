// ============================================================================
//  animation-extra.ts
//  89 novos clipes de animação procedural (locomoção, condução, finalização,
//  defesa, goleiro, bolas paradas, comemorações e reações).
//
//  Mesma assinatura dos clipes originais: recebem o contexto do clipe e
//  devolvem uma pose completa. São mesclados em `animation.ts`.
// ============================================================================

import { emptyPose, mixPose, type Clip, type ClipCtx, type Pose } from "./animation-core";

const sin = Math.sin;
const cos = Math.cos;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
/** curva de impacto: sobe, bate e volta */
const hit = (u: number, peak = 0.45) =>
  u < peak ? u / peak : 1 - clamp01((u - peak) / (1 - peak));
const ease = (u: number) => u * u * (3 - 2 * u);

function pose(partial: Partial<Pose>): Pose {
  const p = emptyPose();
  Object.assign(p, partial);
  return p;
}

/** ciclo de passada reaproveitado pelos clipes de locomoção */
function gait(
  c: ClipCtx,
  o: { rate: number; amp: number; knee: number; armAmp: number; lean: number; bob: number },
): Pose {
  const t = c.t * o.rate + c.seed;
  const s = sin(t);
  const s2 = sin(t + Math.PI);
  return pose({
    hipY: Math.abs(sin(t * 2)) * o.bob,
    hipPitch: o.lean,
    hipRoll: s * 0.04,
    hipYaw: -s * 0.08,
    spine: o.lean * 0.5,
    chest: sin(t * 2) * 0.04,
    headPitch: -o.lean * 0.7,
    legLPitch: s * o.amp,
    legRPitch: s2 * o.amp,
    kneeL: -clamp01(-s + 0.35) * o.knee,
    kneeR: -clamp01(-s2 + 0.35) * o.knee,
    ankleL: s * 0.25,
    ankleR: s2 * 0.25,
    armLPitch: s2 * o.armAmp,
    armRPitch: s * o.armAmp,
    elbowL: -0.5 - Math.abs(s2) * 0.5,
    elbowR: -0.5 - Math.abs(s) * 0.5,
    armLRoll: 0.14,
    armRRoll: -0.14,
  });
}

function stance(c: ClipCtx, k = 1): Pose {
  const b = sin(c.t * 1.6 + c.seed) * 0.02 * k;
  return pose({
    hipY: b * 0.5,
    spine: 0.06 + b,
    chest: 0.03,
    headPitch: -0.02,
    armLPitch: 0.06,
    armRPitch: 0.06,
    armLRoll: 0.16,
    armRRoll: -0.16,
    elbowL: -0.34,
    elbowR: -0.34,
    kneeL: -0.08,
    kneeR: -0.08,
  });
}

/** agachamento defensivo, base de vários clipes de marcação */
function crouch(c: ClipCtx, depth = 1): Pose {
  const b = sin(c.t * 3 + c.seed) * 0.03;
  return pose({
    hipY: -0.12 * depth,
    hipPitch: 0.24 * depth,
    spine: 0.2 * depth,
    chest: -0.05,
    headPitch: -0.16,
    kneeL: -0.6 * depth + b,
    kneeR: -0.6 * depth - b,
    legLRoll: 0.16,
    legRRoll: -0.16,
    armLRoll: 0.62,
    armRRoll: -0.62,
    elbowL: -0.8,
    elbowR: -0.8,
    armLPitch: -0.2,
    armRPitch: -0.2,
  });
}

export const EXTRA_CLIPS = {
  // ------------------------------------------------------ locomoção (14)
  stroll: (c) =>
    mixPose(
      gait(c, { rate: 3.2, amp: 0.3, knee: 0.5, armAmp: 0.2, lean: 0.02, bob: 0.015 }),
      pose({ headYaw: sin(c.t * 0.6) * 0.25, spine: 0.02 }),
      0.4,
    ),
  joggingBack: (c) =>
    mixPose(
      gait(c, { rate: 6, amp: 0.42, knee: 0.85, armAmp: 0.4, lean: -0.14, bob: 0.03 }),
      pose({ headYaw: sin(c.t * 1.2) * 0.3, chest: -0.08 }),
      0.5,
    ),
  curveRunLeft: (c) =>
    mixPose(
      gait(c, { rate: 9, amp: 0.75, knee: 1.3, armAmp: 0.8, lean: 0.22, bob: 0.05 }),
      pose({ hipRoll: 0.2, hipYaw: 0.16, chest: 0.1, headYaw: 0.24 }),
      0.55,
    ),
  curveRunRight: (c) =>
    mixPose(
      gait(c, { rate: 9, amp: 0.75, knee: 1.3, armAmp: 0.8, lean: 0.22, bob: 0.05 }),
      pose({ hipRoll: -0.2, hipYaw: -0.16, chest: -0.1, headYaw: -0.24 }),
      0.55,
    ),
  shuffleLeft: (c) =>
    pose({
      hipY: Math.abs(sin(c.t * 7)) * 0.025,
      hipRoll: 0.12 + sin(c.t * 7) * 0.08,
      legLRoll: 0.3,
      legRRoll: -0.12,
      kneeL: -0.5,
      kneeR: -0.45,
      spine: 0.16,
      armLRoll: 0.7,
      armRRoll: -0.45,
      elbowL: -0.8,
      elbowR: -0.6,
      headYaw: 0.2,
    }),
  shuffleRight: (c) =>
    pose({
      hipY: Math.abs(sin(c.t * 7)) * 0.025,
      hipRoll: -0.12 - sin(c.t * 7) * 0.08,
      legLRoll: 0.12,
      legRRoll: -0.3,
      kneeL: -0.45,
      kneeR: -0.5,
      spine: 0.16,
      armLRoll: 0.45,
      armRRoll: -0.7,
      elbowL: -0.6,
      elbowR: -0.8,
      headYaw: -0.2,
    }),
  explosiveStart: (c) => {
    const u = ease(clamp01(c.u));
    return pose({
      hipPitch: 0.5 - u * 0.2,
      spine: 0.4 - u * 0.15,
      hipY: -0.05 + u * 0.04,
      legLPitch: 0.9 - u * 0.5,
      legRPitch: -0.6 + u * 0.4,
      kneeL: -1.3 + u * 0.5,
      kneeR: -0.4,
      ankleL: 0.4,
      armLPitch: -1.2 + u * 0.6,
      armRPitch: 0.9 - u * 0.5,
      elbowL: -1.2,
      elbowR: -1.0,
      headPitch: -0.2,
    });
  },
  hardStop: (c) => {
    const u = hit(clamp01(c.u), 0.3);
    return pose({
      hipPitch: -0.4 * u,
      hipY: -0.16 * u,
      spine: -0.28 * u,
      legLPitch: 0.7 * u,
      legRPitch: -0.3 * u,
      kneeL: -1.1 * u,
      kneeR: -0.6 * u,
      ankleL: -0.5 * u,
      armLPitch: -0.9 * u,
      armRPitch: -0.9 * u,
      armLRoll: 0.8 * u,
      armRRoll: -0.8 * u,
      headPitch: 0.1 * u,
    });
  },
  pivotLeft: (c) =>
    mixPose(
      crouch(c, 0.8),
      pose({
        hipYaw: 0.6,
        chest: -0.2,
        headYaw: 0.5,
        legLRoll: 0.3,
        ankleL: 0.3,
        armLPitch: -0.7,
        armRPitch: 0.3,
      }),
      0.65,
    ),
  pivotRight: (c) =>
    mixPose(
      crouch(c, 0.8),
      pose({
        hipYaw: -0.6,
        chest: 0.2,
        headYaw: -0.5,
        legRRoll: -0.3,
        ankleR: 0.3,
        armRPitch: -0.7,
        armLPitch: 0.3,
      }),
      0.65,
    ),
  hurdleStep: (c) => {
    const u = hit(clamp01(c.u));
    return pose({
      hipY: 0.16 * u,
      legLPitch: 1.1 * u,
      kneeL: -1.5 * u,
      ankleL: 0.4 * u,
      legRPitch: -0.5 * u,
      kneeR: -0.3,
      spine: 0.2 * u,
      armLPitch: -0.9 * u,
      armRPitch: 0.7 * u,
      headPitch: 0.14 * u,
    });
  },
  jumpVertical: (c) => {
    const u = hit(clamp01(c.u), 0.4);
    return pose({
      hipY: 0.34 * u - 0.12 * (1 - u),
      kneeL: -1.2 * (1 - u) - 0.3 * u,
      kneeR: -1.2 * (1 - u) - 0.3 * u,
      legLPitch: 0.3 * u,
      legRPitch: 0.3 * u,
      armLPitch: -2.4 * u,
      armRPitch: -2.4 * u,
      armLRoll: 0.4,
      armRRoll: -0.4,
      spine: -0.1 * u,
      headPitch: -0.3 * u,
    });
  },
  landing: (c) => {
    const u = 1 - ease(clamp01(c.u));
    return pose({
      hipY: -0.26 * u,
      hipPitch: 0.3 * u,
      spine: 0.24 * u,
      kneeL: -1.25 * u,
      kneeR: -1.25 * u,
      ankleL: 0.3 * u,
      ankleR: 0.3 * u,
      armLPitch: -0.8 * u,
      armRPitch: -0.8 * u,
      armLRoll: 0.7,
      armRRoll: -0.7,
      headPitch: 0.12 * u,
    });
  },
  stumble: (c) =>
    pose({
      hipRoll: sin(c.t * 8 + c.seed) * 0.3,
      hipPitch: 0.4,
      spine: 0.3,
      chest: sin(c.t * 6) * 0.2,
      legLPitch: sin(c.t * 8) * 0.7,
      legRPitch: -sin(c.t * 8) * 0.5,
      kneeL: -0.9,
      kneeR: -0.5,
      armLPitch: -1.6 + sin(c.t * 9) * 0.6,
      armRPitch: -1.4 - sin(c.t * 9) * 0.6,
      armLRoll: 1.1,
      armRRoll: -1.1,
      headPitch: 0.3,
    }),

  // ------------------------------------------------- condução da bola (16)
  closeControl: (c) =>
    mixPose(
      gait(c, { rate: 6.6, amp: 0.4, knee: 0.95, armAmp: 0.35, lean: 0.16, bob: 0.025 }),
      pose({ headPitch: 0.3, spine: 0.22, armLRoll: 0.5, armRRoll: -0.5 }),
      0.55,
    ),
  shieldBall: (c) =>
    pose({
      hipYaw: 0.5,
      hipRoll: 0.16,
      spine: 0.24,
      chest: 0.28,
      headYaw: -0.55,
      headPitch: 0.16,
      armLPitch: -0.6,
      armLRoll: 1.35,
      elbowL: -0.5,
      armRPitch: -0.3,
      armRRoll: -0.7,
      elbowR: -1.2,
      kneeL: -0.5,
      kneeR: -0.55,
      hipY: -0.05 + sin(c.t * 2.4) * 0.02,
    }),
  knockOn: (c) => {
    const u = hit(clamp01(c.u), 0.35);
    return mixPose(
      gait(c, { rate: 9, amp: 0.7, knee: 1.2, armAmp: 0.7, lean: 0.22, bob: 0.045 }),
      pose({ legRPitch: 1.0, kneeR: -0.4, ankleR: 0.45, headPitch: 0.22 }),
      u * 0.7,
    );
  },
  rouletteSpin: (c) => {
    const u = clamp01(c.u);
    return pose({
      hipYaw: u * Math.PI * 2,
      hipRoll: sin(u * Math.PI * 2) * 0.16,
      spine: 0.18,
      chest: -sin(u * Math.PI * 2) * 0.2,
      headYaw: sin(u * Math.PI * 2) * 0.5,
      legLPitch: sin(u * 12) * 0.4,
      legRPitch: -sin(u * 12) * 0.4,
      kneeL: -0.6,
      kneeR: -0.6,
      armLRoll: 0.9,
      armRRoll: -0.9,
      elbowL: -1.0,
      elbowR: -1.0,
    });
  },
  rainbowFlick: (c) => {
    const u = hit(clamp01(c.u), 0.5);
    return pose({
      hipPitch: 0.3 * u,
      spine: 0.3 * u,
      legLPitch: -0.9 * u,
      kneeL: -1.4 * u,
      ankleL: -0.5 * u,
      legRPitch: 0.5 * u,
      kneeR: -0.4,
      armLPitch: -1.2 * u,
      armRPitch: -1.2 * u,
      armLRoll: 0.9,
      armRRoll: -0.9,
      headPitch: -0.2 * u,
      hipY: 0.05 * u,
    });
  },
  nutmeg: (c) => {
    const u = hit(clamp01(c.u), 0.4);
    return pose({
      hipY: -0.06 * u,
      spine: 0.24 * u,
      legRPitch: 0.85 * u,
      kneeR: -0.5 * u,
      ankleR: 0.4 * u,
      legLPitch: -0.2 * u,
      kneeL: -0.5,
      armLRoll: 0.7,
      armRRoll: -0.7,
      elbowL: -0.9,
      elbowR: -0.9,
      headPitch: 0.34 * u,
      hipYaw: -0.16 * u,
    });
  },
  dragBack: (c) => {
    const u = hit(clamp01(c.u), 0.45);
    return pose({
      hipPitch: -0.2 * u,
      spine: 0.1,
      legRPitch: 0.6 * u,
      kneeR: -0.9 * u,
      ankleR: -0.5 * u,
      legLPitch: -0.25 * u,
      kneeL: -0.55,
      hipYaw: 0.3 * u,
      chest: -0.2 * u,
      headPitch: 0.3,
      armLRoll: 0.75,
      armRRoll: -0.75,
      elbowL: -1.0,
      elbowR: -0.9,
    });
  },
  scissorsDouble: (c) => {
    const p = sin(c.t * 13 + c.seed);
    return pose({
      hipY: Math.abs(p) * 0.03,
      hipRoll: p * 0.16,
      legLPitch: p * 0.65,
      legRPitch: -p * 0.65,
      legLRoll: p * 0.3,
      legRRoll: p * 0.3,
      kneeL: -0.75,
      kneeR: -0.75,
      spine: 0.2,
      chest: -p * 0.12,
      armLRoll: 0.8,
      armRRoll: -0.8,
      elbowL: -0.9,
      elbowR: -0.9,
      headPitch: 0.26,
    });
  },
  cruyffTurn: (c) => {
    const u = ease(clamp01(c.u));
    return pose({
      hipYaw: -u * 2.4,
      hipRoll: -0.14 * u,
      spine: 0.2,
      chest: 0.24 * u,
      legRPitch: 0.7 * hit(clamp01(c.u), 0.4),
      kneeR: -0.8,
      ankleR: 0.5 * hit(clamp01(c.u), 0.4),
      kneeL: -0.5,
      headYaw: -0.6 * u,
      armLRoll: 0.9,
      armRRoll: -0.9,
      elbowL: -1.1,
      elbowR: -0.8,
    });
  },
  heelFlick: (c) => {
    const u = hit(clamp01(c.u), 0.4);
    return pose({
      hipPitch: 0.18 * u,
      spine: 0.16,
      legRPitch: -0.7 * u,
      kneeR: -1.35 * u,
      ankleR: -0.55 * u,
      legLPitch: 0.2 * u,
      kneeL: -0.4,
      armLPitch: -0.7 * u,
      armRPitch: -0.5 * u,
      armLRoll: 0.8,
      armRRoll: -0.8,
      headPitch: 0.1,
    });
  },
  sombrero: (c) => {
    const u = hit(clamp01(c.u), 0.45);
    return pose({
      hipY: 0.08 * u,
      spine: -0.16 * u,
      chest: -0.1 * u,
      legRPitch: 0.95 * u,
      kneeR: -0.6 * u,
      ankleR: 0.55 * u,
      kneeL: -0.35,
      armLPitch: -1.4 * u,
      armRPitch: -1.4 * u,
      armLRoll: 1.0,
      armRRoll: -1.0,
      headPitch: -0.34 * u,
    });
  },
  chestControl: (c) => {
    const u = hit(clamp01(c.u), 0.4);
    return pose({
      chest: -0.4 * u,
      spine: -0.22 * u,
      headPitch: -0.3 * u,
      hipPitch: -0.16 * u,
      armLPitch: -0.9 * u,
      armRPitch: -0.9 * u,
      armLRoll: 1.15,
      armRRoll: -1.15,
      elbowL: -1.0,
      elbowR: -1.0,
      kneeL: -0.4,
      kneeR: -0.4,
      hipY: -0.04 * u,
    });
  },
  thighControl: (c) => {
    const u = hit(clamp01(c.u), 0.4);
    return pose({
      legRPitch: 1.1 * u,
      kneeR: -1.2 * u,
      ankleR: 0.2,
      spine: 0.14,
      headPitch: 0.32 * u,
      armLRoll: 0.9 * u,
      armRRoll: -0.9 * u,
      elbowL: -0.7,
      elbowR: -0.7,
      kneeL: -0.25,
      hipY: -0.03 * u,
    });
  },
  headControl: (c) => {
    const u = hit(clamp01(c.u), 0.4);
    return pose({
      headPitch: -0.55 * u,
      chest: -0.25 * u,
      spine: -0.2 * u,
      hipY: 0.05 * u,
      armLPitch: -0.8 * u,
      armRPitch: -0.8 * u,
      armLRoll: 0.9,
      armRRoll: -0.9,
      kneeL: -0.3,
      kneeR: -0.3,
    });
  },
  receiveTurn: (c) => {
    const u = ease(clamp01(c.u));
    return pose({
      hipYaw: u * 1.8,
      chest: -0.24 * u,
      headYaw: 0.7 * u,
      spine: 0.18,
      legLPitch: 0.4 * (1 - u),
      kneeL: -0.6,
      kneeR: -0.55,
      ankleR: 0.3 * u,
      armLRoll: 0.8,
      armRRoll: -0.8,
      elbowL: -0.9,
      elbowR: -0.9,
      headPitch: 0.2,
    });
  },
  dribbleSlalom: (c) =>
    mixPose(
      gait(c, { rate: 8, amp: 0.6, knee: 1.15, armAmp: 0.6, lean: 0.2, bob: 0.04 }),
      pose({
        hipYaw: sin(c.t * 2.6 + c.seed) * 0.34,
        hipRoll: sin(c.t * 2.6) * 0.18,
        headPitch: 0.24,
      }),
      0.5,
    ),

  // ---------------------------------------- finalização e passe (12)
  finesseShot: (c) => {
    const u = hit(clamp01(c.u), 0.42);
    return pose({
      hipYaw: -0.4 * u,
      chest: 0.3 * u,
      spine: -0.12 * u,
      legRPitch: -0.6 + 1.7 * u,
      kneeR: -1.0 + 0.85 * u,
      ankleR: 0.35 * u,
      legRRoll: -0.35 * u,
      kneeL: -0.35,
      armLPitch: -1.5 * u,
      armLRoll: 1.2,
      armRPitch: 0.6 * u,
      armRRoll: -0.5,
      headPitch: 0.2 * u,
      hipY: -0.03,
    });
  },
  knuckleShot: (c) => {
    const u = hit(clamp01(c.u), 0.38);
    return pose({
      hipPitch: 0.2 * u,
      spine: -0.24 * u,
      legRPitch: -0.8 + 2.1 * u,
      kneeR: -1.25 + 1.15 * u,
      ankleR: -0.25 * u,
      kneeL: -0.5 * u,
      armLPitch: -1.9 * u,
      armRPitch: 1.0 * u,
      armLRoll: 1.25,
      armRRoll: -0.6,
      headPitch: 0.26 * u,
      hipY: 0.04 * u,
    });
  },
  toePoke: (c) => {
    const u = hit(clamp01(c.u), 0.3);
    return pose({
      legRPitch: 1.15 * u,
      kneeR: -0.3 * u,
      ankleR: 0.5 * u,
      spine: 0.16,
      hipPitch: 0.12 * u,
      armLRoll: 0.8,
      armRRoll: -0.8,
      elbowL: -0.9,
      elbowR: -0.9,
      headPitch: 0.24,
      kneeL: -0.4,
    });
  },
  halfVolley: (c) => {
    const u = hit(clamp01(c.u), 0.4);
    return pose({
      hipY: 0.06 * u,
      chest: 0.34 * u,
      spine: -0.2 * u,
      legRPitch: -0.5 + 1.9 * u,
      kneeR: -1.1 + 0.9 * u,
      ankleR: 0.3 * u,
      legLPitch: -0.2 * u,
      kneeL: -0.6 * u,
      armLPitch: -2.0 * u,
      armRPitch: 1.2 * u,
      armLRoll: 1.3,
      armRRoll: -0.8,
      headPitch: 0.24 * u,
    });
  },
  divingHeader: (c) => {
    const u = ease(clamp01(c.u));
    return pose({
      hipY: -0.1 + 0.34 * hit(clamp01(c.u), 0.5),
      hipPitch: -1.15 * u,
      spine: -0.3 * u,
      chest: -0.28 * u,
      headPitch: -0.42 * u,
      legLPitch: -0.7 * u,
      legRPitch: -0.8 * u,
      kneeL: -0.5 * u,
      kneeR: -0.4 * u,
      armLPitch: -2.6 * u,
      armRPitch: -2.6 * u,
      armLRoll: 0.6,
      armRRoll: -0.6,
      elbowL: -0.2,
      elbowR: -0.2,
    });
  },
  backheelPass: (c) => {
    const u = hit(clamp01(c.u), 0.42);
    return pose({
      legRPitch: -0.85 * u,
      kneeR: -1.1 * u,
      ankleR: -0.4 * u,
      hipPitch: 0.2 * u,
      spine: 0.18,
      chest: 0.14 * u,
      headYaw: -0.4 * u,
      armLPitch: -0.9 * u,
      armRPitch: -0.4 * u,
      armLRoll: 0.9,
      armRRoll: -0.9,
      kneeL: -0.35,
    });
  },
  outsideFootPass: (c) => {
    const u = hit(clamp01(c.u), 0.4);
    return pose({
      legRPitch: 1.1 * u,
      legRRoll: -0.6 * u,
      kneeR: -0.55 * u,
      ankleR: 0.35 * u,
      hipYaw: 0.24 * u,
      chest: -0.18 * u,
      spine: 0.1,
      armLPitch: -1.0 * u,
      armRPitch: 0.5 * u,
      armLRoll: 1.0,
      armRRoll: -0.6,
      headPitch: 0.2,
      kneeL: -0.4,
    });
  },
  loftedThrough: (c) => {
    const u = hit(clamp01(c.u), 0.45);
    return pose({
      hipPitch: -0.16 * u,
      spine: -0.24 * u,
      legRPitch: -0.5 + 1.75 * u,
      kneeR: -0.95 + 0.8 * u,
      ankleR: -0.45 * u,
      kneeL: -0.45,
      armLPitch: -1.7 * u,
      armRPitch: 1.1 * u,
      armLRoll: 1.2,
      armRRoll: -0.7,
      headPitch: -0.12 * u,
      hipY: 0.03 * u,
    });
  },
  drivenCross: (c) => {
    const u = hit(clamp01(c.u), 0.42);
    return pose({
      hipYaw: -0.5 * u,
      chest: 0.4 * u,
      spine: -0.14 * u,
      legRPitch: -0.7 + 2.0 * u,
      kneeR: -1.15 + 1.0 * u,
      ankleR: 0.25 * u,
      kneeL: -0.4,
      armLPitch: -2.0 * u,
      armRPitch: 1.1 * u,
      armLRoll: 1.3,
      armRRoll: -0.7,
      headYaw: 0.3 * u,
    });
  },
  cutback: (c) => {
    const u = hit(clamp01(c.u), 0.4);
    return pose({
      hipYaw: 0.55 * u,
      chest: -0.3 * u,
      spine: 0.16,
      legRPitch: 0.6 * u,
      kneeR: -0.85 * u,
      ankleR: 0.3 * u,
      kneeL: -0.6,
      headYaw: 0.5 * u,
      headPitch: 0.2,
      armLRoll: 1.0,
      armRRoll: -0.8,
      elbowL: -1.0,
      elbowR: -0.8,
    });
  },
  oneTwoRun: (c) =>
    mixPose(
      gait(c, { rate: 10, amp: 0.8, knee: 1.35, armAmp: 0.85, lean: 0.26, bob: 0.05 }),
      pose({ headYaw: sin(c.t * 3) * 0.4, armLPitch: -1.1, armLRoll: 0.9, elbowL: -0.6 }),
      0.4,
    ),
  dummyRun: (c) =>
    mixPose(
      gait(c, { rate: 9.5, amp: 0.72, knee: 1.25, armAmp: 0.7, lean: 0.24, bob: 0.045 }),
      pose({ hipYaw: 0.3, chest: -0.24, headYaw: -0.5, armRPitch: -1.3, armRRoll: -1.0 }),
      0.45,
    ),

  // ------------------------------------------------------- defesa (10)
  jockey: (c) =>
    mixPose(
      crouch(c, 1),
      pose({ hipYaw: sin(c.t * 2.4 + c.seed) * 0.22, headYaw: sin(c.t * 2.4) * 0.2, hipY: -0.16 }),
      0.6,
    ),
  pressTrigger: (c) =>
    mixPose(
      gait(c, { rate: 11, amp: 0.9, knee: 1.5, armAmp: 1.0, lean: 0.34, bob: 0.055 }),
      pose({ headPitch: 0.16, chest: 0.1, spine: 0.24 }),
      0.35,
    ),
  shoulderNudge: (c) => {
    const u = hit(clamp01(c.u), 0.4);
    return pose({
      hipRoll: 0.28 * u,
      chest: 0.42 * u,
      spine: 0.22,
      hipYaw: 0.24 * u,
      armLPitch: -0.5 * u,
      armLRoll: 1.15 * u,
      elbowL: -0.7,
      armRRoll: -0.6,
      elbowR: -1.0,
      kneeL: -0.55,
      kneeR: -0.5,
      headYaw: -0.3 * u,
      hipY: -0.05,
    });
  },
  blockShotSlide: (c) => {
    const u = ease(clamp01(c.u));
    return pose({
      hipY: -0.5 * u,
      hipPitch: 0.2,
      hipRoll: 0.5 * u,
      legLPitch: 1.35 * u,
      kneeL: -0.35,
      legRPitch: 0.2 * u,
      kneeR: -1.5 * u,
      spine: 0.2,
      chest: -0.2 * u,
      armLPitch: -1.8 * u,
      armRPitch: -1.2 * u,
      armLRoll: 1.2,
      armRRoll: -1.0,
      headPitch: 0.2,
    });
  },
  clearanceBig: (c) => {
    const u = hit(clamp01(c.u), 0.45);
    return pose({
      hipPitch: -0.28 * u,
      spine: -0.34 * u,
      chest: -0.2 * u,
      legRPitch: -0.7 + 2.2 * u,
      kneeR: -1.2 + 1.1 * u,
      ankleR: -0.5 * u,
      legLPitch: 0.2 * u,
      kneeL: -0.5,
      armLPitch: -2.2 * u,
      armRPitch: 1.3 * u,
      armLRoll: 1.35,
      armRRoll: -0.8,
      headPitch: -0.3 * u,
      hipY: 0.08 * u,
    });
  },
  lastDitch: (c) => {
    const u = ease(clamp01(c.u));
    return pose({
      hipY: -0.6 * u,
      hipRoll: 0.9 * u,
      hipPitch: 0.1,
      legLPitch: 1.5 * u,
      kneeL: -0.2,
      legRPitch: 0.6 * u,
      kneeR: -1.3 * u,
      spine: 0.1,
      chest: -0.4 * u,
      armLPitch: -2.4 * u,
      armRPitch: -1.6 * u,
      armLRoll: 1.3,
      armRRoll: -1.2,
      headPitch: -0.2,
    });
  },
  recoverySprint: (c) =>
    mixPose(
      gait(c, { rate: 12, amp: 1.0, knee: 1.7, armAmp: 1.15, lean: 0.36, bob: 0.06 }),
      pose({ headYaw: sin(c.t * 1.6) * 0.3, chest: 0.06 }),
      0.3,
    ),
  offsideTrap: (c) => {
    const u = ease(clamp01(c.u));
    return pose({
      hipPitch: -0.1,
      spine: -0.06,
      armLPitch: -2.5 * u,
      armLRoll: 0.5,
      elbowL: -0.1,
      armRPitch: -0.4,
      armRRoll: -0.5,
      headYaw: -0.6 * u,
      headPitch: -0.14,
      legLPitch: -0.3 * u,
      kneeL: -0.3,
      kneeR: -0.3,
      hipY: 0.02,
    });
  },
  markTight: (c) =>
    mixPose(
      crouch(c, 0.9),
      pose({
        headYaw: sin(c.t * 1.8 + c.seed) * 0.45,
        armLPitch: -0.6,
        armLRoll: 1.05,
        elbowL: -0.6,
        chest: 0.12,
      }),
      0.55,
    ),
  headerDefensive: (c) => {
    const u = hit(clamp01(c.u), 0.45);
    return pose({
      hipY: 0.42 * u,
      legLPitch: 0.4 * u,
      legRPitch: -0.3 * u,
      kneeL: -0.9 * (1 - u) - 0.2,
      kneeR: -0.9 * (1 - u) - 0.4,
      spine: -0.3 * u,
      chest: -0.24 * u,
      headPitch: -0.5 * u,
      armLPitch: -2.3 * u,
      armRPitch: -1.9 * u,
      armLRoll: 0.8,
      armRRoll: -0.8,
      elbowL: -0.4,
      elbowR: -0.4,
    });
  },

  // ----------------------------------------------------- goleiro (10)
  gkSpread: (c) => {
    const u = ease(clamp01(c.u));
    return pose({
      hipY: -0.45 * u,
      hipPitch: 0.3 * u,
      legLRoll: 0.8 * u,
      legRRoll: -0.8 * u,
      legLPitch: 0.5 * u,
      legRPitch: 0.5 * u,
      kneeL: -0.3,
      kneeR: -0.3,
      spine: 0.2,
      armLPitch: -1.4 * u,
      armRPitch: -1.4 * u,
      armLRoll: 1.4 * u,
      armRRoll: -1.4 * u,
      elbowL: -0.2,
      elbowR: -0.2,
      headPitch: 0.2 * u,
    });
  },
  gkTipOver: (c) => {
    const u = hit(clamp01(c.u), 0.5);
    return pose({
      hipY: 0.55 * u,
      hipRoll: 0.4 * u,
      spine: -0.3 * u,
      chest: -0.2 * u,
      armLPitch: -3.0 * u,
      armLRoll: 0.8 * u,
      elbowL: -0.05,
      armRPitch: -1.2 * u,
      armRRoll: -0.9,
      legLPitch: -0.4 * u,
      legRPitch: 0.5 * u,
      kneeR: -0.9 * u,
      headPitch: -0.5 * u,
    });
  },
  gkPunch: (c) => {
    const u = hit(clamp01(c.u), 0.42);
    return pose({
      hipY: 0.42 * u,
      spine: -0.2 * u,
      armLPitch: -2.6 * u,
      armRPitch: -2.6 * u,
      elbowL: -1.4 + 1.3 * u,
      elbowR: -1.4 + 1.3 * u,
      armLRoll: 0.45,
      armRRoll: -0.45,
      headPitch: -0.4 * u,
      legLPitch: 0.4 * u,
      legRPitch: -0.3 * u,
      kneeL: -0.4,
      kneeR: -0.6,
    });
  },
  gkClaimCross: (c) => {
    const u = hit(clamp01(c.u), 0.5);
    return pose({
      hipY: 0.5 * u,
      armLPitch: -2.9 * u,
      armRPitch: -2.9 * u,
      armLRoll: 0.35,
      armRRoll: -0.35,
      elbowL: -0.25,
      elbowR: -0.25,
      spine: -0.24 * u,
      headPitch: -0.5 * u,
      legLPitch: 0.55 * u,
      kneeL: -1.0 * u,
      legRPitch: -0.2 * u,
      kneeR: -0.3,
    });
  },
  gkSweeper: (c) =>
    mixPose(
      gait(c, { rate: 10.5, amp: 0.85, knee: 1.4, armAmp: 0.9, lean: 0.3, bob: 0.05 }),
      pose({ headPitch: 0.2, chest: 0.1, armLRoll: 0.35, armRRoll: -0.35 }),
      0.35,
    ),
  gkRollOut: (c) => {
    const u = hit(clamp01(c.u), 0.45);
    return pose({
      hipPitch: 0.55 * u,
      spine: 0.35 * u,
      hipY: -0.22 * u,
      legLPitch: 0.7 * u,
      kneeL: -1.1 * u,
      legRPitch: -0.4 * u,
      kneeR: -0.5,
      armRPitch: 1.4 * u - 0.6,
      armRRoll: -0.25,
      elbowR: -0.2,
      armLPitch: -0.9 * u,
      armLRoll: 0.9,
      headPitch: 0.35 * u,
    });
  },
  gkDropKick: (c) => {
    const u = hit(clamp01(c.u), 0.45);
    return pose({
      hipY: 0.14 * u,
      spine: -0.3 * u,
      legRPitch: -0.6 + 2.1 * u,
      kneeR: -1.0 + 0.95 * u,
      ankleR: -0.4 * u,
      kneeL: -0.45,
      armLPitch: -1.9 * u,
      armRPitch: -0.9 + 1.4 * u,
      armLRoll: 1.2,
      armRRoll: -0.6,
      headPitch: -0.2 * u,
    });
  },
  gkPenaltyReady: (c) =>
    pose({
      hipY: -0.14,
      hipPitch: 0.24,
      spine: 0.2,
      kneeL: -0.62,
      kneeR: -0.62,
      legLRoll: 0.24,
      legRRoll: -0.24,
      armLPitch: -1.0,
      armRPitch: -1.0,
      armLRoll: 1.35 + sin(c.t * 3 + c.seed) * 0.14,
      armRRoll: -1.35 - sin(c.t * 3 + c.seed) * 0.14,
      elbowL: -0.45,
      elbowR: -0.45,
      headPitch: -0.1,
    }),
  gkWallSetup: (c) =>
    pose({
      spine: 0.05,
      chest: 0.1,
      headYaw: -0.45 + sin(c.t * 1.4) * 0.2,
      armLPitch: -2.3,
      armLRoll: 0.7,
      elbowL: -0.3,
      armRPitch: -1.0,
      armRRoll: -0.8,
      elbowR: -0.8,
      kneeL: -0.2,
      kneeR: -0.2,
      hipY: sin(c.t * 1.2) * 0.01,
    }),
  gkFrustrated: (c) =>
    pose({
      spine: 0.3,
      chest: 0.16,
      headPitch: 0.45,
      armLPitch: -2.1,
      armRPitch: -2.1,
      elbowL: -1.9,
      elbowR: -1.9,
      armLRoll: 1.0,
      armRRoll: -1.0,
      hipY: -0.05 + sin(c.t * 1.6) * 0.02,
      kneeL: -0.22,
      kneeR: -0.22,
    }),

  // ------------------------------------------------- bolas paradas (8)
  cornerRunUp: (c) => {
    const u = ease(clamp01(c.u));
    return mixPose(
      gait(c, { rate: 7, amp: 0.55, knee: 1.0, armAmp: 0.5, lean: 0.14, bob: 0.03 }),
      pose({ headYaw: -0.5 + u * 0.5, chest: 0.16 }),
      0.5,
    );
  },
  freeKickWall: (c) =>
    pose({
      spine: 0.06,
      chest: 0.04,
      headPitch: -0.06,
      armLPitch: -0.7,
      armRPitch: -0.7,
      armLRoll: 0.5,
      armRRoll: -0.5,
      elbowL: -1.7,
      elbowR: -1.7,
      kneeL: -0.16,
      kneeR: -0.16,
      hipY: sin(c.t * 1.3 + c.seed) * 0.012,
      headYaw: sin(c.t * 0.8) * 0.12,
    }),
  penaltyStutter: (c) => {
    const u = clamp01(c.u);
    const st = sin(u * 26) * (1 - u);
    return pose({
      hipY: Math.abs(st) * 0.04,
      legLPitch: st * 0.5,
      legRPitch: -st * 0.5,
      kneeL: -0.5,
      kneeR: -0.5,
      spine: 0.14,
      hipRoll: st * 0.1,
      armLRoll: 0.6,
      armRRoll: -0.6,
      elbowL: -0.8,
      elbowR: -0.8,
      headPitch: 0.16,
    });
  },
  throwInLong: (c) => {
    const u = hit(clamp01(c.u), 0.55);
    return pose({
      spine: -0.5 * u,
      chest: -0.3 * u,
      headPitch: -0.35 * u,
      armLPitch: -3.0 * u,
      armRPitch: -3.0 * u,
      elbowL: -1.3 + 1.2 * u,
      elbowR: -1.3 + 1.2 * u,
      armLRoll: 0.3,
      armRRoll: -0.3,
      legLPitch: 0.5 * u,
      kneeL: -0.5,
      legRPitch: -0.4 * u,
      kneeR: -0.7 * u,
      hipY: 0.05 * u,
    });
  },
  kickOffTap: (c) => {
    const u = hit(clamp01(c.u), 0.4);
    return pose({
      legRPitch: 0.7 * u,
      kneeR: -0.4 * u,
      ankleR: 0.25 * u,
      spine: 0.1,
      headPitch: 0.24,
      armLRoll: 0.4,
      armRRoll: -0.4,
      elbowL: -0.5,
      elbowR: -0.5,
      kneeL: -0.2,
    });
  },
  dropBall: (c) =>
    mixPose(
      stance(c),
      pose({
        hipPitch: 0.3,
        spine: 0.3,
        headPitch: 0.5,
        kneeL: -0.5,
        kneeR: -0.5,
        armLPitch: -0.4,
        armRPitch: -0.4,
        elbowL: -0.9,
        elbowR: -0.9,
      }),
      0.6,
    ),
  lineUpPose: (c) =>
    pose({
      spine: 0.03,
      chest: 0.05,
      headPitch: -0.08,
      armLPitch: -0.9,
      armRPitch: -0.9,
      armLRoll: 1.2,
      armRRoll: -1.2,
      elbowL: -1.7,
      elbowR: -1.7,
      kneeL: -0.1,
      kneeR: -0.1,
      hipY: sin(c.t * 1.1 + c.seed) * 0.008,
    }),
  coinToss: (c) =>
    mixPose(
      stance(c, 0.6),
      pose({
        headPitch: -0.3,
        armRPitch: -1.7,
        armRRoll: -0.6,
        elbowR: -0.6,
        chest: 0.06,
        headYaw: sin(c.t * 1.2) * 0.2,
      }),
      0.7,
    ),

  // -------------------------------------------------- comemorações (12)
  celebrateSlideStop: (c) => {
    const u = ease(clamp01(c.u));
    return pose({
      hipY: -0.4 - 0.05 * (1 - u),
      hipPitch: -0.4,
      spine: -0.34,
      headPitch: -0.45,
      legLPitch: 1.35,
      legRPitch: 1.25,
      kneeL: -1.7,
      kneeR: -1.6,
      armLPitch: -2.5,
      armRPitch: -2.5,
      armLRoll: 1.05,
      armRRoll: -1.05,
      hipRoll: sin(c.t * 5) * 0.06,
    });
  },
  celebrateHeart: (c) =>
    pose({
      spine: -0.08,
      chest: -0.05,
      headPitch: -0.15,
      armLPitch: -1.5,
      armRPitch: -1.5,
      armLRoll: 1.15,
      armRRoll: -1.15,
      elbowL: -1.55,
      elbowR: -1.55,
      hipY: Math.abs(sin(c.t * 3)) * 0.03,
      headYaw: sin(c.t * 1.6) * 0.2,
      kneeL: -0.12,
      kneeR: -0.12,
    }),
  celebrateShush: (c) =>
    pose({
      spine: -0.1,
      chest: -0.08,
      headPitch: -0.2,
      headYaw: sin(c.t * 1.2) * 0.3,
      armRPitch: -2.3,
      armRRoll: -0.8,
      elbowR: -1.7,
      armLPitch: -0.6,
      armLRoll: 1.0,
      elbowL: -1.2,
      hipY: Math.abs(sin(c.t * 2.4)) * 0.03,
    }),
  celebrateSiuu: (c) => {
    const u = hit(clamp01(c.u), 0.35);
    return pose({
      hipY: 0.4 * u,
      spine: -0.2 * u,
      chest: -0.12,
      headPitch: -0.3 * u,
      armLPitch: 0.9 * u,
      armRPitch: 0.9 * u,
      armLRoll: 0.9 * u,
      armRRoll: -0.9 * u,
      elbowL: -0.15,
      elbowR: -0.15,
      legLPitch: -0.3 * u,
      legRPitch: -0.3 * u,
      kneeL: -0.45 * u,
      kneeR: -0.45 * u,
    });
  },
  celebrateSpin: (c) =>
    pose({
      hipYaw: c.t * 4,
      hipRoll: sin(c.t * 4) * 0.1,
      spine: -0.12,
      armLPitch: -1.9,
      armRPitch: -1.9,
      armLRoll: 1.25,
      armRRoll: -1.25,
      elbowL: -0.4,
      elbowR: -0.4,
      headPitch: -0.3,
      hipY: Math.abs(sin(c.t * 6)) * 0.05,
      kneeL: -0.2,
      kneeR: -0.2,
    }),
  celebrateCornerFlag: (c) =>
    mixPose(
      gait(c, { rate: 9, amp: 0.7, knee: 1.2, armAmp: 0.4, lean: 0.14, bob: 0.05 }),
      pose({
        armRPitch: -2.6,
        armRRoll: -0.9,
        elbowR: -0.3,
        armLPitch: -1.2,
        armLRoll: 1.0,
        headYaw: 0.35,
        headPitch: -0.2,
      }),
      0.6,
    ),
  celebrateShirtPull: (c) =>
    pose({
      spine: -0.14,
      chest: -0.1,
      headPitch: -0.34,
      armLPitch: -1.9,
      armRPitch: -1.9,
      armLRoll: 0.9,
      armRRoll: -0.9,
      elbowL: -1.9,
      elbowR: -1.9,
      hipY: Math.abs(sin(c.t * 3.2)) * 0.04,
      kneeL: -0.18,
      kneeR: -0.18,
      hipRoll: sin(c.t * 1.8) * 0.08,
    }),
  celebratePoint: (c) =>
    pose({
      spine: -0.06,
      chest: 0.05,
      headYaw: 0.35,
      headPitch: -0.14,
      armLPitch: -2.5,
      armLRoll: 0.7,
      elbowL: -0.2,
      armRPitch: -1.0,
      armRRoll: -0.9,
      elbowR: -1.4,
      hipY: Math.abs(sin(c.t * 2.6)) * 0.03,
    }),
  celebrateCalm: (c) =>
    pose({
      spine: -0.05,
      chest: 0.04,
      headPitch: -0.1,
      armLPitch: -0.7,
      armRPitch: -0.7,
      armLRoll: 1.3,
      armRRoll: -1.3,
      elbowL: -0.5,
      elbowR: -0.5,
      hipY: sin(c.t * 1.6) * 0.02,
      kneeL: -0.1,
      kneeR: -0.1,
      headYaw: sin(c.t * 0.9) * 0.28,
    }),
  celebrateTeamLine: (c) =>
    pose({
      spine: -0.05,
      chest: 0.06,
      armLPitch: -1.0,
      armRPitch: -1.0,
      armLRoll: 1.45,
      armRRoll: -1.45,
      elbowL: -0.35,
      elbowR: -0.35,
      hipY: Math.abs(sin(c.t * 2.2 + c.seed)) * 0.05,
      headPitch: -0.16,
      headYaw: sin(c.t * 1.1) * 0.2,
      kneeL: -0.14,
      kneeR: -0.14,
    }),
  celebrateFistPump: (c) => {
    const p = Math.abs(sin(c.t * 5 + c.seed));
    return pose({
      spine: 0.1 - p * 0.2,
      chest: 0.06,
      headPitch: -0.2 * p,
      armRPitch: -0.6 - p * 1.9,
      armRRoll: -0.7,
      elbowR: -1.6 + p * 0.8,
      armLPitch: -0.5,
      armLRoll: 0.8,
      elbowL: -1.4,
      hipY: p * 0.05,
      kneeL: -0.2 + p * 0.15,
      kneeR: -0.2 + p * 0.15,
    });
  },
  celebrateJumpHug: (c) => {
    const u = hit(clamp01(c.u), 0.4);
    return pose({
      hipY: 0.36 * u,
      legLPitch: 0.9 * u,
      legRPitch: 0.9 * u,
      kneeL: -1.5 * u,
      kneeR: -1.5 * u,
      armLPitch: -1.6 * u,
      armRPitch: -1.6 * u,
      armLRoll: 1.3,
      armRRoll: -1.3,
      elbowL: -1.5,
      elbowR: -1.5,
      spine: 0.1 * u,
      headPitch: 0.1,
    });
  },

  // ---------------------------------------------------- reações (7)
  handsOnHead: (c) =>
    pose({
      spine: 0.16,
      chest: -0.05,
      headPitch: 0.2,
      armLPitch: -2.5,
      armRPitch: -2.5,
      armLRoll: 0.9,
      armRRoll: -0.9,
      elbowL: -2.0,
      elbowR: -2.0,
      hipY: -0.03 + sin(c.t * 1.5 + c.seed) * 0.02,
      kneeL: -0.18,
      kneeR: -0.18,
    }),
  handsOnHips: (c) =>
    pose({
      spine: 0.12,
      chest: 0.04,
      headPitch: 0.1,
      headYaw: sin(c.t * 0.8 + c.seed) * 0.3,
      armLPitch: -0.5,
      armRPitch: -0.5,
      armLRoll: 1.35,
      armRRoll: -1.35,
      elbowL: -1.9,
      elbowR: -1.9,
      hipY: sin(c.t * 1.4) * 0.02,
      kneeL: -0.14,
      kneeR: -0.14,
    }),
  injuryGround: (c) =>
    pose({
      hipY: -0.72,
      hipPitch: 0.4,
      hipRoll: 0.9,
      spine: 0.4,
      chest: 0.2,
      headPitch: 0.3,
      legLPitch: 1.2,
      kneeL: -1.9,
      legRPitch: 0.9,
      kneeR: -1.5,
      armLPitch: -1.6,
      armRPitch: -1.2,
      armLRoll: 1.2,
      armRRoll: -1.0,
      elbowL: -1.8,
      elbowR: -1.6,
      headYaw: sin(c.t * 1.2) * 0.2,
    }),
  injuryLimp: (c) => {
    const t = c.t * 3.6 + c.seed;
    const s = sin(t);
    return pose({
      hipY: Math.abs(sin(t * 2)) * 0.03 - 0.04,
      hipPitch: 0.24,
      hipRoll: s * 0.16,
      spine: 0.3,
      headPitch: 0.24,
      legLPitch: s * 0.5,
      legRPitch: sin(t + Math.PI) * 0.25,
      kneeL: -0.9,
      kneeR: -0.35,
      ankleL: 0.2,
      armLPitch: -0.8,
      armRPitch: -0.3,
      armLRoll: 0.9,
      armRRoll: -0.5,
      elbowL: -1.4,
      elbowR: -0.9,
    });
  },
  argueRef: (c) =>
    pose({
      spine: -0.1,
      chest: -0.06,
      headPitch: -0.16,
      headYaw: sin(c.t * 4) * 0.24,
      armLPitch: -1.3 + sin(c.t * 6.5) * 0.7,
      armRPitch: -1.3 - sin(c.t * 6.5) * 0.7,
      armLRoll: 1.1,
      armRRoll: -1.1,
      elbowL: -1.3,
      elbowR: -1.3,
      hipRoll: sin(c.t * 2) * 0.08,
      kneeL: -0.16,
      kneeR: -0.16,
    }),
  applaudFans: (c) => {
    const p = Math.abs(sin(c.t * 7 + c.seed));
    return pose({
      spine: -0.04,
      chest: 0.05,
      headPitch: -0.14,
      headYaw: sin(c.t * 0.9) * 0.35,
      armLPitch: -1.7,
      armRPitch: -1.7,
      armLRoll: 0.8 + p * 0.3,
      armRRoll: -0.8 - p * 0.3,
      elbowL: -1.5 + p * 0.4,
      elbowR: -1.5 + p * 0.4,
      hipY: sin(c.t * 1.5) * 0.015,
    });
  },
  catchBreathKnees: (c) =>
    pose({
      hipY: -0.28,
      hipPitch: 0.85,
      spine: 0.5 + sin(c.t * 2.2 + c.seed) * 0.05,
      chest: 0.16,
      headPitch: 0.4,
      kneeL: -0.8,
      kneeR: -0.8,
      armLPitch: -0.5,
      armRPitch: -0.5,
      armLRoll: 0.75,
      armRRoll: -0.75,
      elbowL: -1.0,
      elbowR: -1.0,
    }),
} satisfies Record<string, Clip>;

/** número de animações adicionadas por este módulo (89) */
export const EXTRA_CLIP_COUNT = Object.keys(EXTRA_CLIPS).length;
