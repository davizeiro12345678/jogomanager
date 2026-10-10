// ============================================================================
//  player-model.ts
//  Sistema próprio de definição anatômica e visual dos jogadores.
//
//  Este módulo NÃO conhece React nem Three.js: ele apenas descreve, de forma
//  totalmente determinística (a partir do id do jogador), como cada atleta é:
//  altura, porte físico, proporções de cada osso, tom de pele, cabelo, barba,
//  acessórios, uniforme e chuteira. O componente 3D (PlayerRig) consome esta
//  descrição e monta a hierarquia de juntas.
//
//  Determinismo: o mesmo id sempre gera o mesmo atleta, em qualquer máquina e
//  em qualquer sessão — importante porque a partida também é determinística.
// ============================================================================

import { HAIR_COLORS, SKIN_TONES } from "./kits";
import { getVisual } from "./visual-settings";

/* -------------------------------------------------------------------------- */
/*  RNG determinístico                                                        */
/* -------------------------------------------------------------------------- */

export function hashId(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** gerador linear simples, suficiente para variação visual */
export function makeLookRng(seed: number): () => number {
  let s = (seed || 1) >>> 0;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

/* -------------------------------------------------------------------------- */
/*  Tipos                                                                     */
/* -------------------------------------------------------------------------- */

export type HairStyle =
  | "buzz"
  | "short"
  | "medium"
  | "curly"
  | "afro"
  | "mohawk"
  | "bun"
  | "ponytail"
  | "dreads"
  | "braids"
  | "headband"
  | "bald";

export type BeardStyle = "none" | "stubble" | "goatee" | "full" | "moustache";

export type SleeveStyle = "short" | "long";

export type BodyType = "slim" | "normal" | "strong" | "tall";

export type CollarStyle = "crew" | "v" | "polo";

export interface PlayerLook {
  /** semente derivada do id */
  seed: number;
  /** altura relativa (1 = 1,80 m aprox.) */
  height: number;
  /** largura relativa do tronco/membros */
  girth: number;
  bodyType: BodyType;
  skin: string;
  hairColor: string;
  hairStyle: HairStyle;
  beard: BeardStyle;
  sleeves: SleeveStyle;
  /** goleiro usa luvas */
  gloves: boolean;
  gloveColor: string;
  /** faixa de cabelo visível */
  headband: boolean;
  headbandColor: string;
  /** braçadeira de capitão */
  captain: boolean;
  /** camisa térmica por baixo */
  undershirt: boolean;
  undershirtColor: string;
  bootColor: string;
  bootAccent: string;
  sockTape: boolean;
  /** altura do meião */
  sockHeight: "low" | "mid" | "high";
  /** fita branca no pulso (um lado só: cabe no teto de malhas do herói) */
  wristTape: "none" | "left" | "right";
  /** tatuagem no antebraço (um lado só: cabe no teto de malhas do herói) */
  tattoo: "none" | "foreL" | "foreR";
  /** brinco na orelha esquerda */
  earring: boolean;
  /** cor da íris */
  eyeColor: string;
  /** formato da gola da camisa */
  collar: CollarStyle;
  /** volume do cabelo (0.85 .. 1.2) */
  hairVolume: number;
  /** leve variação de tom entre jogadores do mesmo time (iluminação/suor) */
  sweat: number;
  /** grupo de posição: muda o porte físico do atleta */
  role: RoleGroup;
}

/** Grupos de posição que compartilham o mesmo tipo de porte físico. */
export type RoleGroup = "GK" | "DF" | "MF" | "FW";

export function roleGroupOf(pos: string): RoleGroup {
  const p = pos.toUpperCase();
  if (p === "GK") return "GK";
  if (p.startsWith("D") || p === "CB" || p === "LB" || p === "RB" || p === "WB") return "DF";
  if (p.startsWith("F") || p === "ST" || p === "CF" || p === "LW" || p === "RW") return "FW";
  return "MF";
}

/**
 * Porte físico típico por posição. Goleiro e zagueiro são mais altos e mais
 * largos de ombro; meia e ponta são mais leves e com passada mais longa.
 */
const ROLE_BUILD: Record<
  RoleGroup,
  { height: number; girth: number; shoulder: number; leg: number; arm: number }
> = {
  GK: { height: 1.045, girth: 1.03, shoulder: 1.05, leg: 1.01, arm: 1.05 },
  DF: { height: 1.025, girth: 1.05, shoulder: 1.06, leg: 1.0, arm: 1.02 },
  MF: { height: 0.99, girth: 0.97, shoulder: 0.98, leg: 1.0, arm: 0.99 },
  FW: { height: 1.0, girth: 0.99, shoulder: 1.0, leg: 1.02, arm: 1.0 },
};

export interface Proportions {
  /** altura do quadril acima do gramado */
  hipY: number;
  hipW: number;
  hipH: number;
  /** comprimento da lombar */
  spineLen: number;
  /** comprimento do peito */
  chestLen: number;
  chestW: number;
  chestD: number;
  shoulderW: number;
  neckLen: number;
  neckR: number;
  headR: number;
  headH: number;
  /** largura do crânio (têmporas) */
  headW: number;
  /** profundidade do crânio (nuca ao rosto) */
  headD: number;
  /** comprimento do maxilar */
  jawLen: number;
  /** projeção do queixo à frente do crânio */
  chinFwd: number;
  upperArm: number;
  foreArm: number;
  armR: number;
  /** envergadura relativa (1 = média): goleiro tem braço mais longo */
  armSpan: number;
  /** postura base do tronco em radianos (+ = curvado, − = ereto) */
  posture: number;
  handR: number;
  thigh: number;
  shin: number;
  legR: number;
  footLen: number;
  footH: number;
}

/* -------------------------------------------------------------------------- */
/*  Aparência                                                                 */
/* -------------------------------------------------------------------------- */

const HAIR_POOL: HairStyle[] = [
  "buzz",
  "short",
  "short",
  "medium",
  "curly",
  "afro",
  "mohawk",
  "bun",
  "ponytail",
  "dreads",
  "braids",
  "headband",
  "bald",
];

const BEARD_POOL: BeardStyle[] = [
  "none",
  "none",
  "none",
  "stubble",
  "stubble",
  "goatee",
  "full",
  "moustache",
];

const BOOT_COLORS = [
  "#101014",
  "#f2f2f2",
  "#ff2e63",
  "#00e5a0",
  "#ffcc00",
  "#3b6bff",
  "#ff6b00",
  "#8b1cff",
];

const BOOT_ACCENTS = ["#ffffff", "#101014", "#ffd34d", "#00d0ff", "#ff4d6d"];

const GLOVE_COLORS = ["#f5f5f5", "#12e0a0", "#ff8a3d", "#2f6bff", "#151515"];

/** tons de íris comuns entre atletas */
const EYE_COLORS = ["#3a2a1c", "#2b1b12", "#4a3722", "#5a7a4a", "#3f6f8f", "#6b6b6b"];

const COLLAR_POOL: CollarStyle[] = ["crew", "crew", "v", "polo"];

/** monta a aparência completa e determinística de um jogador */
export function lookFor(id: string, pos: string, isCaptain = false): PlayerLook {
  const seed = hashId(id);
  const rng = makeLookRng(seed);

  const role = roleGroupOf(pos);
  const build = ROLE_BUILD[role];

  const heightRoll = rng();
  // A variação individual continua, mas agora orbita o porte típico da posição.
  const height = (0.92 + heightRoll * 0.16) * build.height; // ~0.92 .. 1.13
  const girth = (0.92 + rng() * 0.16) * build.girth;

  const bodyType: BodyType =
    height > 1.055 ? "tall" : girth > 1.045 ? "strong" : girth < 0.945 ? "slim" : "normal";

  const skin = SKIN_TONES[Math.floor(rng() * SKIN_TONES.length)] ?? SKIN_TONES[0]!;
  const hairColor = HAIR_COLORS[Math.floor(rng() * HAIR_COLORS.length)] ?? HAIR_COLORS[0]!;
  let hairStyle = HAIR_POOL[Math.floor(rng() * HAIR_POOL.length)] ?? "short";
  const beard = BEARD_POOL[Math.floor(rng() * BEARD_POOL.length)] ?? "none";
  const headband = hairStyle === "headband";
  if (headband) hairStyle = "medium";

  const gloves = role === "GK";

  return {
    seed,
    height,
    girth,
    bodyType,
    skin,
    hairColor,
    hairStyle,
    beard,
    sleeves: rng() < 0.25 ? "long" : "short",
    gloves,
    gloveColor: GLOVE_COLORS[Math.floor(rng() * GLOVE_COLORS.length)] ?? "#f5f5f5",
    headband,
    headbandColor: rng() < 0.5 ? "#101014" : "#f0f0f0",
    captain: isCaptain,
    undershirt: rng() < 0.35,
    undershirtColor: rng() < 0.5 ? "#141414" : "#f2f2f2",
    bootColor: BOOT_COLORS[Math.floor(rng() * BOOT_COLORS.length)] ?? "#101014",
    bootAccent: BOOT_ACCENTS[Math.floor(rng() * BOOT_ACCENTS.length)] ?? "#ffffff",
    sockTape: rng() < 0.4,
    eyeColor: EYE_COLORS[Math.floor(rng() * EYE_COLORS.length)] ?? "#3a2a1c",
    collar: COLLAR_POOL[Math.floor(rng() * COLLAR_POOL.length)] ?? "crew",
    hairVolume: 0.85 + rng() * 0.35,
    sweat: rng(),
    role,
    // novos sorteios sempre no fim: a aparência existente não muda
    sockHeight: rng() < 0.2 ? "low" : rng() < 0.75 ? "mid" : "high",
    wristTape: (() => {
      const r = rng();
      return r < 0.62 ? "none" : r < 0.81 ? "left" : "right";
    })(),
    tattoo: (() => {
      const r = rng();
      return r < 0.68 ? "none" : r < 0.84 ? "foreL" : "foreR";
    })(),
    earring: rng() < 0.12,
  };
}

/* -------------------------------------------------------------------------- */
/*  Proporções ósseas                                                         */
/* -------------------------------------------------------------------------- */

/** Body measurements affect physique while preserving the athlete's face,
 * hair, complexion and accessories. Saves without measurements retain the
 * deterministic appearance. Values use the same cm/kg units as the profile. */
export function lookWithPhysique(
  look: PlayerLook,
  measurements: { height?: number | undefined; weight?: number | undefined },
): PlayerLook {
  const height =
    Number.isFinite(measurements.height) && measurements.height! > 0
      ? Math.max(155, Math.min(210, measurements.height!)) / 180
      : look.height;
  const hasWeight = Number.isFinite(measurements.weight) && measurements.weight! > 0;
  if (!hasWeight) return height === look.height ? look : { ...look, height };
  const weight = Math.max(48, Math.min(120, measurements.weight!));
  const bodyMassIndex = weight / (height * 1.8) ** 2;
  // Footballers carry mass through the chest, glutes and thighs rather than
  // expanding every joint uniformly. Keep the global frame athletic; local
  // surfaces add the positional muscle volume below.
  const girth = Math.max(0.89, Math.min(1.1, Math.sqrt(bodyMassIndex / 24.8)));
  return {
    ...look,
    height,
    girth,
    bodyType: girth > 1.06 ? "strong" : girth < 0.94 ? "slim" : "normal",
  };
}

/**
 * Proporções em unidades de mundo (1 unidade = 1 metro).
 * Base: atleta de 1,80 m, cerca de 7,5 cabeças de altura, pernas ~48% do total.
 */
export function proportionsFor(look: PlayerLook): Proportions {
  const h = look.height;
  const g = look.girth;
  const strong = look.bodyType === "strong" ? 1.06 : look.bodyType === "slim" ? 0.95 : 1;
  const build = ROLE_BUILD[look.role ?? "MF"];

  // Variação fina de crânio/maxilar por atleta: dois jogadores com a mesma
  // altura deixam de ter exatamente o mesmo rosto.
  const faceRng = makeLookRng(look.seed ^ 0x9e3779b9);
  const faceWide = 0.94 + faceRng() * 0.14;
  const faceLong = 0.94 + faceRng() * 0.14;
  // Postura e envergadura individuais: uns jogam eretos, outros curvados; o
  // braço orbita o porte da posição (goleiro com mais envergadura).
  const posture = (faceRng() - 0.5) * 0.12;
  const armSpan = build.arm * (0.97 + faceRng() * 0.06);

  // Perna um pouco mais longa em atacantes, tronco mais curto: silhueta de
  // velocista. O quadril continua apoiado no gramado (hipY soma a perna toda).
  const legScale = build.leg;
  const rawThigh = 0.44 * h * legScale;
  const rawShin = 0.42 * h * legScale;
  const rawFootH = 0.07 * h;
  const rawHipH = 0.13 * h;
  const rawSpineLen = 0.19 * h * (2 - legScale);
  const rawChestLen = 0.22 * h * (2 - legScale);
  const rawNeckLen = 0.07 * h;
  // Adult athletes average about 7.5 heads from sole to crown. Keep cranial
  // growth slower than stature, so tall keepers do not get oversized heads.
  const rawHeadR = 0.1 * (0.98 + (h - 1) * 0.4);

  // Measure sole to skull, independently of the haircut. The leg pivots sit
  // below the pelvis; include that offset before normalizing the skeleton.
  const rawHipY = rawThigh + rawShin + rawFootH * 0.84 + rawHipH * 0.4;
  const rawRigHeight =
    rawHipY + rawHipH * 0.5 + rawSpineLen + rawChestLen + rawNeckLen + rawHeadR * (0.66 + 1.14);
  const metricScale = (1.8 * h) / rawRigHeight;
  const thigh = rawThigh * metricScale;
  const shin = rawShin * metricScale;
  const footH = rawFootH * metricScale;
  const headR = rawHeadR * metricScale;
  // Breadth varies independently from stature, but short, strong athletes
  // still need a human shoulder span. Bound the whole frame together so
  // deltoids, torso and pelvis keep their relative widths.
  const shoulderEnvelope = 0.35 * build.shoulder * 1.04 + 0.058 * 2.36;
  const frameScale = Math.min(
    Math.max(g * strong * metricScale, (1.8 * h * 0.245) / shoulderEnvelope),
    (1.8 * h * 0.315) / shoulderEnvelope,
  );

  return {
    hipY: thigh + shin + footH * 0.84 + rawHipH * metricScale * 0.4,
    hipW: 0.232 * frameScale,
    hipH: rawHipH * metricScale,
    spineLen: rawSpineLen * metricScale,
    chestLen: rawChestLen * metricScale,
    chestW: 0.196 * frameScale,
    chestD: 0.116 * frameScale * (look.bodyType === "strong" ? 1.04 : 1),
    shoulderW: 0.35 * build.shoulder * frameScale,
    neckLen: rawNeckLen * metricScale,
    neckR: 0.056 * g * (look.role === "DF" || look.role === "GK" ? 1.06 : 1) * metricScale,
    headR,
    headH: headR * 2.28,
    headW: headR * faceWide * 0.87,
    headD: headR * (1.065 + (1 - faceWide) * 0.4),
    jawLen: headR * 0.52 * faceLong,
    chinFwd: headR * (0.12 + (faceLong - 0.94) * 0.5),
    upperArm: 0.3 * h * metricScale * armSpan,
    foreArm: 0.255 * h * metricScale * armSpan,
    armR: 0.058 * frameScale,
    armSpan,
    posture,
    handR: 0.057 * Math.sqrt(g) * metricScale,
    thigh,
    shin,
    legR: 0.071 * frameScale,
    footLen: 0.255 * h * metricScale,
    footH,
  };
}

export interface LowDetailBodyShape {
  pelvisWidth: number;
  pelvisHeight: number;
  pelvisDepth: number;
  torsoWidth: number;
  torsoHeight: number;
  torsoDepth: number;
  torsoCenterY: number;
  neckCenterY: number;
  headCenterY: number;
  hairCenterY: number;
}

/** Measurements from the assembled skeleton, in metres, without hair. */
export function anatomyMeasurements(p: Proportions) {
  const height = p.hipY + p.hipH * 0.5 + p.spineLen + p.chestLen + p.neckLen + p.headR * 1.8;
  const shoulderHeight = p.hipY + p.hipH * 0.5 + p.spineLen + p.chestLen * 0.84;
  return {
    height,
    heads: height / p.headH,
    shoulderHeight,
    inseam: p.thigh + p.shin,
    shoulderWidth: p.shoulderW * 1.04 + p.armR * 2.36,
    wristHeight: shoulderHeight - p.upperArm - p.foreArm,
    footLength: p.footLen,
  };
}

/**
 * Dimensions for the instanced distant-player body, derived from the same
 * joints as the hero rig so the LOD switch preserves scale and alignment.
 */
export function lowDetailBodyFor(p: Proportions): LowDetailBodyShape {
  const pelvisRadius = p.hipW * 0.62;
  const pelvisHeight = p.hipH * 1.5;
  const torsoBottom = p.hipH * 0.38;
  const torsoTop = p.hipH * 0.5 + p.spineLen + p.chestLen;
  const neckBase = p.hipY + p.hipH * 0.5 + p.spineLen + p.chestLen;

  return {
    pelvisWidth: pelvisRadius * 2,
    pelvisHeight,
    pelvisDepth: p.chestD * 1.7,
    torsoWidth: p.chestW * 2.04,
    torsoHeight: torsoTop - torsoBottom,
    torsoDepth: p.chestD * 2,
    torsoCenterY: p.hipY + (torsoTop + torsoBottom) * 0.5,
    neckCenterY: neckBase + p.neckLen * 0.5,
    headCenterY: neckBase + p.neckLen + p.headR * 0.66,
    hairCenterY: neckBase + p.neckLen + p.headR * 0.98,
  };
}

/* -------------------------------------------------------------------------- */
/*  Nível de detalhe                                                          */
/* -------------------------------------------------------------------------- */

export type LodLevel = 0 | 1 | 2; // 0 = perto (tudo), 1 = médio, 2 = longe

export function lodForDistance(
  dist: number,
  quality: "alta" | "media" | "baixa",
  previous?: LodLevel | null,
): LodLevel {
  const detail = getVisual().playerDetail;
  const bias = detail === "detalhado" ? 1.6 : detail === "simples" ? 0.5 : 1;
  const near = (quality === "alta" ? 26 : quality === "media" ? 18 : 12) * bias;
  const mid = (quality === "alta" ? 62 : quality === "media" ? 46 : 32) * bias;
  if (previous !== undefined && previous !== null) {
    // Keep a small deadband around each boundary so camera jitter cannot make
    // eyes, fingers and boot detail flash on and off every other frame.
    const nearBand = Math.max(0.9, near * 0.06);
    const midBand = Math.max(1.25, (mid - near) * 0.045);
    if (previous === 0) {
      if (dist < near + nearBand) return 0;
      return dist < mid + midBand ? 1 : 2;
    }
    if (previous === 1) {
      if (dist < near - nearBand) return 0;
      return dist < mid + midBand ? 1 : 2;
    }
    if (dist < near - nearBand) return 0;
    return dist < mid - midBand ? 1 : 2;
  }
  if (dist < near) return 0;
  if (dist < mid) return 1;
  return 2;
}

/**
 * Segmentos de geometria por LOD.
 *
 * Tronco e cabeça dominam a silhueta e recebem mais segmentos; braços e pernas
 * são finos na tela e podem ser bem mais baratos sem diferença perceptível.
 */
export function segmentsFor(lod: LodLevel): {
  radial: number;
  cap: number;
  torso: number;
  head: number;
} {
  // Dense anatomy is reserved by matchRigSegments for the isolated portrait.
  // Broadcast squads use a stable, bounded topology across camera cuts.
  if (lod === 0) return { radial: 80, cap: 12, torso: 96, head: 64 };
  if (lod === 1) return { radial: 8, cap: 3, torso: 10, head: 10 };
  return { radial: 6, cap: 2, torso: 7, head: 7 };
}

/* -------------------------------------------------------------------------- */
/*  Utilidades de cor                                                         */
/* -------------------------------------------------------------------------- */

export function shade(hex: string, amount: number): string {
  const c = hex.replace("#", "");
  const n = parseInt(
    c.length === 3
      ? c
          .split("")
          .map((x) => x + x)
          .join("")
      : c,
    16,
  );
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  if (amount >= 0) {
    r = Math.round(r + (255 - r) * amount);
    g = Math.round(g + (255 - g) * amount);
    b = Math.round(b + (255 - b) * amount);
  } else {
    const k = 1 + amount;
    r = Math.round(r * k);
    g = Math.round(g * k);
    b = Math.round(b * k);
  }
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/** cor de sombra suave da pele, usada em áreas internas (pescoço, axilas) */
export function skinShadow(skin: string): string {
  return shade(skin, -0.22);
}
