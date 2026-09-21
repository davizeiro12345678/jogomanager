// ============================================================================
//  animation-catalog.ts
//  Catálogo organizado de clipes de animação por famílias.
// 
//  Este arquivo centraliza todos os clipes do jogo e os organiza por famílias,
//  com metadados para transições inteligentes e seleção baseada em contexto.
// 
//  Famílias:
//  - locomotion: movimento básico (idle, walk, run, sprint, etc.)
//  - ballControl: controle de bola (dribble, trap, feint, etc.)
//  - passing: passes (passShort, passLong, cross, etc.)
//  - shooting: finalizações (shotLow, shotPower, shotPlaced, etc.)
//  - defense: ações defensivas (tackle, slide, block, intercept, etc.)
//  - goalkeeper: ações do goleiro (save, dive, catch, etc.)
//  - celebration: comemorações (goal, assist, etc.)
//  - recovery: recuperação (getUp, injured, etc.)
//  - idle: posições estáticas
// ============================================================================

import type { Clip, ClipCtx, Pose } from "./animation-core";
import type { AnimationFamily, ClipMetadata, ClipMarker, AnnotatedClip } from "./animation-core";

// Re-exporta tipos
export type { AnimationFamily, ClipMetadata, ClipMarker, AnnotatedClip };

// ============================================================================
// Utilidades de marcação de clipes
// ============================================================================

/** Marcadores padrão para clipes de ação */
export const STANDARD_MARKERS: Record<string, ClipMarker[]> = {
  // Marcadores para chutes
  shot: [
    { name: "anticipation", time: 0, phase: "anticipation" },
    { name: "windup", time: 0.2, phase: "action" },
    { name: "contact", time: 0.4, phase: "contact", contactType: "ball" },
    { name: "followThrough", time: 0.6, phase: "followThrough" },
    { name: "recovery", time: 0.85, phase: "recovery" },
  ],
  
  // Marcadores para passes
  pass: [
    { name: "anticipation", time: 0, phase: "anticipation" },
    { name: "windup", time: 0.25, phase: "action" },
    { name: "release", time: 0.45, phase: "contact", contactType: "ball" },
    { name: "followThrough", time: 0.65, phase: "followThrough" },
    { name: "recovery", time: 0.85, phase: "recovery" },
  ],
  
  // Marcadores para dribles
  dribble: [
    { name: "contact", time: 0.3, phase: "contact", contactType: "groundBall" },
    { name: "contact", time: 0.7, phase: "contact", contactType: "groundBall" },
  ],
  
  // Marcadores para defesas
  tackle: [
    { name: "anticipation", time: 0, phase: "anticipation" },
    { name: "contact", time: 0.35, phase: "contact", contactType: "player" },
    { name: "followThrough", time: 0.6, phase: "followThrough" },
    { name: "recovery", time: 0.85, phase: "recovery", reaction: "balance" },
  ],
  
  // Marcadores para goleiro
  save: [
    { name: "anticipation", time: 0, phase: "anticipation" },
    { name: "extension", time: 0.35, phase: "action" },
    { name: "contact", time: 0.5, phase: "contact", contactType: "ball" },
    { name: "recovery", time: 0.75, phase: "recovery" },
  ],
  
  // Marcadores para locomoção (loop contínuo)
  locomotion: [
    { name: "footContact", time: 0, phase: "contact", contactType: "ground" },
    { name: "footContact", time: 0.5, phase: "contact", contactType: "ground" },
  ],
};

/** Metadados padrão por família */
export const FAMILY_METADATA: { [K in AnimationFamily]: Partial<ClipMetadata> } = {
  locomotion: {
    family: "locomotion" as const,
    loop: true,
    priority: 0.1,
    interruptible: true,
  },
  ballControl: {
    family: "ballControl" as const,
    loop: true,
    priority: 0.3,
    interruptible: true,
  },
  passing: {
    family: "passing" as const,
    loop: false,
    duration: 0.6,
    priority: 0.5,
    interruptible: false,
  },
  shooting: {
    family: "shooting" as const,
    loop: false,
    duration: 0.8,
    priority: 0.8,
    interruptible: false,
  },
  defense: {
    family: "defense" as const,
    loop: false,
    duration: 0.7,
    priority: 0.7,
    interruptible: false,
  },
  goalkeeper: {
    family: "goalkeeper" as const,
    loop: false,
    duration: 0.9,
    priority: 0.9,
    interruptible: false,
  },
  celebration: {
    family: "celebration" as const,
    loop: false,
    duration: 2.0,
    priority: 0.2,
    interruptible: true,
  },
  recovery: {
    family: "recovery" as const,
    loop: false,
    duration: 1.0,
    priority: 0.4,
    interruptible: true,
  },
  idle: {
    family: "idle" as const,
    loop: true,
    priority: 0.0,
    interruptible: true,
  },
};

/** Cria metadados completos para um clipe */
export function createClipMetadata(
  family: AnimationFamily,
  overrides: Partial<ClipMetadata> = {}
): ClipMetadata {
  return {
    ...FAMILY_METADATA[family],
    ...overrides,
    family,
  } as ClipMetadata;
}

/** Cria um clipe anotado */
export function createAnnotatedClip(
  name: string,
  clip: Clip,
  family: AnimationFamily,
  overrides: Partial<ClipMetadata> = {}
): AnnotatedClip {
  return {
    clip,
    metadata: createClipMetadata(family, overrides),
  };
}

// ============================================================================
// Registro central de clipes por família
// ============================================================================

/** Dicionário de clipes organizados por família */
export interface FamilyClips {
  locomotion: Record<string, AnnotatedClip>;
  ballControl: Record<string, AnnotatedClip>;
  passing: Record<string, AnnotatedClip>;
  shooting: Record<string, AnnotatedClip>;
  defense: Record<string, AnnotatedClip>;
  goalkeeper: Record<string, AnnotatedClip>;
  celebration: Record<string, AnnotatedClip>;
  recovery: Record<string, AnnotatedClip>;
  idle: Record<string, AnnotatedClip>;
}

/** Catálogo vazio */
export function emptyCatalog(): FamilyClips {
  return {
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
}

/** Catálogo de todos os clipes do jogo */
export const ANIMATION_CATALOG: FamilyClips = emptyCatalog();

// ============================================================================
// Funções de seleção de clipes baseada em contexto
// ============================================================================

import type { ActionPhase, ContactType } from "./visual-context";

/** Contexto para seleção de clipe */
export interface ClipSelectionContext {
  action?: string | null;
  speed: number;
  hasBall: boolean;
  ballDist: number;
  stamina: number;
  defending: boolean;
  stopped: boolean;
  actionT?: number;
  actionDur?: number;
  phase?: ActionPhase;
  contactType?: ContactType;
  isGK?: boolean;
}

/** Seleciona o melhor clipe com base no contexto */
export function selectClipFromContext(
  ctx: ClipSelectionContext
): { name: string; family: AnimationFamily } {
  // Se tem uma ação específica, tenta encontrar o clipe correspondente
  if (ctx.action) {
    const actionName = ctx.action.toLowerCase();
    
    // Verifica em qual família a ação se encaixa
    if (ctx.isGK) {
      // Ações do goleiro
      if (actionName.includes("dive") || actionName.includes("save") || actionName.includes("catch")) {
        return { name: ctx.action, family: "goalkeeper" };
      }
    }
    
    if (actionName.includes("shot") || actionName.includes("shoot")) {
      return { name: ctx.action, family: "shooting" };
    }
    
    if (actionName.includes("pass") || actionName.includes("cross") || actionName.includes("clear")) {
      return { name: ctx.action, family: "passing" };
    }
    
    if (actionName.includes("tackle") || actionName.includes("slide") || actionName.includes("block") || actionName.includes("intercept")) {
      return { name: ctx.action, family: "defense" };
    }
    
    if (actionName.includes("dribble") || actionName.includes("feint") || actionName.includes("stepover") || actionName.includes("cut") || actionName.includes("elastico")) {
      return { name: ctx.action, family: "ballControl" };
    }
    
    if (actionName.includes("trap")) {
      return { name: ctx.action, family: "ballControl" };
    }
  }
  
  // Se não tem ação, seleciona com base no movimento
  if (ctx.stopped) {
    return { name: "idle", family: "idle" };
  }
  
  if (ctx.speed > 7) {
    return { name: "sprint", family: "locomotion" };
  }
  
  if (ctx.speed > 5) {
    return { name: "run", family: "locomotion" };
  }
  
  if (ctx.speed > 2) {
    return { name: "jog", family: "locomotion" };
  }
  
  if (ctx.speed > 0.5) {
    return { name: "walk", family: "locomotion" };
  }
  
  return { name: "idle", family: "idle" };
}

// ============================================================================
// Funções de transição entre clipes
// ============================================================================

/** Verifica se pode transicionar de um clipe para outro */
export function canTransition(
  from: AnnotatedClip,
  to: AnnotatedClip,
  ctx: ClipSelectionContext
): boolean {
  // Se o clipe atual não pode ser interrompido, não transiciona
  if (!from.metadata.interruptible && from.metadata.loop) {
    return false;
  }
  
  // Se o clipe de destino tem prioridade menor, não transiciona
  if (to.metadata.priority <= from.metadata.priority) {
    return false;
  }
  
  // Se o clipe atual é uma ação fixa (não loop), deixa ele terminar
  if (!from.metadata.loop && ctx.actionDur && ctx.actionT !== undefined) {
    const progress = ctx.actionT / ctx.actionDur;
    // Permite transição apenas nos últimos 10% da ação
    if (progress < 0.9) {
      return false;
    }
  }
  
  return true;
}

/** Calcula peso de blend entre dois clipes baseada em contexto */
export function calculateBlendWeight(
  from: AnnotatedClip,
  to: AnnotatedClip,
  ctx: ClipSelectionContext,
  transitionProgress: number
): number {
  // Transição linear simples
  return transitionProgress;
}
