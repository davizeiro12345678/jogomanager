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
  { height: number; girth: number; shoulder: number; leg: number }
> = {
  GK: { height: 1.045, girth: 1.03, shoulder: 1.05, leg: 1.01 },
  DF: { height: 1.025, girth: 1.05, shoulder: 1.06, leg: 1.0 },
  MF: { height: 0.99, girth: 0.97, shoulder: 0.98, leg: 1.0 },
  FW: { height: 1.0, girth: 0.99, shoulder: 1.0, leg: 1.02 },
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

  const gloves = pos === "GK";

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
  };
}

/* -------------------------------------------------------------------------- */
/*  Proporções ósseas                                                         */
/* -------------------------------------------------------------------------- */

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
  const rawHeadR = 0.108 * (0.98 + (h - 1) * 0.4);

  // look.height is measured against 1.80 m. Scale the whole skeleton together
  // so its actual assembled crown height matches that measurement. The old
  // independent segment lengths left the rendered athlete about 11 cm short.
  const capHeight =
    (look.hairStyle === "buzz" ? 0.96 : look.hairStyle === "short" ? 1.02 : 1.06) * look.hairVolume;
  const hairCrown = Math.max(
    1.14,
    0.16 + 0.99 * capHeight,
    look.hairStyle === "mohawk" ? 0.95 + 0.62 : 0,
    look.hairStyle === "curly" ? 0.42 + 1.1 : 0,
    look.hairStyle === "afro" ? 0.42 + 1.24 : 0,
  );
  const rawRigHeight =
    rawThigh +
    rawShin +
    rawFootH +
    rawHipH * 0.5 +
    rawSpineLen +
    rawChestLen +
    rawNeckLen +
    rawHeadR * (0.82 + hairCrown);
  const metricScale = (1.8 * h) / rawRigHeight;
  const thigh = rawThigh * metricScale;
  const shin = rawShin * metricScale;
  const footH = rawFootH * metricScale;
  const headR = rawHeadR * metricScale;

  return {
    hipY: thigh + shin + footH,
    hipW: 0.16 * g * strong * metricScale,
    hipH: rawHipH * metricScale,
    spineLen: rawSpineLen * metricScale,
    chestLen: rawChestLen * metricScale,
    chestW: 0.2 * g * strong * metricScale,
    chestD: 0.12 * g * strong * (look.bodyType === "strong" ? 1.05 : 1) * metricScale,
    shoulderW: 0.25 * g * strong * build.shoulder * metricScale,
    neckLen: rawNeckLen * metricScale,
    neckR: 0.052 * g * (look.role === "DF" || look.role === "GK" ? 1.06 : 1) * metricScale,
    headR,
    headH: 0.24 * h * metricScale,
    headW: headR * faceWide,
    headD: headR * (1.02 + (1 - faceWide) * 0.4),
    jawLen: headR * 0.52 * faceLong,
    chinFwd: headR * (0.12 + (faceLong - 0.94) * 0.5),
    upperArm: 0.28 * h * metricScale,
    foreArm: 0.24 * h * metricScale,
    armR: 0.048 * g * strong * metricScale,
    handR: 0.045 * g * metricScale,
    thigh,
    shin,
    legR: 0.066 * g * strong * metricScale,
    footLen: 0.26 * h * metricScale,
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

/**
 * Dimensions for the instanced distant-player body, derived from the same
 * joints as the hero rig so the LOD switch preserves scale and alignment.
 */
export function lowDetailBodyFor(p: Proportions): LowDetailBodyShape {
  const pelvisRadius = p.hipW * 0.62;
  const pelvisHeight = p.hipH * 0.6 + pelvisRadius * 2;
  const spineRadius = p.chestW * 0.5;
  const spineHeight = spineRadius * 2 + p.spineLen * 0.7;
  const spineCenter = p.hipH * 0.5 + p.spineLen * 0.5;
  const chestRadius = p.chestW * 0.58;
  const chestHeight = chestRadius * 2 + p.chestLen * 0.62;
  const chestCenter = p.hipH * 0.5 + p.spineLen + p.chestLen * 0.46;
  const torsoBottom = Math.min(spineCenter - spineHeight * 0.5, chestCenter - chestHeight * 0.5);
  const torsoTop = Math.max(spineCenter + spineHeight * 0.5, chestCenter + chestHeight * 0.5);
  const neckBase = p.hipY + p.hipH * 0.5 + p.spineLen + p.chestLen;

  return {
    pelvisWidth: pelvisRadius * 2,
    pelvisHeight,
    pelvisDepth: pelvisRadius * 2,
    torsoWidth: p.shoulderW * 0.8 + p.armR * 2.6,
    torsoHeight: torsoTop - torsoBottom,
    torsoDepth: Math.max(p.chestD * 2, p.chestW * 0.82),
    torsoCenterY: p.hipY + (torsoTop + torsoBottom) * 0.5,
    neckCenterY: neckBase + p.neckLen * 0.5,
    headCenterY: neckBase + p.neckLen + p.headR * 0.82,
    hairCenterY: neckBase + p.neckLen + p.headR * 0.98,
  };
}

/* -------------------------------------------------------------------------- */
/*  Nível de detalhe                                                          */
/* -------------------------------------------------------------------------- */

export type LodLevel = 0 | 1 | 2; // 0 = perto (tudo), 1 = médio, 2 = longe

export function lodForDistance(dist: number, quality: "alta" | "media" | "baixa"): LodLevel {
  const detail = getVisual().playerDetail;
  const bias = detail === "detalhado" ? 1.6 : detail === "simples" ? 0.5 : 1;
  const near = (quality === "alta" ? 26 : quality === "media" ? 18 : 12) * bias;
  const mid = (quality === "alta" ? 62 : quality === "media" ? 46 : 32) * bias;
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
  if (lod === 0) return { radial: 12, cap: 4, torso: 16, head: 18 };
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
