// ============================================================================
//  animation-extra2.ts
//  Mais 89 clipes procedurais: peso e inércia na corrida, dribles, disputas,
//  faltas, goleiro, banco/árbitro, comemorações e reações de cansaço.
//
//  Mesma assinatura dos demais clipes: recebem o contexto e devolvem a pose
//  completa. São mesclados em `animation.ts` junto com os outros pacotes.
// ============================================================================

import { emptyPose, mixPose, type Clip, type ClipCtx, type Pose } from "./animation-core";

const sin = Math.sin;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const hit = (u: number, peak = 0.45) =>
  u < peak ? u / peak : 1 - clamp01((u - peak) / (1 - peak));
const ease = (u: number) => u * u * (3 - 2 * u);

function pose(partial: Partial<Pose>): Pose {
  const p = emptyPose();
  Object.assign(p, partial);
  return p;
}

/**
 * Passada com peso: o tronco cai para frente na arrancada, o quadril sobe e
 * desce, os braços cruzam o corpo e o pé "assenta" no chão no fim do apoio.
 */
function stride(
  c: ClipCtx,
  o: {
    rate: number;
    amp: number;
    knee: number;
    armAmp: number;
    lean: number;
    bob: number;
    drive?: number;
  },
): Pose {
  const t = c.t * o.rate + c.seed;
  const s = sin(t);
  const s2 = sin(t + Math.PI);
  const drive = o.drive ?? 0;
  const plant = clamp01(-s + 0.5);
  return pose({
    hipY: Math.abs(sin(t * 2)) * o.bob - plant * 0.02,
    hipPitch: o.lean + drive * 0.1,
    hipRoll: s * 0.05,
    hipYaw: -s * 0.1,
    spine: o.lean * 0.55,
    chest: sin(t * 2) * 0.05,
    headPitch: -o.lean * 0.6,
    headYaw: -s * 0.05,
    legLPitch: s * o.amp,
    legRPitch: s2 * o.amp,
    legLRoll: s * 0.03,
    legRRoll: -s * 0.03,
    kneeL: -clamp01(-s + 0.3) * o.knee,
    kneeR: -clamp01(-s2 + 0.3) * o.knee,
    ankleL: s * 0.28 - plant * 0.12,
    ankleR: s2 * 0.28,
    armLPitch: s2 * o.armAmp,
    armRPitch: s * o.armAmp,
    elbowL: -0.55 - Math.abs(s2) * 0.55,
    elbowR: -0.55 - Math.abs(s) * 0.55,
    armLRoll: 0.16 + Math.abs(s2) * 0.06,
    armRRoll: -0.16 - Math.abs(s) * 0.06,
  });
}

/** respiração: quanto menor a energia, mais o peito abre e o ombro sobe */
function breathe(c: ClipCtx, k = 1): Pose {
  const b = sin(c.t * 2.1 + c.seed);
  return pose({
    chest: b * 0.07 * k,
    spine: 0.05 * k + b * 0.03 * k,
    hipY: b * 0.012 * k,
    headPitch: 0.05 * k - b * 0.03 * k,
    armLRoll: 0.1 * k + b * 0.05 * k,
    armRRoll: -0.1 * k - b * 0.05 * k,
  });
}

function guard(c: ClipCtx, depth = 1): Pose {
  const b = sin(c.t * 3.2 + c.seed) * 0.03;
  return pose({
    hipY: -0.13 * depth,
    hipPitch: 0.22 * depth,
    spine: 0.18 * depth,
    kneeL: -0.58 * depth + b,
    kneeR: -0.58 * depth - b,
    legLRoll: 0.18,
    legRRoll: -0.18,
    armLRoll: 0.66,
    armRRoll: -0.66,
    elbowL: -0.85,
    elbowR: -0.85,
    headPitch: -0.12,
  });
}

export const EXTRA2_CLIPS = {
  // ------------------------------------------- corrida com peso e inércia (16)
  runHeavy: (c) =>
    stride(c, { rate: 8.4, amp: 0.72, knee: 1.25, armAmp: 0.8, lean: 0.24, bob: 0.05, drive: 0.5 }),
  runRelaxed: (c) =>
    stride(c, { rate: 7.2, amp: 0.58, knee: 1.0, armAmp: 0.55, lean: 0.12, bob: 0.035 }),
  runTired: (c) =>
    mixPose(
      stride(c, { rate: 6.2, amp: 0.5, knee: 0.9, armAmp: 0.4, lean: 0.3, bob: 0.03 }),
      breathe(c, 1.2),
      0.45,
    ),
  sprintFlatOut: (c) =>
    stride(c, { rate: 12.5, amp: 1.05, knee: 1.75, armAmp: 1.2, lean: 0.38, bob: 0.062, drive: 1 }),
  sprintEasing: (c) =>
    stride(c, { rate: 9.6, amp: 0.84, knee: 1.4, armAmp: 0.9, lean: 0.2, bob: 0.05 }),
  accelBurst: (c) => {
    const u = ease(clamp01(c.u));
    return mixPose(
      stride(c, {
        rate: 11,
        amp: 0.95,
        knee: 1.6,
        armAmp: 1.1,
        lean: 0.44 - u * 0.14,
        bob: 0.055,
        drive: 1,
      }),
      pose({ hipPitch: 0.5 * (1 - u), spine: 0.4 * (1 - u) }),
      0.35,
    );
  },
  decelSteps: (c) => {
    const u = ease(clamp01(c.u));
    return mixPose(
      stride(c, { rate: 8 - u * 4, amp: 0.6, knee: 1.1, armAmp: 0.6, lean: -0.18 * u, bob: 0.03 }),
      pose({ hipY: -0.08 * u, spine: -0.2 * u }),
      0.4,
    );
  },
  leanIntoTurnL: (c) =>
    mixPose(
      stride(c, { rate: 9.4, amp: 0.78, knee: 1.35, armAmp: 0.85, lean: 0.22, bob: 0.05 }),
      pose({ hipRoll: 0.3, hipYaw: 0.22, chest: 0.14, headYaw: 0.3, legLRoll: 0.2 }),
      0.6,
    ),
  leanIntoTurnR: (c) =>
    mixPose(
      stride(c, { rate: 9.4, amp: 0.78, knee: 1.35, armAmp: 0.85, lean: 0.22, bob: 0.05 }),
      pose({ hipRoll: -0.3, hipYaw: -0.22, chest: -0.14, headYaw: -0.3, legRRoll: -0.2 }),
      0.6,
    ),
  sideGallopL: (c) =>
    pose({
      hipY: Math.abs(sin(c.t * 8)) * 0.04,
      hipRoll: 0.2,
      hipYaw: 0.3,
      legLPitch: sin(c.t * 8) * 0.5,
      legRPitch: -sin(c.t * 8) * 0.35,
      kneeL: -0.7,
      kneeR: -0.6,
      spine: 0.14,
      armLPitch: -0.5,
      armRPitch: -0.3,
      armLRoll: 0.8,
      armRRoll: -0.6,
      elbowL: -0.9,
      elbowR: -0.8,
      headYaw: 0.3,
    }),
  sideGallopR: (c) =>
    pose({
      hipY: Math.abs(sin(c.t * 8)) * 0.04,
      hipRoll: -0.2,
      hipYaw: -0.3,
      legRPitch: sin(c.t * 8) * 0.5,
      legLPitch: -sin(c.t * 8) * 0.35,
      kneeR: -0.7,
      kneeL: -0.6,
      spine: 0.14,
      armRPitch: -0.5,
      armLPitch: -0.3,
      armRRoll: -0.8,
      armLRoll: 0.6,
      elbowR: -0.9,
      elbowL: -0.8,
      headYaw: -0.3,
    }),
  backpedalFast: (c) =>
    mixPose(
      stride(c, { rate: 8.6, amp: 0.46, knee: 0.95, armAmp: 0.5, lean: -0.22, bob: 0.032 }),
      pose({ chest: -0.14, headYaw: sin(c.t * 1.5) * 0.4, headPitch: -0.08 }),
      0.55,
    ),
  checkShoulder: (c) =>
    mixPose(
      stride(c, { rate: 7.6, amp: 0.6, knee: 1.05, armAmp: 0.6, lean: 0.16, bob: 0.04 }),
      pose({ headYaw: sin(c.t * 1.1 + c.seed) * 0.85, chest: sin(c.t * 1.1) * 0.16 }),
      0.5,
    ),
  skipStep: (c) => {
    const p = Math.abs(sin(c.t * 6 + c.seed));
    return pose({
      hipY: p * 0.07,
      legLPitch: 0.6 * p,
      kneeL: -1.2 * p,
      legRPitch: -0.25 * p,
      kneeR: -0.3,
      ankleL: 0.3 * p,
      spine: 0.1,
      armLPitch: -0.6 * p,
      armRPitch: 0.5 * p,
      armLRoll: 0.4,
      armRRoll: -0.4,
      elbowL: -0.9,
      elbowR: -0.9,
    });
  },
  slowJogHandsUp: (c) =>
    mixPose(
      stride(c, { rate: 5.6, amp: 0.4, knee: 0.8, armAmp: 0.2, lean: 0.08, bob: 0.03 }),
      pose({ armLPitch: -2.3, armLRoll: 0.7, elbowL: -0.5, headYaw: 0.3 }),
      0.5,
    ),
  walkTalk: (c) =>
    mixPose(
      stride(c, { rate: 3.4, amp: 0.3, knee: 0.5, armAmp: 0.18, lean: 0.02, bob: 0.015 }),
      pose({
        headYaw: 0.5 + sin(c.t * 2.2) * 0.16,
        chest: 0.16,
        armRPitch: -0.9 + sin(c.t * 4) * 0.4,
        armRRoll: -0.7,
        elbowR: -1.4,
      }),
      0.55,
    ),

  // -------------------------------------------------------- dribles (14)
  elasticoOut: (c) => {
    const u = hit(clamp01(c.u), 0.4);
    return pose({
      hipYaw: -0.36 * u,
      hipRoll: -0.16 * u,
      legRPitch: 0.85 * u,
      legRRoll: -0.55 * u,
      kneeR: -0.5,
      ankleR: 0.3 * u,
      kneeL: -0.5,
      spine: 0.2,
      chest: 0.2 * u,
      headPitch: 0.28,
      armLRoll: 0.9,
      armRRoll: -0.9,
      elbowL: -1.0,
      elbowR: -1.0,
    });
  },
  elasticoIn: (c) => {
    const u = hit(clamp01(c.u), 0.4);
    return pose({
      hipYaw: 0.36 * u,
      hipRoll: 0.16 * u,
      legRPitch: 0.85 * u,
      legRRoll: 0.55 * u,
      kneeR: -0.5,
      ankleR: 0.3 * u,
      kneeL: -0.5,
      spine: 0.2,
      chest: -0.2 * u,
      headPitch: 0.28,
      armLRoll: 0.9,
      armRRoll: -0.9,
      elbowL: -1.0,
      elbowR: -1.0,
    });
  },
  stepOverSlow: (c) => {
    const p = sin(c.t * 7 + c.seed);
    return pose({
      hipY: Math.abs(p) * 0.025,
      hipRoll: p * 0.12,
      legLPitch: p * 0.5,
      legLRoll: p * 0.34,
      kneeL: -0.7,
      kneeR: -0.6,
      spine: 0.18,
      chest: -p * 0.1,
      armLRoll: 0.8,
      armRRoll: -0.8,
      elbowL: -0.9,
      elbowR: -0.9,
      headPitch: 0.26,
    });
  },
  bodyFeintLeft: (c) => {
    const u = hit(clamp01(c.u), 0.45);
    return pose({
      hipRoll: 0.34 * u,
      hipYaw: 0.3 * u,
      chest: 0.26 * u,
      spine: 0.16,
      headYaw: 0.4 * u,
      kneeL: -0.75,
      kneeR: -0.45,
      legLRoll: 0.26 * u,
      armLRoll: 1.0,
      armRRoll: -0.7,
      elbowL: -0.9,
      elbowR: -1.0,
      hipY: -0.04,
    });
  },
  bodyFeintRight: (c) => {
    const u = hit(clamp01(c.u), 0.45);
    return pose({
      hipRoll: -0.34 * u,
      hipYaw: -0.3 * u,
      chest: -0.26 * u,
      spine: 0.16,
      headYaw: -0.4 * u,
      kneeR: -0.75,
      kneeL: -0.45,
      legRRoll: -0.26 * u,
      armRRoll: -1.0,
      armLRoll: 0.7,
      elbowR: -0.9,
      elbowL: -1.0,
      hipY: -0.04,
    });
  },
  fakeShotStop: (c) => {
    const u = hit(clamp01(c.u), 0.35);
    return pose({
      legRPitch: -0.6 * u + 0.4 * clamp01(c.u),
      kneeR: -1.0 * u,
      spine: -0.16 * u + 0.14,
      chest: 0.2 * u,
      hipYaw: -0.2 * u,
      kneeL: -0.5,
      armLPitch: -1.2 * u,
      armRPitch: 0.5 * u,
      armLRoll: 1.1,
      armRRoll: -0.6,
      headPitch: 0.24,
    });
  },
  dragPush: (c) => {
    const u = clamp01(c.u);
    return pose({
      legRPitch: -0.4 + 1.2 * u,
      kneeR: -0.9 + 0.5 * u,
      ankleR: -0.3 + 0.6 * u,
      hipPitch: 0.16,
      spine: 0.2,
      hipYaw: 0.18 * (1 - u),
      headPitch: 0.3,
      armLRoll: 0.85,
      armRRoll: -0.85,
      elbowL: -0.95,
      elbowR: -0.95,
      kneeL: -0.5,
    });
  },
  scoopLift: (c) => {
    const u = hit(clamp01(c.u), 0.45);
    return pose({
      legRPitch: 0.9 * u,
      kneeR: -0.7 * u,
      ankleR: 0.6 * u,
      hipPitch: -0.14 * u,
      spine: -0.12 * u,
      hipY: 0.04 * u,
      armLPitch: -1.3 * u,
      armRPitch: 0.8 * u,
      armLRoll: 1.15,
      armRRoll: -0.6,
      headPitch: 0.1,
      kneeL: -0.45,
    });
  },
  flipFlap: (c) => {
    const p = sin(c.t * 11 + c.seed);
    return pose({
      legRRoll: p * 0.6,
      legRPitch: 0.6 + p * 0.2,
      kneeR: -0.55,
      hipRoll: p * 0.14,
      hipYaw: -p * 0.2,
      spine: 0.2,
      chest: p * 0.16,
      kneeL: -0.55,
      armLRoll: 0.9,
      armRRoll: -0.9,
      elbowL: -0.95,
      elbowR: -0.95,
      headPitch: 0.28,
    });
  },
  crossoverDribble: (c) => {
    const p = sin(c.t * 6 + c.seed);
    return mixPose(
      stride(c, { rate: 7.4, amp: 0.52, knee: 1.0, armAmp: 0.5, lean: 0.18, bob: 0.035 }),
      pose({ hipYaw: p * 0.28, hipRoll: p * 0.14, headPitch: 0.26 }),
      0.5,
    );
  },
  shieldTurnOut: (c) => {
    const u = ease(clamp01(c.u));
    return pose({
      hipYaw: 0.5 - u * 1.6,
      chest: 0.3 - u * 0.5,
      spine: 0.22,
      headYaw: -0.5 + u * 1.0,
      kneeL: -0.55,
      kneeR: -0.55,
      armLRoll: 1.3 - u * 0.4,
      armRRoll: -0.7,
      elbowL: -0.6,
      elbowR: -1.1,
      hipY: -0.05,
    });
  },
  ballRollSole: (c) =>
    pose({
      legRPitch: 0.45 + sin(c.t * 4 + c.seed) * 0.3,
      kneeR: -0.7,
      ankleR: -0.3,
      hipPitch: 0.14,
      spine: 0.18,
      headPitch: 0.34,
      kneeL: -0.5,
      armLRoll: 0.8,
      armRRoll: -0.8,
      elbowL: -0.95,
      elbowR: -0.95,
      hipY: -0.03,
    }),
  juggleKeepUp: (c) => {
    const p = Math.abs(sin(c.t * 4 + c.seed));
    return pose({
      legRPitch: 0.5 + p * 0.6,
      kneeR: -1.0 - p * 0.3,
      ankleR: 0.35,
      hipY: p * 0.03,
      spine: 0.06,
      headPitch: 0.4,
      armLRoll: 0.95,
      armRRoll: -0.95,
      elbowL: -0.7,
      elbowR: -0.7,
      kneeL: -0.2,
    });
  },
  firstTouchAway: (c) => {
    const u = hit(clamp01(c.u), 0.35);
    return pose({
      legRPitch: 0.75 * u,
      legRRoll: -0.35 * u,
      kneeR: -0.6 * u,
      ankleR: 0.3 * u,
      hipYaw: -0.22 * u,
      chest: 0.18 * u,
      spine: 0.14,
      headPitch: 0.3,
      kneeL: -0.45,
      armLRoll: 0.9,
      armRRoll: -0.75,
      elbowL: -0.9,
      elbowR: -0.9,
    });
  },

  // ---------------------------------------------- disputa e contato (12)
  shoulderToShoulder: (c) =>
    pose({
      hipRoll: 0.24,
      chest: 0.34,
      spine: 0.24,
      hipYaw: 0.18,
      headYaw: -0.34,
      armLPitch: -0.4,
      armLRoll: 1.25,
      elbowL: -0.75,
      armRRoll: -0.6,
      elbowR: -1.1,
      kneeL: -0.6,
      kneeR: -0.52,
      hipY: -0.06 + sin(c.t * 3 + c.seed) * 0.02,
    }),
  armBarHold: (c) =>
    pose({
      spine: 0.16,
      chest: 0.1,
      armLPitch: -1.5,
      armLRoll: 1.15,
      elbowL: -0.3,
      armRPitch: -0.4,
      armRRoll: -0.7,
      elbowR: -1.2,
      headYaw: -0.3,
      kneeL: -0.45,
      kneeR: -0.45,
      hipY: -0.04 + sin(c.t * 2.6) * 0.015,
    }),
  jumpDuelUp: (c) => {
    const u = hit(clamp01(c.u), 0.45);
    return pose({
      hipY: 0.46 * u,
      legLPitch: 0.5 * u,
      legRPitch: -0.35 * u,
      kneeL: -1.1 * (1 - u) - 0.2,
      kneeR: -1.1 * (1 - u) - 0.35,
      spine: -0.24 * u,
      armLPitch: -2.4 * u,
      armRPitch: -1.6 * u,
      armLRoll: 0.85,
      armRRoll: -0.7,
      headPitch: -0.4 * u,
    });
  },
  fallForward: (c) => {
    const u = ease(clamp01(c.u));
    return pose({
      hipY: -0.7 * u,
      hipPitch: 0.9 * u,
      spine: 0.5 * u,
      chest: 0.2 * u,
      headPitch: 0.4 * u,
      legLPitch: 0.6 * u,
      legRPitch: 0.4 * u,
      kneeL: -1.4 * u,
      kneeR: -1.2 * u,
      armLPitch: -2.3 * u,
      armRPitch: -2.3 * u,
      armLRoll: 0.9,
      armRRoll: -0.9,
      elbowL: -0.5,
      elbowR: -0.5,
    });
  },
  fallBack: (c) => {
    const u = ease(clamp01(c.u));
    return pose({
      hipY: -0.7 * u,
      hipPitch: -0.9 * u,
      spine: -0.4 * u,
      chest: -0.3 * u,
      headPitch: -0.35 * u,
      legLPitch: -0.7 * u,
      legRPitch: -0.5 * u,
      kneeL: -0.9 * u,
      kneeR: -0.7 * u,
      armLPitch: -2.6 * u,
      armRPitch: -2.6 * u,
      armLRoll: 1.0,
      armRRoll: -1.0,
    });
  },
  getUpFast: (c) => {
    const u = ease(clamp01(c.u));
    return pose({
      hipY: -0.7 * (1 - u),
      hipPitch: 0.9 * (1 - u),
      spine: 0.5 * (1 - u),
      kneeL: -1.5 * (1 - u) - 0.1,
      kneeR: -1.2 * (1 - u) - 0.1,
      armLPitch: -1.6 * (1 - u),
      armRPitch: -1.4 * (1 - u),
      armLRoll: 0.8,
      armRRoll: -0.8,
      headPitch: 0.3 * (1 - u),
    });
  },
  pushOff: (c) => {
    const u = hit(clamp01(c.u), 0.35);
    return pose({
      armLPitch: -1.9 * u,
      armLRoll: 1.0,
      elbowL: -1.4 + 1.2 * u,
      armRPitch: -0.5,
      armRRoll: -0.7,
      elbowR: -1.2,
      chest: 0.28 * u,
      spine: 0.1,
      hipYaw: 0.16 * u,
      kneeL: -0.4,
      kneeR: -0.4,
      headYaw: -0.24 * u,
    });
  },
  tackleStandUp: (c) => {
    const u = hit(clamp01(c.u), 0.4);
    return pose({
      hipY: -0.2 * u,
      hipPitch: 0.4 * u,
      spine: 0.3 * u,
      legRPitch: 0.9 * u,
      kneeR: -0.6 * u,
      ankleR: 0.35 * u,
      legLPitch: -0.2,
      kneeL: -0.7,
      armLPitch: -1.3 * u,
      armRPitch: -0.7 * u,
      armLRoll: 1.1,
      armRRoll: -0.9,
      headPitch: 0.34,
    });
  },
  slideTackleLong: (c) => {
    const u = ease(clamp01(c.u));
    return pose({
      hipY: -0.62 * u,
      hipRoll: 0.75 * u,
      hipPitch: 0.1,
      legLPitch: 1.6 * u,
      kneeL: -0.2,
      legRPitch: 0.5 * u,
      kneeR: -1.45 * u,
      spine: 0.1,
      chest: -0.3 * u,
      armLPitch: -2.2 * u,
      armRPitch: -1.4 * u,
      armLRoll: 1.25,
      armRRoll: -1.1,
      headPitch: 0.1,
    });
  },
  foulTrip: (c) => {
    const u = hit(clamp01(c.u), 0.4);
    return pose({
      legRPitch: 0.9 * u,
      legRRoll: -0.4 * u,
      kneeR: -0.7 * u,
      hipRoll: -0.2 * u,
      spine: 0.22,
      chest: -0.2 * u,
      armLRoll: 1.05,
      armRRoll: -0.9,
      elbowL: -0.8,
      elbowR: -0.9,
      headPitch: 0.3,
      kneeL: -0.5,
    });
  },
  protestHandsOut: (c) =>
    pose({
      spine: -0.08,
      chest: 0.06,
      headPitch: -0.14,
      headYaw: sin(c.t * 3 + c.seed) * 0.2,
      armLPitch: -1.1,
      armRPitch: -1.1,
      armLRoll: 1.35,
      armRRoll: -1.35,
      elbowL: -0.7,
      elbowR: -0.7,
      hipRoll: sin(c.t * 1.6) * 0.06,
      kneeL: -0.14,
      kneeR: -0.14,
    }),
  bookedReaction: (c) =>
    pose({
      spine: 0.12,
      chest: -0.06,
      headPitch: 0.24,
      headYaw: sin(c.t * 1.2 + c.seed) * 0.4,
      armLPitch: -1.9,
      armLRoll: 1.1,
      elbowL: -1.7,
      armRPitch: -0.4,
      armRRoll: -1.2,
      elbowR: -1.9,
      hipY: -0.02,
      kneeL: -0.16,
      kneeR: -0.16,
    }),

  // --------------------------------------------- finalização e passes (12)
  volleyStrong: (c) => {
    const u = hit(clamp01(c.u), 0.4);
    return pose({
      hipY: 0.12 * u,
      hipYaw: -0.35 * u,
      chest: 0.42 * u,
      spine: -0.26 * u,
      legRPitch: -0.4 + 2.2 * u,
      kneeR: -0.9 + 0.85 * u,
      ankleR: 0.3 * u,
      legLPitch: -0.3 * u,
      kneeL: -0.8 * u,
      armLPitch: -2.3 * u,
      armRPitch: 1.3 * u,
      armLRoll: 1.3,
      armRRoll: -0.8,
      headPitch: 0.2 * u,
    });
  },
  bicycleKick: (c) => {
    const u = hit(clamp01(c.u), 0.5);
    return pose({
      hipY: 0.55 * u,
      hipPitch: -1.4 * u,
      spine: -0.5 * u,
      chest: -0.3 * u,
      headPitch: -0.5 * u,
      legRPitch: -1.8 * u,
      kneeR: -0.3,
      legLPitch: 0.9 * u,
      kneeL: -1.2 * u,
      armLPitch: -2.8 * u,
      armRPitch: -2.4 * u,
      armLRoll: 1.0,
      armRRoll: -1.0,
    });
  },
  chipDelicate: (c) => {
    const u = hit(clamp01(c.u), 0.45);
    return pose({
      legRPitch: -0.3 + 1.2 * u,
      kneeR: -0.7 + 0.5 * u,
      ankleR: -0.5 * u,
      spine: -0.14 * u,
      hipPitch: -0.1 * u,
      armLPitch: -1.2 * u,
      armRPitch: 0.7 * u,
      armLRoll: 1.05,
      armRRoll: -0.6,
      headPitch: -0.06,
      kneeL: -0.4,
    });
  },
  curlFarPost: (c) => {
    const u = hit(clamp01(c.u), 0.42);
    return pose({
      hipYaw: -0.45 * u,
      chest: 0.34 * u,
      spine: -0.16 * u,
      legRPitch: -0.7 + 1.9 * u,
      legRRoll: -0.45 * u,
      kneeR: -1.05 + 0.9 * u,
      ankleR: 0.3 * u,
      kneeL: -0.4,
      armLPitch: -1.8 * u,
      armRPitch: 1.0 * u,
      armLRoll: 1.25,
      armRRoll: -0.7,
      headYaw: 0.25 * u,
    });
  },
  powerHeader: (c) => {
    const u = hit(clamp01(c.u), 0.45);
    return pose({
      hipY: 0.48 * u,
      spine: -0.42 * u,
      chest: -0.3 * u,
      headPitch: -0.55 * u,
      legLPitch: 0.5 * u,
      legRPitch: -0.4 * u,
      kneeL: -1.0 * (1 - u) - 0.2,
      kneeR: -1.0 * (1 - u) - 0.4,
      armLPitch: -2.4 * u,
      armRPitch: -2.0 * u,
      armLRoll: 0.9,
      armRRoll: -0.9,
    });
  },
  glancingHeader: (c) => {
    const u = hit(clamp01(c.u), 0.45);
    return pose({
      hipY: 0.36 * u,
      headYaw: 0.5 * u,
      headPitch: -0.25 * u,
      spine: -0.2 * u,
      chest: 0.2 * u,
      legLPitch: 0.4 * u,
      kneeL: -0.9 * (1 - u) - 0.2,
      kneeR: -0.7,
      armLPitch: -2.0 * u,
      armRPitch: -1.5 * u,
      armLRoll: 0.85,
      armRRoll: -0.75,
    });
  },
  lowDrivenPass: (c) => {
    const u = hit(clamp01(c.u), 0.38);
    return pose({
      legRPitch: -0.3 + 1.5 * u,
      kneeR: -0.8 + 0.6 * u,
      ankleR: 0.2 * u,
      hipYaw: -0.2 * u,
      chest: 0.22 * u,
      spine: 0.1,
      armLPitch: -1.3 * u,
      armRPitch: 0.7 * u,
      armLRoll: 1.1,
      armRRoll: -0.65,
      headPitch: 0.16,
      kneeL: -0.42,
    });
  },
  switchPlayLong: (c) => {
    const u = hit(clamp01(c.u), 0.46);
    return pose({
      hipYaw: -0.5 * u,
      chest: 0.45 * u,
      spine: -0.3 * u,
      legRPitch: -0.8 + 2.1 * u,
      kneeR: -1.2 + 1.05 * u,
      ankleR: -0.3 * u,
      kneeL: -0.45,
      armLPitch: -2.2 * u,
      armRPitch: 1.4 * u,
      armLRoll: 1.35,
      armRRoll: -0.85,
      headYaw: 0.4 * u,
      headPitch: -0.16 * u,
    });
  },
  tapInEasy: (c) => {
    const u = hit(clamp01(c.u), 0.35);
    return pose({
      legRPitch: 0.8 * u,
      kneeR: -0.35 * u,
      ankleR: 0.3 * u,
      spine: 0.08,
      headPitch: 0.2,
      armLRoll: 0.6,
      armRRoll: -0.6,
      elbowL: -0.7,
      elbowR: -0.7,
      kneeL: -0.25,
      hipY: -0.02,
    });
  },
  penaltyStrike: (c) => {
    const u = hit(clamp01(c.u), 0.42);
    return pose({
      hipYaw: -0.3 * u,
      chest: 0.3 * u,
      spine: -0.2 * u,
      legRPitch: -0.8 + 2.15 * u,
      kneeR: -1.2 + 1.1 * u,
      ankleR: 0.25 * u,
      kneeL: -0.5,
      armLPitch: -2.0 * u,
      armRPitch: 1.2 * u,
      armLRoll: 1.3,
      armRRoll: -0.75,
      headPitch: 0.24 * u,
    });
  },
  freeKickStrike: (c) => {
    const u = hit(clamp01(c.u), 0.44);
    return pose({
      hipYaw: -0.4 * u,
      chest: 0.36 * u,
      spine: -0.24 * u,
      legRPitch: -0.9 + 2.25 * u,
      legRRoll: -0.3 * u,
      kneeR: -1.25 + 1.15 * u,
      ankleR: 0.2 * u,
      kneeL: -0.45,
      armLPitch: -2.1 * u,
      armRPitch: 1.25 * u,
      armLRoll: 1.3,
      armRRoll: -0.8,
      headPitch: 0.2 * u,
    });
  },
  layoffPass: (c) => {
    const u = hit(clamp01(c.u), 0.4);
    return pose({
      legRPitch: 0.55 * u,
      legRRoll: 0.4 * u,
      kneeR: -0.6,
      ankleR: 0.2 * u,
      hipYaw: 0.2 * u,
      chest: -0.2 * u,
      spine: 0.14,
      headYaw: -0.3 * u,
      armLRoll: 0.9,
      armRRoll: -0.8,
      elbowL: -0.95,
      elbowR: -0.9,
      kneeL: -0.45,
    });
  },

  // ------------------------------------------------------- goleiro (10)
  gkDiveLowLeft: (c) => {
    const u = ease(clamp01(c.u));
    return pose({
      hipY: -0.35 * u,
      hipRoll: 0.9 * u,
      spine: 0.1,
      chest: 0.2 * u,
      legLPitch: 0.9 * u,
      kneeL: -0.5,
      legRPitch: -0.4 * u,
      kneeR: -1.1 * u,
      armLPitch: -2.6 * u,
      armLRoll: 1.1 * u,
      elbowL: -0.15,
      armRPitch: -1.2 * u,
      armRRoll: -0.8,
      headPitch: 0.16,
    });
  },
  gkDiveLowRight: (c) => {
    const u = ease(clamp01(c.u));
    return pose({
      hipY: -0.35 * u,
      hipRoll: -0.9 * u,
      spine: 0.1,
      chest: -0.2 * u,
      legRPitch: 0.9 * u,
      kneeR: -0.5,
      legLPitch: -0.4 * u,
      kneeL: -1.1 * u,
      armRPitch: -2.6 * u,
      armRRoll: -1.1 * u,
      elbowR: -0.15,
      armLPitch: -1.2 * u,
      armLRoll: 0.8,
      headPitch: 0.16,
    });
  },
  gkHighClaim: (c) => {
    const u = hit(clamp01(c.u), 0.48);
    return pose({
      hipY: 0.6 * u,
      spine: -0.3 * u,
      armLPitch: -3.0 * u,
      armRPitch: -3.0 * u,
      elbowL: -0.15,
      elbowR: -0.15,
      armLRoll: 0.3,
      armRRoll: -0.3,
      legLPitch: 0.6 * u,
      kneeL: -1.1 * u,
      legRPitch: -0.25 * u,
      kneeR: -0.35,
      headPitch: -0.55 * u,
    });
  },
  gkSmother: (c) => {
    const u = ease(clamp01(c.u));
    return pose({
      hipY: -0.6 * u,
      hipPitch: 0.9 * u,
      spine: 0.5 * u,
      chest: 0.25 * u,
      headPitch: 0.45 * u,
      kneeL: -1.5 * u,
      kneeR: -1.3 * u,
      legLPitch: 0.8 * u,
      legRPitch: 0.6 * u,
      armLPitch: -1.9 * u,
      armRPitch: -1.9 * u,
      armLRoll: 0.9,
      armRRoll: -0.9,
      elbowL: -0.6,
      elbowR: -0.6,
    });
  },
  gkSideShuffle: (c) =>
    mixPose(
      guard(c, 1),
      pose({
        hipRoll: sin(c.t * 5 + c.seed) * 0.16,
        hipY: -0.16,
        headYaw: sin(c.t * 2) * 0.2,
        armLRoll: 1.2,
        armRRoll: -1.2,
        elbowL: -0.5,
        elbowR: -0.5,
      }),
      0.6,
    ),
  gkThrowLong: (c) => {
    const u = hit(clamp01(c.u), 0.45);
    return pose({
      spine: -0.3 * u,
      chest: -0.16 * u,
      armRPitch: -3.0 * u + 1.2 * clamp01(c.u),
      armRRoll: -0.4,
      elbowR: -0.8 + 0.7 * u,
      armLPitch: -1.2 * u,
      armLRoll: 0.9,
      hipYaw: -0.3 * u,
      legLPitch: 0.6 * u,
      kneeL: -0.9 * u,
      kneeR: -0.4,
      headPitch: -0.2 * u,
    });
  },
  gkGoalKick: (c) => {
    const u = hit(clamp01(c.u), 0.46);
    return pose({
      hipPitch: -0.2 * u,
      spine: -0.32 * u,
      legRPitch: -0.9 + 2.3 * u,
      kneeR: -1.25 + 1.15 * u,
      ankleR: -0.35 * u,
      kneeL: -0.5,
      armLPitch: -2.1 * u,
      armRPitch: 1.2 * u,
      armLRoll: 1.3,
      armRRoll: -0.8,
      headPitch: -0.2 * u,
      hipY: 0.06 * u,
    });
  },
  gkOrganize: (c) =>
    pose({
      spine: 0.04,
      chest: 0.1,
      headYaw: sin(c.t * 1.1 + c.seed) * 0.6,
      armLPitch: -2.4,
      armLRoll: 0.6,
      elbowL: -0.25,
      armRPitch: -1.4,
      armRRoll: -0.9,
      elbowR: -0.9,
      kneeL: -0.2,
      kneeR: -0.2,
      hipY: sin(c.t * 1.3) * 0.012,
    }),
  gkBounceBall: (c) => {
    const p = Math.abs(sin(c.t * 3 + c.seed));
    return pose({
      spine: 0.12,
      hipPitch: 0.14,
      armRPitch: -0.5 - p * 0.6,
      armRRoll: -0.4,
      elbowR: -0.7 - p * 0.5,
      armLPitch: -0.4,
      armLRoll: 0.6,
      elbowL: -1.0,
      headPitch: 0.32,
      kneeL: -0.24,
      kneeR: -0.24,
    });
  },
  gkCelebrateSave: (c) =>
    pose({
      spine: -0.1,
      chest: 0.08,
      headPitch: -0.24,
      armLPitch: -2.2,
      armRPitch: -2.2,
      armLRoll: 1.0,
      armRRoll: -1.0,
      elbowL: -0.9,
      elbowR: -0.9,
      hipY: Math.abs(sin(c.t * 3.4)) * 0.05,
      kneeL: -0.2,
      kneeR: -0.2,
    }),

  // --------------------------------------- banco, árbitro e bastidores (9)
  benchSitting: (c) =>
    pose({
      hipY: -0.62,
      hipPitch: 0.9,
      spine: 0.16,
      chest: 0.06,
      legLPitch: 1.55,
      legRPitch: 1.5,
      kneeL: -1.5,
      kneeR: -1.45,
      armLPitch: -0.3,
      armRPitch: -0.3,
      armLRoll: 0.9,
      armRRoll: -0.9,
      elbowL: -1.4,
      elbowR: -1.4,
      headYaw: sin(c.t * 0.7 + c.seed) * 0.3,
    }),
  benchStandUp: (c) => {
    const u = ease(clamp01(c.u));
    return pose({
      hipY: -0.62 * (1 - u),
      hipPitch: 0.9 * (1 - u),
      legLPitch: 1.55 * (1 - u),
      legRPitch: 1.5 * (1 - u),
      kneeL: -1.5 * (1 - u) - 0.12,
      kneeR: -1.45 * (1 - u) - 0.12,
      spine: 0.16,
      armLRoll: 0.6,
      armRRoll: -0.6,
      elbowL: -1.1,
      elbowR: -1.1,
      headPitch: -0.1 * u,
    });
  },
  warmUpStretch: (c) => {
    const p = sin(c.t * 1.4 + c.seed);
    return pose({
      spine: 0.2 + p * 0.16,
      hipPitch: 0.4,
      legLPitch: 0.2,
      kneeL: -0.2,
      kneeR: -0.2,
      armLPitch: -2.4 - p * 0.3,
      armRPitch: -2.4 - p * 0.3,
      armLRoll: 0.5,
      armRRoll: -0.5,
      elbowL: -0.4,
      elbowR: -0.4,
      headPitch: 0.1,
    });
  },
  warmUpHighKnees: (c) => {
    const p = Math.abs(sin(c.t * 9 + c.seed));
    return pose({
      hipY: p * 0.04,
      legLPitch: p * 1.2,
      kneeL: -1.5 * p,
      legRPitch: -0.3 * p,
      kneeR: -0.3,
      spine: 0.1,
      armLPitch: -0.8 * p,
      armRPitch: 0.6 * p,
      armLRoll: 0.4,
      armRRoll: -0.4,
      elbowL: -1.2,
      elbowR: -1.2,
    });
  },
  coachInstruct: (c) =>
    pose({
      spine: 0.02,
      chest: 0.12,
      headYaw: sin(c.t * 0.9 + c.seed) * 0.5,
      armLPitch: -1.6 + sin(c.t * 3.4) * 0.5,
      armLRoll: 1.0,
      elbowL: -1.0,
      armRPitch: -1.2,
      armRRoll: -1.0,
      elbowR: -1.3,
      kneeL: -0.14,
      kneeR: -0.14,
      hipY: sin(c.t * 1.2) * 0.01,
    }),
  refWhistle: (c) =>
    pose({
      spine: -0.04,
      chest: 0.05,
      headPitch: -0.08,
      armRPitch: -2.2,
      armRRoll: -0.5,
      elbowR: -1.6,
      armLPitch: -1.6,
      armLRoll: 0.8,
      elbowL: -0.6,
      kneeL: -0.1,
      kneeR: -0.1,
      hipY: sin(c.t * 1.5) * 0.01,
    }),
  refCardShow: (c) => {
    const u = ease(clamp01(c.u));
    return pose({
      spine: -0.06,
      chest: 0.04,
      headPitch: -0.12,
      armRPitch: -2.9 * u,
      armRRoll: -0.35,
      elbowR: -0.15,
      armLPitch: -0.5,
      armLRoll: 0.7,
      elbowL: -1.2,
      headYaw: -0.2 * u,
      kneeL: -0.1,
      kneeR: -0.1,
    });
  },
  refRunSide: (c) =>
    stride(c, { rate: 7.8, amp: 0.55, knee: 1.0, armAmp: 0.55, lean: 0.14, bob: 0.035 }),
  substitutionWave: (c) =>
    pose({
      spine: -0.05,
      chest: 0.06,
      headYaw: 0.4,
      headPitch: -0.12,
      armRPitch: -2.6,
      armRRoll: -0.5,
      elbowR: -0.3 + sin(c.t * 6) * 0.3,
      armLPitch: -0.5,
      armLRoll: 0.8,
      elbowL: -1.3,
      hipY: sin(c.t * 1.4) * 0.012,
      kneeL: -0.12,
      kneeR: -0.12,
    }),

  // ----------------------------------------- comemorações e reações (16)
  celebrateKneeSlide: (c) => {
    const u = ease(clamp01(c.u));
    return pose({
      hipY: -0.44,
      hipPitch: -0.3 - u * 0.2,
      spine: -0.3,
      chest: -0.16,
      headPitch: -0.4,
      legLPitch: 1.4,
      legRPitch: 1.3,
      kneeL: -1.7,
      kneeR: -1.6,
      armLPitch: -2.6,
      armRPitch: -2.6,
      armLRoll: 1.1,
      armRRoll: -1.1,
      hipRoll: sin(c.t * 4) * 0.08,
    });
  },
  celebrateArmsWide: (c) =>
    pose({
      spine: -0.1,
      chest: -0.06,
      headPitch: -0.28,
      armLPitch: -0.4,
      armRPitch: -0.4,
      armLRoll: 1.5,
      armRRoll: -1.5,
      elbowL: -0.15,
      elbowR: -0.15,
      hipY: Math.abs(sin(c.t * 2.6)) * 0.04,
      headYaw: sin(c.t * 1.2) * 0.25,
      kneeL: -0.14,
      kneeR: -0.14,
    }),
  celebrateBadgeKiss: (c) =>
    pose({
      spine: -0.04,
      chest: 0.04,
      headPitch: 0.16,
      armRPitch: -1.9,
      armRRoll: -1.0,
      elbowR: -1.9,
      armLPitch: -0.5,
      armLRoll: 0.9,
      elbowL: -1.4,
      hipY: sin(c.t * 2) * 0.02,
      kneeL: -0.12,
      kneeR: -0.12,
    }),
  celebrateRockCradle: (c) =>
    pose({
      spine: -0.06,
      chest: 0.02,
      headPitch: 0.1,
      armLPitch: -1.3,
      armRPitch: -1.3,
      armLRoll: 1.2,
      armRRoll: -1.2,
      elbowL: -1.6,
      elbowR: -1.6,
      hipRoll: sin(c.t * 2.4 + c.seed) * 0.16,
      hipY: sin(c.t * 2.4) * 0.02,
      kneeL: -0.14,
      kneeR: -0.14,
    }),
  celebrateDanceStep: (c) => {
    const p = sin(c.t * 5 + c.seed);
    return pose({
      hipRoll: p * 0.2,
      hipYaw: p * 0.24,
      hipY: Math.abs(p) * 0.05,
      legLPitch: p * 0.4,
      legRPitch: -p * 0.4,
      kneeL: -0.5,
      kneeR: -0.5,
      spine: -0.05,
      chest: -p * 0.16,
      armLPitch: -1.2 - p * 0.5,
      armRPitch: -1.2 + p * 0.5,
      armLRoll: 1.0,
      armRRoll: -1.0,
      elbowL: -1.2,
      elbowR: -1.2,
      headYaw: p * 0.25,
    });
  },
  celebrateSlidingKnees: (c) => {
    const u = ease(clamp01(c.u));
    return pose({
      hipY: -0.5 * u,
      hipPitch: -0.5 * u,
      spine: -0.4 * u,
      headPitch: -0.45 * u,
      legLPitch: 1.2 * u,
      legRPitch: 1.2 * u,
      kneeL: -1.8 * u,
      kneeR: -1.8 * u,
      armLPitch: -2.2 * u,
      armRPitch: -2.2 * u,
      armLRoll: 1.2,
      armRRoll: -1.2,
    });
  },
  celebrateSalute: (c) =>
    pose({
      spine: -0.03,
      chest: 0.06,
      headPitch: -0.1,
      armRPitch: -2.5,
      armRRoll: -0.5,
      elbowR: -1.5,
      armLPitch: -0.4,
      armLRoll: 1.3,
      elbowL: -1.8,
      hipY: sin(c.t * 1.4) * 0.015,
      kneeL: -0.1,
      kneeR: -0.1,
    }),
  celebrateRunAway: (c) =>
    mixPose(
      stride(c, { rate: 9.5, amp: 0.72, knee: 1.25, armAmp: 0.5, lean: 0.1, bob: 0.055 }),
      pose({
        armLPitch: -2.4,
        armRPitch: -2.4,
        armLRoll: 1.1,
        armRRoll: -1.1,
        headPitch: -0.28,
        headYaw: sin(c.t * 2) * 0.3,
      }),
      0.6,
    ),
  celebrateCameraPose: (c) =>
    pose({
      spine: -0.06,
      chest: 0.05,
      headPitch: -0.16,
      headYaw: 0.2,
      armLPitch: -1.0,
      armRPitch: -1.0,
      armLRoll: 1.4,
      armRRoll: -1.4,
      elbowL: -0.8,
      elbowR: -0.8,
      hipRoll: 0.08,
      hipY: sin(c.t * 1.1) * 0.012,
      kneeL: -0.1,
      kneeR: -0.12,
    }),
  disallowedShock: (c) =>
    pose({
      spine: 0.1,
      chest: -0.1,
      headPitch: -0.1,
      headYaw: sin(c.t * 1.4 + c.seed) * 0.5,
      armLPitch: -2.2,
      armRPitch: -2.2,
      armLRoll: 1.25,
      armRRoll: -1.25,
      elbowL: -1.2,
      elbowR: -1.2,
      hipY: -0.02,
      kneeL: -0.16,
      kneeR: -0.16,
    }),
  missSighs: (c) =>
    mixPose(
      breathe(c, 1.4),
      pose({
        spine: 0.24,
        headPitch: 0.34,
        armLPitch: -1.6,
        armRPitch: -1.6,
        armLRoll: 1.0,
        armRRoll: -1.0,
        elbowL: -1.9,
        elbowR: -1.9,
        kneeL: -0.2,
        kneeR: -0.2,
      }),
      0.6,
    ),
  encourageTeammate: (c) =>
    pose({
      spine: 0.04,
      chest: 0.1,
      headYaw: 0.35,
      armRPitch: -1.5,
      armRRoll: -1.0,
      elbowR: -1.0,
      armLPitch: -0.4,
      armLRoll: 0.8,
      elbowL: -1.3,
      hipY: sin(c.t * 1.3) * 0.012,
      kneeL: -0.12,
      kneeR: -0.12,
      headPitch: -0.08,
    }),
  huddleTalk: (c) =>
    pose({
      spine: 0.22,
      chest: 0.14,
      headPitch: 0.2,
      headYaw: sin(c.t * 0.8 + c.seed) * 0.2,
      armLPitch: -1.1,
      armRPitch: -1.1,
      armLRoll: 1.45,
      armRRoll: -1.45,
      elbowL: -0.5,
      elbowR: -0.5,
      hipY: -0.04,
      kneeL: -0.2,
      kneeR: -0.2,
    }),
  drinkWater: (c) =>
    pose({
      spine: -0.08,
      headPitch: -0.3,
      armRPitch: -2.2,
      armRRoll: -0.7,
      elbowR: -2.1,
      armLPitch: -0.4,
      armLRoll: 0.8,
      elbowL: -1.2,
      hipY: sin(c.t * 1.2) * 0.01,
      kneeL: -0.12,
      kneeR: -0.12,
    }),
  adjustSocks: (c) =>
    pose({
      hipPitch: 0.9,
      spine: 0.5,
      headPitch: 0.5,
      kneeL: -0.5,
      kneeR: -0.9,
      legRPitch: 0.3,
      armLPitch: -0.6,
      armRPitch: -0.7,
      armLRoll: 0.9,
      armRRoll: -0.9,
      elbowL: -1.7,
      elbowR: -1.8,
      hipY: -0.24 + sin(c.t * 1.6) * 0.01,
    }),
  exhaustedWalk: (c) =>
    mixPose(
      stride(c, { rate: 2.8, amp: 0.28, knee: 0.45, armAmp: 0.12, lean: 0.3, bob: 0.012 }),
      breathe(c, 1.6),
      0.55,
    ),
} satisfies Record<string, Clip>;

/** número de animações adicionadas por este módulo (89) */
export const EXTRA2_CLIP_COUNT = Object.keys(EXTRA2_CLIPS).length;
