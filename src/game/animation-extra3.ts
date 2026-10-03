// ============================================================================
//  animation-extra3.ts
//  Terceiro pacote de clipes procedurais: domínio e primeiro toque, goleiro
//  (mergulhos baixo/alto), faltas e escorregões, bola parada de pênalti,
//  dribles de efeito (rabona, trivela), disputa física e gestos sociais
//  (reclamação, aperto de mão, aquecimento).
//
//  Inclui também o catálogo de EXPRESSÕES FACIAIS: cada clipe sugere abertura
//  de mandíbula, ritmo de piscada e abertura das pálpebras, que o PlayerRig
//  aplica nos ossos `jaw`, `blink` e `eyes` (LOD 0).
// ============================================================================

import { emptyPose, mixPose, type Clip, type ClipCtx, type Pose } from "./animation-core";

const sin = Math.sin;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const hit = (u: number, peak = 0.45) =>
  u < peak ? u / peak : 1 - clamp01((u - peak) / (1 - peak));
const ease = (u: number) => u * u * (3 - 2 * u);

/** pulso único 0→1→0 centrado em `at`, com largura `w` */
const pulse = (u: number, at: number, w: number) => {
  const d = Math.abs(u - at) / w;
  return d >= 1 ? 0 : 1 - d * d * (3 - 2 * d);
};

function pose(partial: Partial<Pose>): Pose {
  const p = emptyPose();
  Object.assign(p, partial);
  return p;
}

/**
 * Passada genérica com apoio, balanço e inclinação — base dos ciclos de
 * locomoção deste pacote (mancar, corrida de pênalti).
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
    asym?: number;
  },
): Pose {
  const t = c.t * o.rate + c.seed;
  const s = sin(t);
  const s2 = sin(t + Math.PI);
  const asym = o.asym ?? 0;
  // perna direita "encurta" o ciclo quando há assimetria (mancar)
  const sR = asym > 0 ? sin(t * (1 - asym * 0.25) + Math.PI) : s2;
  return pose({
    hipY: Math.abs(sin(t * 2)) * o.bob - asym * 0.03,
    hipPitch: o.lean,
    hipRoll: s * (0.05 + asym * 0.08),
    hipYaw: -s * 0.1,
    spine: o.lean * 0.55 + asym * 0.06,
    chest: sin(t * 2) * 0.05,
    headPitch: -o.lean * 0.5 + asym * 0.08,
    headYaw: -s * 0.05,
    legLPitch: s * o.amp,
    legRPitch: sR * o.amp * (1 - asym * 0.35),
    legLRoll: s * 0.03,
    legRRoll: -sR * 0.03 + asym * 0.05,
    kneeL: -clamp01(-s + 0.3) * o.knee,
    kneeR: -clamp01(-sR + 0.3) * o.knee * (1 - asym * 0.4),
    ankleL: s * 0.28,
    ankleR: sR * 0.28,
    armLPitch: s2 * o.armAmp,
    armRPitch: s * o.armAmp * (1 - asym * 0.3),
    armLRoll: 0.12,
    armRRoll: -0.12 - asym * 0.1,
    elbowL: -0.3 - Math.abs(s2) * 0.2,
    elbowR: -0.3 - Math.abs(s) * 0.2,
  });
}

export const EXTRA3_CLIPS = {
  // -- domínio de peito: tronco reclina para amortecer, joelhos cedem e os
  // -- braços abrem para equilibrar; o peito "afunda" no contato (u≈0.45)
  cushion: (c) => {
    const load = ease(clamp01(c.u * 2.2));
    const absorb = pulse(c.u, 0.5, 0.3);
    return pose({
      hipY: -0.1 * load - 0.06 * absorb,
      hipPitch: -0.18 * load,
      spine: -0.28 * load - 0.12 * absorb,
      chest: -0.3 * load - 0.14 * absorb,
      headPitch: -0.22 * load,
      headYaw: sin(c.t * 2 + c.seed) * 0.06,
      legLPitch: 0.3 * load,
      legRPitch: -0.22 * load,
      kneeL: -0.5 * load - 0.2 * absorb,
      kneeR: -0.55 * load - 0.2 * absorb,
      ankleL: 0.15 * load,
      ankleR: 0.1 * load,
      armLPitch: -0.5 * load,
      armRPitch: -0.5 * load,
      armLRoll: 0.55 * load + 0.2 * absorb,
      armRRoll: -0.55 * load - 0.2 * absorb,
      elbowL: -0.5 * load,
      elbowR: -0.5 * load,
    });
  },

  // -- primeiro toque orientado: passo lateral explosivo com o corpo já girado
  // -- para a direção da saída; o pé de contato varre a bola para frente
  firstTouch: (c) => {
    const step = pulse(c.u, 0.4, 0.42);
    const push = pulse(c.u, 0.62, 0.3);
    return pose({
      hipY: -0.05 * step,
      hipPitch: 0.22 * step,
      hipYaw: 0.3 * step,
      hipRoll: -0.12 * step,
      spine: 0.16 * step,
      chest: 0.22 * step,
      headPitch: 0.18 * step,
      legLPitch: 0.5 * step + 0.35 * push,
      legRPitch: -0.4 * step,
      legLRoll: -0.14 * step,
      kneeL: -0.35 * step,
      kneeR: -0.6 * step,
      ankleL: 0.3 * push,
      armLPitch: -0.5 * step,
      armRPitch: 0.6 * step,
      armLRoll: 0.3 * step,
      armRRoll: -0.3 * step,
      elbowL: -0.4 * step,
      elbowR: -0.6 * step,
    });
  },

  // -- escorregão: o pé de apoio escapa para frente, os braços rodopiam para
  // -- recuperar o equilíbrio e o tronco inclina para trás e para o lado
  slip: (c) => {
    const slide = pulse(c.u, 0.35, 0.4);
    const flail = pulse(c.u, 0.55, 0.45);
    const recover = ease(clamp01((c.u - 0.6) / 0.4));
    const w = sin(c.t * 14) * flail;
    return pose({
      hipY: -0.34 * slide * (1 - recover * 0.7),
      hipPitch: -0.3 * slide,
      hipRoll: 0.25 * slide,
      hipYaw: 0.2 * slide,
      spine: -0.25 * slide + 0.1 * recover,
      chest: -0.2 * slide,
      headPitch: -0.1 * slide,
      headYaw: 0.15 * slide,
      legLPitch: 1.1 * slide * (1 - recover),
      legRPitch: -0.5 * slide * (1 - recover),
      kneeL: -0.15 * slide,
      kneeR: -1.1 * slide * (1 - recover * 0.5),
      ankleL: 0.4 * slide,
      armLPitch: -1.3 * flail + w * 0.5,
      armRPitch: 1.1 * flail - w * 0.5,
      armLRoll: 1.2 * flail,
      armRRoll: -1.2 * flail,
      elbowL: -0.4 * flail,
      elbowR: -0.4 * flail,
    });
  },

  // -- levantar do carrinho: empurra o chão com a mão, recolhe as pernas e
  // -- volta à base em dois tempos (u<0.5 no chão, depois em pé)
  slideRecover: (c) => {
    const up = ease(clamp01((c.u - 0.35) / 0.65));
    const push = pulse(c.u, 0.45, 0.3);
    const down = 1 - up;
    return pose({
      hipY: -0.55 * down,
      hipPitch: -0.4 * down + 0.12 * push,
      hipRoll: 0.5 * down,
      spine: 0.35 * down,
      chest: 0.2 * down,
      headPitch: 0.12 * down,
      legLPitch: 1.2 * down,
      legRPitch: -0.15 * down,
      kneeL: -0.25 * down - 0.4 * up * down * 4 * 0.25,
      kneeR: -1.4 * down,
      ankleL: 0.3 * down,
      armLPitch: -1.1 * down - 0.4 * push,
      armRPitch: 0.7 * down,
      armLRoll: 0.9 * down,
      armRRoll: -0.4 * down,
      elbowL: -0.2 * down - 0.5 * push,
      elbowR: -0.7 * down,
    });
  },

  // -- corrida de pênalti: passadas curtas e cadenciadas, tronco ereto, olhar
  // -- alternando entre a bola e o goleiro (a cabeça desce e sobe)
  penaltyRunup: (c) => {
    const base = stride(c, {
      rate: 7.5,
      amp: 0.42,
      knee: 0.7,
      armAmp: 0.3,
      lean: 0.1,
      bob: 0.02,
    });
    const glance = 0.5 + 0.5 * sin(c.t * 2.2 + c.seed);
    return mixPose(
      base,
      pose({
        spine: 0.02,
        chest: -0.04,
        headPitch: -0.08 + glance * 0.3,
        headYaw: sin(c.t * 1.1 + c.seed) * 0.12,
        armLRoll: 0.2,
        armRRoll: -0.2,
        elbowL: -0.5,
        elbowR: -0.5,
      }),
      0.65,
    );
  },

  // -- mergulho baixo: projeta o corpo para o lado rente ao gramado, braços
  // -- estendidos à frente e pernas esticadas; queda amortecida no fim
  gkDiveLow: (c) => {
    const fly = ease(clamp01(c.u * 2.4));
    const land = pulse(c.u, 0.85, 0.3);
    return pose({
      hipY: -0.5 * fly,
      hipPitch: 0.25 * fly,
      hipRoll: 1.05 * fly,
      hipYaw: -0.3 * fly,
      spine: 0.3 * fly,
      chest: 0.35 * fly + 0.1 * land,
      headPitch: 0.05 * fly,
      headYaw: -0.2 * fly,
      legLPitch: 0.15 * fly,
      legRPitch: -0.1 * fly,
      legLRoll: 0.3 * fly,
      legRRoll: 0.35 * fly,
      kneeL: -0.25 * fly - 0.3 * land,
      kneeR: -0.2 * fly - 0.35 * land,
      armLPitch: 1.5 * fly,
      armRPitch: 1.5 * fly,
      armLRoll: 0.25 * fly,
      armRRoll: -0.25 * fly,
      elbowL: -0.08 * fly,
      elbowR: -0.08 * fly,
    });
  },

  // -- mergulho alto: impulsão com salto lateral, um braço esticado ao máximo
  // -- para o ângulo e queda de lado com o corpo estendido
  gkDiveHigh: (c) => {
    const spring = pulse(c.u, 0.25, 0.3);
    const fly = ease(clamp01((c.u - 0.2) / 0.5));
    const land = ease(clamp01((c.u - 0.7) / 0.3));
    return pose({
      hipY: 0.22 * spring - 0.55 * land,
      hipPitch: -0.1 * spring + 0.2 * fly,
      hipRoll: 0.25 * spring + 1.15 * fly,
      hipYaw: -0.35 * fly,
      spine: -0.15 * spring + 0.25 * fly,
      chest: 0.3 * fly,
      headPitch: -0.15 * spring,
      headYaw: -0.25 * fly,
      legLPitch: 0.3 * spring + 0.2 * fly,
      legRPitch: -0.5 * spring - 0.3 * land,
      kneeL: -0.6 * spring - 0.2 * fly,
      kneeR: -0.9 * spring - 0.4 * land,
      armLPitch: 0.6 * spring + 2.0 * fly,
      armRPitch: 0.4 * spring + 1.2 * fly,
      armLRoll: 0.5 * fly,
      armRRoll: -0.3 * fly,
      elbowL: -0.3 * spring - 0.02 * fly,
      elbowR: -0.5 * spring,
    });
  },

  // -- cabeceio com salto: impulsão com os braços subindo, tronco arqueado
  // -- para trás e projeção violenta do pescoço no contato (u≈0.55)
  headerJump: (c) => {
    const crouch = pulse(c.u, 0.2, 0.25);
    const rise = ease(clamp01((c.u - 0.25) / 0.3));
    const nod = pulse(c.u, 0.58, 0.22);
    const fall = ease(clamp01((c.u - 0.62) / 0.38));
    return pose({
      hipY: -0.16 * crouch + 0.34 * rise * (1 - fall),
      hipPitch: 0.2 * crouch - 0.12 * rise,
      spine: 0.15 * crouch - 0.3 * rise + 0.35 * nod,
      chest: -0.28 * rise + 0.4 * nod,
      headPitch: -0.3 * rise + 0.55 * nod,
      legLPitch: 0.25 * crouch - 0.15 * rise,
      legRPitch: -0.2 * crouch + 0.1 * rise,
      kneeL: -0.7 * crouch - 0.35 * rise * (1 - fall) - 0.5 * fall,
      kneeR: -0.7 * crouch - 0.3 * rise * (1 - fall) - 0.5 * fall,
      ankleL: 0.2 * crouch + 0.3 * rise,
      ankleR: 0.2 * crouch + 0.3 * rise,
      armLPitch: -0.6 * crouch + 1.6 * rise - 0.8 * nod - 0.6 * fall,
      armRPitch: -0.6 * crouch + 1.6 * rise - 0.8 * nod - 0.6 * fall,
      armLRoll: 0.4 * rise,
      armRRoll: -0.4 * rise,
      elbowL: -0.4 * rise,
      elbowR: -0.4 * rise,
    });
  },

  // -- rabona: perna de apoio plantada, perna de chute cruzando POR TRÁS com
  // -- o tronco girando contra; equilíbrio nos braços abertos
  rabona: (c) => {
    const wind = pulse(c.u, 0.3, 0.35);
    const strike = pulse(c.u, 0.58, 0.25);
    return pose({
      hipY: -0.08 * wind - 0.04 * strike,
      hipPitch: 0.25 * wind + 0.1 * strike,
      hipYaw: -0.45 * wind + 0.25 * strike,
      hipRoll: 0.12 * wind,
      spine: 0.2 * wind,
      chest: 0.35 * strike,
      headPitch: 0.22 * wind,
      headYaw: 0.2 * wind,
      legLPitch: 0.15 * wind,
      legLRoll: -0.1 * wind,
      legRPitch: -0.5 * wind + 1.0 * strike,
      legRRoll: -0.55 * wind - 0.3 * strike,
      kneeL: -0.4 * wind - 0.2 * strike,
      kneeR: -1.0 * wind - 0.1 * strike,
      ankleR: 0.5 * strike,
      armLPitch: 0.7 * wind,
      armRPitch: -0.8 * wind,
      armLRoll: 0.7 * wind,
      armRRoll: -0.7 * wind,
      elbowL: -0.5 * wind,
      elbowR: -0.5 * wind,
    });
  },

  // -- trivela: corpo inclinado sobre a bola, perna varrendo de fora para
  // -- dentro com o pé travado de "três dedos"
  trivela: (c) => {
    const wind = pulse(c.u, 0.3, 0.35);
    const strike = pulse(c.u, 0.6, 0.25);
    return pose({
      hipY: -0.06 * wind,
      hipPitch: 0.3 * wind,
      hipYaw: 0.35 * wind - 0.3 * strike,
      hipRoll: -0.18 * strike,
      spine: 0.22 * wind,
      chest: 0.25 * strike,
      headPitch: 0.25 * wind,
      legLPitch: 0.1 * wind,
      legRPitch: -0.7 * wind + 1.15 * strike,
      legRRoll: 0.4 * wind - 0.35 * strike,
      kneeL: -0.35 * wind,
      kneeR: -1.1 * wind - 0.05 * strike,
      ankleR: -0.35 * strike,
      ankleL: 0.1 * wind,
      armLPitch: -0.9 * wind + 0.4 * strike,
      armRPitch: 0.8 * wind,
      armLRoll: 0.5 * wind,
      armRRoll: -0.5 * wind,
      elbowL: -0.4 * wind,
      elbowR: -0.6 * strike,
    });
  },

  // -- ombrada: carrega o ombro para trás e projeta de lado no adversário,
  // -- com passo firme de apoio e o outro braço travando atrás
  shoulderBarge: (c) => {
    const load = pulse(c.u, 0.3, 0.35);
    const shove = pulse(c.u, 0.58, 0.28);
    return pose({
      hipY: -0.12 * load - 0.06 * shove,
      hipPitch: 0.2 * load + 0.12 * shove,
      hipYaw: -0.35 * load + 0.3 * shove,
      hipRoll: 0.2 * shove,
      spine: 0.15 * load + 0.1 * shove,
      chest: -0.3 * load + 0.45 * shove,
      headPitch: 0.08 * load,
      headYaw: 0.25 * load - 0.2 * shove,
      legLPitch: 0.45 * load + 0.2 * shove,
      legRPitch: -0.3 * load - 0.1 * shove,
      kneeL: -0.5 * load,
      kneeR: -0.45 * load,
      armLPitch: 0.3 * load - 0.4 * shove,
      armRPitch: -0.6 * load - 0.3 * shove,
      armLRoll: 0.9 * load - 0.5 * shove,
      armRRoll: -0.2 * load - 0.4 * shove,
      elbowL: -1.1 * load - 0.6 * shove,
      elbowR: -0.5 * load,
    });
  },

  // -- reclamação: dois passos à frente com as palmas abertas para o árbitro,
  // -- balançando a cabeça em negação; ciclo curto que repete no `u`
  dissent: (c) => {
    const wave = sin(c.u * Math.PI * 4);
    const step = pulse(c.u, 0.3, 0.5);
    return pose({
      hipY: -0.03 * step,
      hipPitch: 0.14 * step,
      spine: 0.1 * step,
      chest: 0.06 * step,
      headPitch: 0.05,
      headYaw: wave * 0.28,
      legLPitch: 0.4 * step,
      legRPitch: 0.25 * pulse(c.u, 0.55, 0.5),
      kneeL: -0.3 * step,
      kneeR: -0.25 * step,
      armLPitch: 0.9 + wave * 0.15,
      armRPitch: 0.9 - wave * 0.15,
      armLRoll: 0.5,
      armRRoll: -0.5,
      elbowL: -0.35,
      elbowR: -0.35,
    });
  },

  // -- mancando: passada assimétrica de quem sentiu a posterior — a perna
  // -- direita mal dobra, o tronco pende para a esquerda e o braço compensa
  limp: (c) =>
    stride(c, {
      rate: 5.2,
      amp: 0.38,
      knee: 0.8,
      armAmp: 0.32,
      lean: 0.14,
      bob: 0.025,
      asym: 0.85,
    }),

  // -- aperto de mão: passo à frente estendendo a direita, duas sacudidas
  // -- secas e um aceno curto de cabeça no fim
  handshake: (c) => {
    const reach = ease(clamp01(c.u * 2.5));
    const shake = sin(clamp01((c.u - 0.4) / 0.4) * Math.PI * 2 * 2) * pulse(c.u, 0.6, 0.4);
    const nod = pulse(c.u, 0.85, 0.25);
    return pose({
      hipPitch: 0.1 * reach,
      spine: 0.12 * reach + 0.08 * nod,
      chest: 0.06 * reach,
      headPitch: 0.1 * reach + 0.16 * nod,
      legLPitch: 0.35 * reach,
      legRPitch: -0.15 * reach,
      kneeL: -0.2 * reach,
      kneeR: -0.25 * reach,
      armRPitch: 0.9 * reach + shake * 0.12,
      armRRoll: -0.15 * reach,
      elbowR: -0.5 * reach,
      armLPitch: -0.2 * reach,
      armLRoll: 0.25 * reach,
      elbowL: -0.3 * reach,
    });
  },

  // -- aquecimento: polichinelo lento alternando com rotação de tronco e
  // -- toque nos pés — ciclo de 4 tempos que fecha no fim do `u`
  warmup: (c) => {
    const ph = c.u * Math.PI * 2;
    const jack = 0.5 + 0.5 * sin(ph * 2);
    const bend = pulse(c.u, 0.75, 0.3);
    return pose({
      hipY: 0.08 * jack - 0.12 * bend,
      hipPitch: 0.5 * bend,
      spine: 0.1 * jack + 0.45 * bend,
      chest: 0.35 * bend,
      headPitch: -0.1 * jack + 0.3 * bend,
      headYaw: sin(ph) * 0.2 * (1 - bend),
      legLPitch: 0.1 * jack,
      legRPitch: -0.1 * jack,
      legLRoll: 0.35 * jack,
      legRRoll: -0.35 * jack,
      kneeL: -0.15 * jack - 0.2 * bend,
      kneeR: -0.15 * jack - 0.2 * bend,
      armLPitch: 2.4 * jack * (1 - bend * 0.7) + 0.9 * bend,
      armRPitch: 2.4 * jack * (1 - bend * 0.7) + 0.9 * bend,
      armLRoll: 0.3 * jack,
      armRRoll: -0.3 * jack,
      elbowL: -0.2,
      elbowR: -0.2,
    });
  },
} satisfies Record<string, Clip>;

export const EXTRA3_CLIP_COUNT = Object.keys(EXTRA3_CLIPS).length;

/* -------------------------------------------------------------------------- */
/*  Expressões faciais                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Expressão sugerida pelo clipe atual. O PlayerRig mistura esses alvos com o
 * esforço (velocidade/cansaço) e escreve nos ossos `jaw` (abertura da boca),
 * `blink` (pálpebras) e `eyes` (perseguição do olhar).
 */
export interface FaceExpression {
  /** 0 = boca fechada, 1 = grito/aberta ao máximo */
  jaw: number;
  /** multiplicador do intervalo entre piscadas (1 = normal, 0.4 = encara) */
  blinkRate: number;
  /** 0.7 = olhos semicerrados … 1.15 = arregalados */
  lids: number;
  /** quanto o olhar persegue a bola (0 = vagueia, 1 = fixo) */
  gaze: number;
}

const NEUTRAL_FACE: FaceExpression = { jaw: 0.12, blinkRate: 1, lids: 1, gaze: 0.75 };

const FACE_FOR_CLIP: Record<string, Partial<FaceExpression>> = {
  // grito do gol: boca aberta, olhos arregalados, olhar fixo na torcida
  celebrateArms: { jaw: 0.95, blinkRate: 1.4, lids: 1.15, gaze: 0.2 },
  celebrateRun: { jaw: 0.8, blinkRate: 1.2, lids: 1.1, gaze: 0.4 },
  kneeSlide: { jaw: 0.9, blinkRate: 1.3, lids: 1.12, gaze: 0.3 },
  groupHug: { jaw: 0.55, blinkRate: 1.1, lids: 1.05, gaze: 0.5 },
  // reclamação: fala rápido, pisca muito, encara o árbitro
  dissent: { jaw: 0.5, blinkRate: 0.5, lids: 1.05, gaze: 0.9 },
  protest: { jaw: 0.55, blinkRate: 0.5, lids: 1.05, gaze: 0.9 },
  protestHandsOut: { jaw: 0.45, blinkRate: 0.6, lids: 1.03, gaze: 0.85 },
  // decisão: encara sem piscar, boca cerrada
  penalty: { jaw: 0.08, blinkRate: 2.2, lids: 1.0, gaze: 1 },
  penaltyRunup: { jaw: 0.1, blinkRate: 2.0, lids: 1.0, gaze: 1 },
  freeKick: { jaw: 0.1, blinkRate: 1.8, lids: 1.0, gaze: 1 },
  // esforço máximo: boca aberta ofegante, olhar na bola
  slip: { jaw: 0.65, blinkRate: 0.7, lids: 1.12, gaze: 0.9 },
  slideRecover: { jaw: 0.5, blinkRate: 0.9, lids: 1.0, gaze: 0.8 },
  headerJump: { jaw: 0.4, blinkRate: 0.8, lids: 1.05, gaze: 1 },
  gkDiveLow: { jaw: 0.35, blinkRate: 0.7, lids: 1.1, gaze: 1 },
  gkDiveHigh: { jaw: 0.4, blinkRate: 0.7, lids: 1.1, gaze: 1 },
  bicycle: { jaw: 0.45, blinkRate: 0.7, lids: 1.08, gaze: 1 },
  volley: { jaw: 0.35, blinkRate: 0.8, lids: 1.05, gaze: 1 },
  // cansaço: boca entreaberta, pálpebras pesadas, olhar vago
  tired: { jaw: 0.45, blinkRate: 1.5, lids: 0.8, gaze: 0.4 },
  exhaustedWalk: { jaw: 0.5, blinkRate: 1.6, lids: 0.75, gaze: 0.35 },
  limp: { jaw: 0.4, blinkRate: 1.1, lids: 0.85, gaze: 0.6 },
  catchBreathKnees: { jaw: 0.6, blinkRate: 1.4, lids: 0.8, gaze: 0.3 },
  // social: relaxado, olha ao redor
  handshake: { jaw: 0.2, blinkRate: 1.0, lids: 1.0, gaze: 0.5 },
  warmup: { jaw: 0.2, blinkRate: 1.0, lids: 1.0, gaze: 0.4 },
  applaudFans: { jaw: 0.3, blinkRate: 1.0, lids: 1.02, gaze: 0.2 },
  encourageTeammate: { jaw: 0.35, blinkRate: 0.9, lids: 1.0, gaze: 0.6 },
};

/**
 * Resolve a expressão do quadro: o clipe sugere, o esforço (sprint/cansaço)
 * abre a mandíbula e pesa as pálpebras por cima.
 */
export function expressionFor(clip: string, effort: number, fatigue: number): FaceExpression {
  const hint = FACE_FOR_CLIP[clip];
  const e = clamp01(effort);
  const f = clamp01(fatigue);
  return {
    jaw: clamp01((hint?.jaw ?? NEUTRAL_FACE.jaw) + e * 0.35 + f * 0.25),
    blinkRate: (hint?.blinkRate ?? 1) * (1 + f * 0.6),
    lids: (hint?.lids ?? 1) - f * 0.15,
    gaze: hint?.gaze ?? NEUTRAL_FACE.gaze,
  };
}
