// ============================================================================
//  animation-core.ts
//  Tipos e utilidades compartilhadas do sistema de animação procedural.
//  Fica separado de `animation.ts` para que os clipes extras possam usar as
//  mesmas peças sem criar dependência circular.
// ============================================================================

// Tipos duplicados do visual-context para evitar dependencia circular
// Quando o sistema estabilizar, podemos mover esses tipos para um arquivo compartilhado
export type ActionPhase = "anticipation" | "action" | "contact" | "followThrough" | "recovery";
export type ContactType = "none" | "ground" | "ball" | "player" | "groundBall" | "airBall";
export type ReactionType =
  "none" | "balance" | "push" | "pull" | "dodge" | "fall" | "recovery" | "celebrate";
export type DominantFoot = "left" | "right" | "both";

export type JointName =
  | "hipY"
  | "hipPitch"
  | "hipRoll"
  | "hipYaw"
  | "spine"
  | "chest"
  | "headPitch"
  | "headYaw"
  | "armLPitch"
  | "armLRoll"
  | "elbowL"
  | "armRPitch"
  | "armRRoll"
  | "elbowR"
  | "legLPitch"
  | "legLRoll"
  | "kneeL"
  | "ankleL"
  | "legRPitch"
  | "legRRoll"
  | "kneeR"
  | "ankleR";

export type Pose = Record<JointName, number>;

export const JOINTS: JointName[] = [
  "hipY",
  "hipPitch",
  "hipRoll",
  "hipYaw",
  "spine",
  "chest",
  "headPitch",
  "headYaw",
  "armLPitch",
  "armLRoll",
  "elbowL",
  "armRPitch",
  "armRRoll",
  "elbowR",
  "legLPitch",
  "legLRoll",
  "kneeL",
  "ankleL",
  "legRPitch",
  "legRRoll",
  "kneeR",
  "ankleR",
];

export function emptyPose(): Pose {
  const p = {} as Pose;
  for (const j of JOINTS) p[j] = 0;
  return p;
}

export interface ClipCtx {
  /** tempo em segundos desde o início do clipe */
  t: number;
  /** progresso 0..1 quando o clipe é uma ação de duração fixa */
  u: number;
  /** velocidade do jogador em m/s */
  speed: number;
  /** 0..1 quanto o jogador está próximo do sprint */
  stride: number;
  /** variação individual determinística */
  seed: number;
}

export type Clip = (c: ClipCtx) => Pose;

/** mistura duas poses */
export function mixPose(a: Pose, b: Pose, k: number, out?: Pose): Pose {
  const o = out ?? emptyPose();
  for (const j of JOINTS) o[j] = a[j] + (b[j] - a[j]) * k;
  return o;
}

// -----------------------------------------------------------------------------
// Metadados de clipe para sistema de animacao
// -----------------------------------------------------------------------------

/** Tipos de familias de animacao para organizacao */
export type AnimationFamily =
  | "locomotion"
  | "ballControl"
  | "passing"
  | "shooting"
  | "defense"
  | "goalkeeper"
  | "celebration"
  | "recovery"
  | "idle";

/** Marcadores de eventos em um clipe (para sincronizacao com IK e efeitos) */
export interface ClipMarker {
  /** Nome do marcador (ex: "contact", "impact", "release") */
  name: string;
  /** Tempo normalizado (0-1) no clipe */
  time: number;
  /** Fase associada (opcional) */
  phase?: ActionPhase;
  /** Tipo de contato associado (opcional) */
  contactType?: ContactType;
  /** Reacao associada (opcional) */
  reaction?: ReactionType;
}

/** Metadados de um clipe de animacao */
export interface ClipMetadata {
  /** Searchable motion properties shared with the player preview. */
  tags?: string[];
  support?: "alternating" | "planted" | "airborne" | "ground";
  contactAt?: number;
  /** Familia a qual o clipe pertence */
  family: AnimationFamily;
  /** Se o clipe faz loop */
  loop: boolean;
  /** Duraao total do clipe em segundos (para acoes fixas) */
  duration?: number;
  /** Prioridade de selecao (0-1, maior = mais importante) */
  priority: number;
  /** Marcadores de eventos */
  markers?: ClipMarker[];
  /** Pe dominante sugerido (para acoes de chute/passe) */
  dominantFoot?: DominantFoot;
  /** Se o clipe pode ser interrompido */
  interruptible: boolean;
  /** Condicoes para transicao de entrada */
  entryConditions?: {
    minSpeed?: number;
    maxSpeed?: number;
    hasBall?: boolean;
    action?: string;
    phase?: ActionPhase;
  };
  /** Condicoes para transicao de saida */
  exitConditions?: {
    minSpeed?: number;
    maxSpeed?: number;
    nextAction?: string;
  };
}

/** Clipe com metadados */
export interface AnnotatedClip {
  /** Funcao do clipe */
  clip: Clip;
  /** Metadados */
  metadata: ClipMetadata;
}

/** Dicionario de clipes com metadados */
export type AnnotatedClips = Record<string, AnnotatedClip>;

/** Limites angulares seguros para cada articulacao (em radianos) */
export const JOINT_LIMITS: Record<JointName, { min: number; max: number }> = {
  hipY: { min: -Math.PI, max: Math.PI },
  hipPitch: { min: -0.5, max: 0.5 },
  hipRoll: { min: -0.3, max: 0.3 },
  hipYaw: { min: -0.2, max: 0.2 },
  spine: { min: -0.4, max: 0.4 },
  chest: { min: -0.3, max: 0.3 },
  headPitch: { min: -0.8, max: 0.5 },
  headYaw: { min: -1.0, max: 1.0 },
  armLPitch: { min: -1.2, max: 1.2 },
  armLRoll: { min: -0.8, max: 0.8 },
  elbowL: { min: -2.0, max: 0 },
  armRPitch: { min: -1.2, max: 1.2 },
  armRRoll: { min: -0.8, max: 0.8 },
  elbowR: { min: -2.0, max: 0 },
  legLPitch: { min: -1.0, max: 1.0 },
  legLRoll: { min: -0.5, max: 0.5 },
  kneeL: { min: -1.5, max: 0 },
  ankleL: { min: -0.5, max: 0.5 },
  legRPitch: { min: -1.0, max: 1.0 },
  legRRoll: { min: -0.5, max: 0.5 },
  kneeR: { min: -1.5, max: 0 },
  ankleR: { min: -0.5, max: 0.5 },
};

/** Verifica se uma pose esta dentro dos limites seguros */
export function isPoseValid(pose: Pose): boolean {
  for (const joint of JOINTS) {
    const value = pose[joint];
    const limits = JOINT_LIMITS[joint];
    if (!Number.isFinite(value) || value < limits.min || value > limits.max) {
      return false;
    }
  }
  return true;
}

/** Ajusta uma pose para ficar dentro dos limites seguros */
export function clampPose(pose: Pose): Pose {
  const clamped = { ...pose };
  for (const joint of JOINTS) {
    const value = pose[joint];
    const limits = JOINT_LIMITS[joint];
    clamped[joint] = Math.max(limits.min, Math.min(limits.max, value));
  }
  return clamped;
}

/** Filtro de clipes por familiares */
export function filterClipsByFamily(
  clips: Record<string, Clip>,
  family: AnimationFamily,
): Record<string, Clip> {
  // Por enquanto retorna todos, mas quando os metadados estiverem completos,
  // poderao ser filtrados por familia
  return clips;
}
