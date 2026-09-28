// ============================================================================
//  register-animations.ts
//  Registro central de todos os clipes de animação do jogo.
//
//  Este arquivo importa todos os clipes dos arquivos de animação e os registra
//  no ANIMATION_CATALOG com metadados apropriados.
//
//  Uso: import { ALL_CLIPS, getClip } from './register-animations'
// ============================================================================

import { BASE_CLIPS } from "./animation";
import type { ClipName } from "./animation";
import { EXTRA_CLIPS } from "./animation-extra";
import { EXTRA2_CLIPS } from "./animation-extra2";

import type { Clip, ClipCtx, Pose } from "./animation-core";
import type { AnimationFamily, AnnotatedClip, ClipMetadata } from "./animation-catalog";
import { ANIMATION_CATALOG, FAMILY_METADATA, STANDARD_MARKERS } from "./animation-catalog";

// ============================================================================
// Mapeamento de clipes para famílias
// ============================================================================

/** Mapeia nome de clipe para família */
const CLIP_FAMILY_MAP: Record<string, AnimationFamily> = {
  // ---- Idle / Locomotion ----
  idle: "idle",
  breathe: "idle",
  weightShift: "idle",

  // ---- Locomotion ----
  walk: "locomotion",
  jog: "locomotion",
  run: "locomotion",
  sprint: "locomotion",
  decelerate: "locomotion",
  turn: "locomotion",
  sideStep: "locomotion",
  backpedal: "locomotion",
  tired: "locomotion",
  stroll: "locomotion",
  joggingBack: "locomotion",
  curveRunLeft: "locomotion",
  curveRunRight: "locomotion",
  shuffleLeft: "locomotion",
  shuffleRight: "locomotion",
  explosiveStart: "locomotion",
  hardStop: "locomotion",
  runHeavy: "locomotion",
  runRelaxed: "locomotion",
  runTired: "locomotion",
  sprintFlatOut: "locomotion",
  sprintEasing: "locomotion",
  accelBurst: "locomotion",
  decelSteps: "locomotion",
  leanIntoTurnL: "locomotion",
  leanIntoTurnR: "locomotion",
  sideGallopL: "locomotion",
  sideGallopR: "locomotion",
  backpedalFast: "locomotion",
  checkShoulder: "locomotion",
  skipStep: "locomotion",
  dummyRun: "locomotion",

  // ---- Ball Control ----
  dribbleLight: "ballControl",
  dribbleFast: "ballControl",
  feint: "ballControl",
  cut: "ballControl",
  stepover: "ballControl",
  elastico: "ballControl",
  trap: "ballControl",
  jogDribble: "ballControl",
  sprintDribble: "ballControl",
  shuffleDribbleL: "ballControl",
  shuffleDribbleR: "ballControl",

  // ---- Passing ----
  passShort: "passing",
  passLong: "passing",
  cross: "passing",

  // ---- Shooting ----
  shotLow: "shooting",
  shotPower: "shooting",
  shotPlaced: "shooting",
  volley: "shooting",
  header: "shooting",

  // ---- Defense ----
  tackle: "defense",
  slide: "defense",
  block: "defense",
  intercept: "defense",

  // ---- Goalkeeper ----
  save: "goalkeeper",
  saveHigh: "goalkeeper",
  saveLow: "goalkeeper",
  diveLeft: "goalkeeper",
  diveRight: "goalkeeper",
  catch: "goalkeeper",
  punch: "goalkeeper",

  // ---- Celebration ----
  goal: "celebration",
  celebrate: "celebration",
  armsUp: "celebration",

  // ---- Recovery ----
  getUp: "recovery",
  injured: "recovery",
  recoverySprint: "recovery",

  // ---- Fallback ----
  idleStand: "idle",
};

// ============================================================================
// Metadados específicos por clipe (overrides)
// ============================================================================

const SHOT_MARKERS = STANDARD_MARKERS["shot"]!;
const PASS_MARKERS = STANDARD_MARKERS["pass"]!;

const CLIP_METADATA_OVERRIDES: Record<string, Omit<Partial<ClipMetadata>, "family">> = {
  // Locomotion - maioria faz loop
  idle: { loop: true, priority: 0.0 },
  breathe: { loop: true, priority: 0.0 },
  weightShift: { loop: true, priority: 0.0 },
  walk: { loop: true, priority: 0.1, duration: 1.0 },
  jog: { loop: true, priority: 0.2, duration: 0.8 },
  run: { loop: true, priority: 0.3, duration: 0.6 },
  sprint: { loop: true, priority: 0.4, duration: 0.5 },

  // Ball control
  dribbleLight: { loop: true, priority: 0.3 },
  dribbleFast: { loop: true, priority: 0.35 },

  // Actions - não fazem loop. Marcadores e pé dominante alimentam o contato com
  // a bola e o posicionamento dos pés durante a jogada.
  shotLow: {
    loop: false,
    priority: 0.8,
    duration: 0.8,
    markers: SHOT_MARKERS,
    dominantFoot: "right",
  },
  shotPower: {
    loop: false,
    priority: 0.8,
    duration: 0.8,
    markers: SHOT_MARKERS,
    dominantFoot: "right",
  },
  shotPlaced: {
    loop: false,
    priority: 0.8,
    duration: 0.8,
    markers: SHOT_MARKERS,
    dominantFoot: "right",
  },
  volley: {
    loop: false,
    priority: 0.75,
    duration: 0.6,
    markers: SHOT_MARKERS,
    dominantFoot: "right",
  },
  header: { loop: false, priority: 0.75, duration: 0.5, dominantFoot: "both" },
  bicycle: {
    loop: false,
    priority: 0.85,
    duration: 0.9,
    markers: SHOT_MARKERS,
    dominantFoot: "both",
  },

  passShort: {
    loop: false,
    priority: 0.6,
    duration: 0.5,
    markers: PASS_MARKERS,
    dominantFoot: "right",
  },
  passLong: {
    loop: false,
    priority: 0.6,
    duration: 0.6,
    markers: PASS_MARKERS,
    dominantFoot: "right",
  },
  cross: {
    loop: false,
    priority: 0.6,
    duration: 0.6,
    markers: PASS_MARKERS,
    dominantFoot: "right",
  },

  tackle: { loop: false, priority: 0.7, duration: 0.7 },
  slide: { loop: false, priority: 0.7, duration: 0.8 },
  block: { loop: false, priority: 0.7, duration: 0.5 },
  intercept: { loop: false, priority: 0.65, duration: 0.4 },

  // Goalkeeper
  save: { loop: false, priority: 0.9, duration: 0.9 },
  saveHigh: { loop: false, priority: 0.9, duration: 1.0 },
  saveLow: { loop: false, priority: 0.9, duration: 0.8 },
  diveLeft: { loop: false, priority: 0.9, duration: 1.0 },
  diveRight: { loop: false, priority: 0.9, duration: 1.0 },
  catch: { loop: false, priority: 0.85, duration: 0.7 },

  // Celebration
  goal: { loop: false, priority: 0.2, duration: 2.0, interruptible: true },
  celebrate: { loop: true, priority: 0.1, interruptible: true },
};

// ============================================================================
// Função para registrar todos os clipes
// ============================================================================

/** Registro de todos os clipes com metadados */
export const ALL_CLIPS: Record<string, Clip> = {
  ...BASE_CLIPS,
  ...EXTRA_CLIPS,
  ...EXTRA2_CLIPS,
};

/** Versão do catálogo de animações */
export const CATALOG_VERSION = 1;

/** Catálogo completo de clipes anotados */
export const ANNOTATED_CATALOG: {
  locomotion: Record<string, AnnotatedClip>;
  ballControl: Record<string, AnnotatedClip>;
  passing: Record<string, AnnotatedClip>;
  shooting: Record<string, AnnotatedClip>;
  defense: Record<string, AnnotatedClip>;
  goalkeeper: Record<string, AnnotatedClip>;
  celebration: Record<string, AnnotatedClip>;
  recovery: Record<string, AnnotatedClip>;
  idle: Record<string, AnnotatedClip>;
} = {
  locomotion: {},
  ballControl: {},
  passing: {},
  shooting: {},
  defense: {},
  goalkeeper: {},
  celebration: {},
  recovery: {},
  idle: {},
};

/**
 * O catálogo cresceu mais rápido que o mapa manual de famílias, e clipes sem
 * entrada caíam todos em "idle". Esta inferência por nome classifica os
 * restantes na família certa, mantendo o mapa explícito com prioridade.
 */
const FAMILY_HINTS: Array<[RegExp, AnimationFamily]> = [
  [/^gk/i, "goalkeeper"],
  [
    /^celebrate|^kneeSlide$|^groupHug$|^dejected$|^protest|^applaudFans$|^encourageTeammate$|^huddleTalk$/i,
    "celebration",
  ],
  [
    /tackle|^block|^intercept|^clearance|^lastDitch$|^offsideTrap$|^mark|^jockey$|^press|headerDefensive|^shoulderDuel$|^shoulderNudge$|^armBarHold$|^shoulderToShoulder$|^foulTrip$/i,
    "defense",
  ],
  [
    /^shot|shoot|volley|^header$|^bicycle|^chip|^finesse|^knuckle|^toePoke$|^divingHeader$|^powerHeader$|^glancingHeader$|^curlFarPost$|^tapInEasy$|^penaltyStrike$|^freeKickStrike$|^scoopLift$/i,
    "shooting",
  ],
  [
    /pass$|^cross|^cutback$|^switchPlay|^layoff|^loftedThrough$|^drivenCross$|^oneTwoRun$/i,
    "passing",
  ],
  [
    /dribble|^feint|^cut$|^stepover|stepOver|^elastico|^nutmeg$|^dragBack$|^scissors|^cruyffTurn$|^heelFlick$|^sombrero$|control$|^trap$|^shieldBall$|^knockOn$|^rouletteSpin$|^rainbowFlick$|^receiveTurn$|^closeControl$|^flipFlap$|^crossover|^shieldTurnOut$|^ballRollSole$|^juggleKeepUp$|^firstTouch|^bodyFeint|^fakeShotStop$|^dragPush$|^firstTime$/i,
    "ballControl",
  ],
  [
    /^recover|^getUpFast$|^fall|^stumble$|^landing$|^injury|^catchBreath|^exhaustedWalk$|^handsOn/i,
    "recovery",
  ],
  [/^pivot|^hurdleStep$|^jump|^slowJogHandsUp$|^walkTalk$|^pushOff$/i, "locomotion"],
];

function inferFamily(name: string): AnimationFamily {
  for (const [pattern, family] of FAMILY_HINTS) {
    if (pattern.test(name)) return family;
  }
  return "idle";
}

/**
 * Inicializa o catálogo de animações com todos os clipes.
 * Chame esta função uma vez no início do aplicativo.
 */
export function initializeAnimationCatalog(): void {
  const families: AnimationFamily[] = [
    "locomotion",
    "ballControl",
    "passing",
    "shooting",
    "defense",
    "goalkeeper",
    "celebration",
    "recovery",
    "idle",
  ];

  // Limpa catálogos existentes
  for (const family of families) {
    ANNOTATED_CATALOG[family] = {};
    ANIMATION_CATALOG[family] = {};
  }

  // Registra todos os clipes
  for (const [name, clip] of Object.entries(ALL_CLIPS)) {
    const family = CLIP_FAMILY_MAP[name] ?? inferFamily(name);
    const overrides = CLIP_METADATA_OVERRIDES[name] || {};
    const metadata = { ...FAMILY_METADATA[family], ...overrides, family };

    const annotatedClip: AnnotatedClip = { clip, metadata };

    ANNOTATED_CATALOG[family][name] = annotatedClip;
    ANIMATION_CATALOG[family][name] = annotatedClip;
  }
}

/**
 * Obtém um clipe pelo nome
 */
export function getClip(name: string): Clip | undefined {
  return ALL_CLIPS[name as keyof typeof ALL_CLIPS];
}

/**
 * Obtém um clipe anotado pelo nome
 */
export function getAnnotatedClip(name: string): AnnotatedClip | undefined {
  for (const family of Object.values(ANNOTATED_CATALOG)) {
    if (family[name]) {
      return family[name];
    }
  }
  return undefined;
}

/**
 * Obtém todos os clipes de uma família
 */
export function getClipsByFamily(family: AnimationFamily): Record<string, AnnotatedClip> {
  return ANNOTATED_CATALOG[family];
}

/**
 * Obtém todos os nomes de clipes de uma família
 */
export function getClipNamesByFamily(family: AnimationFamily): string[] {
  return Object.keys(ANNOTATED_CATALOG[family]);
}

// ============================================================================
// Inicialização automática
// ============================================================================

// Inicializa o catálogo automaticamente
initializeAnimationCatalog();

// Exporta tudo
export type { Clip, ClipCtx, Pose, ClipName, AnimationFamily, AnnotatedClip, ClipMetadata };
