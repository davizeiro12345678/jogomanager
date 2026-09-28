// ============================================================================
//  visual-context.ts
//  Contrato visual da engine - tipos para contexto de acao e contato.
//
//  Separa dados que alteram comportamento da IA (em sim.ts) dos dados
//  somente visuais (usados por PlayerRig, LowPlayers e sistema de animacao).
//
//  Todos os dados sao deterministicos e versionados para compatibilidade
//  com replays antigos.
// ============================================================================

import type { Side } from "./sim";
import type { PlayerAction } from "./animation";

// -----------------------------------------------------------------------------
// Tipos de contexto visual
// -----------------------------------------------------------------------------

/** Pe dominante do jogador (deterministico por seed) */
export type DominantFoot = "left" | "right";

/** Fase da acao: preparacao, execucao, contato, follow-through, recuperacao */
export type ActionPhase = "anticipation" | "action" | "contact" | "followThrough" | "recovery";

/** Tipo de contato fisico */
export type ContactType =
  | "none"
  | "ground" // pe no chao
  | "ball" // contato com a bola
  | "player" // contato com outro jogador
  | "groundBall" // contato simultaneo com chao e bola
  | "airBall"; // bola no ar

/** Resultado da acao visual (nao afeta placar) */
export type VisualResult =
  | "none"
  | "success" // acao completada com sucesso visual
  | "interrupted" // acao interrompida
  | "blocked" // acao bloqueada
  | "missed"; // errou o alvo

/** Intensidade da acao (0-1, afeta exageracao da animacao) */
export type Intensity = number; // 0-1

// -----------------------------------------------------------------------------
// ActionContext - Contexto completo de uma acao visual
// -----------------------------------------------------------------------------

/**
 * Contexto visual de uma acao do jogador.
 *
 * Contem todos os dados necessarios para reproduzir a animacao de forma
 * deterministica, sem afetar o resultado esportivo (placar, estatisticas).
 *
 * Эти dados sao gerados por sim.ts e consumidos por:
 * - PlayerRig.tsx (IK, foco, contatos)
 * - LowPlayers.tsx (animacao simplificada)
 * - animation.ts (selecao de clipes)
 */
export interface ActionContext {
  /** Acao atual do jogador (nula = idle/locomocao) */
  action: PlayerAction | null;

  /** Tempo desde o inicio da acao (segundos) */
  actionT: number;

  /** Duraao total da acao (segundos) */
  actionDur: number;

  /** Fase atual da acao */
  phase: ActionPhase;

  /** Pe dominante usado na acao */
  dominantFoot: DominantFoot;

  /** Pe efetivamente usado (pode ser o nao-dominante em situacoes especificas) */
  usedFoot: DominantFoot;

  /** Alvo da acao (coordenadas x, z) */
  target: { x: number; z: number } | null;

  /** Ponto de impacto/contato (coordenadas x, z, altura) */
  contactPoint: { x: number; z: number; height: number } | null;

  /** Direcao do movimento (radianos, 0 = frente) */
  direction: number;

  /** Intensidade da acao (0-1) */
  intensity: Intensity;

  /** Resultado visual da acao */
  result: VisualResult;

  /** Reacao esperada (para transicoes suaves) */
  reaction: ReactionType;
}

// -----------------------------------------------------------------------------
// ContactContext - Contexto de contato fisico
// -----------------------------------------------------------------------------

/** Tipo de reacao fisica */
export type ReactionType =
  | "none"
  | "balance" // ajustar equilíbrio
  | "push" // empurrao
  | "pull" // puxao
  | "dodge" // desvio
  | "fall" // queda
  | "recovery" // recuperacao
  | "celebrate"; // comemoracao

/**
 * Contexto de contato fisico do jogador.
 *
 * Descreve o estado de contato com o ambiente (gramado, bola, outros jogadores)
 * para que o sistema de IK possa ajustar a pose adequadamente.
 */
export interface ContactContext {
  /** Tipo de contato atual */
  type: ContactType;

  /** Pe em contato com o chao (null = ambos ou nenhum) */
  groundFoot: DominantFoot | null;

  /** Forca do contato (0-1) */
  force: number;

  /** Ponto exato do contato no corpo (para IK) */
  bodyPoint: BodyContactPoint | null;

  /** Jogador em contato (se type === "player") */
  contactPlayerId: string | null;

  /** Velocidade relativa no momento do contato */
  relativeVelocity: { vx: number; vz: number } | null;
}

/** Pontos de contato no corpo para IK */
export type BodyContactPoint =
  | "footLeft"
  | "footRight"
  | "kneeLeft"
  | "kneeRight"
  | "hip"
  | "chest"
  | "head"
  | "handLeft"
  | "handRight"
  | "shoulderLeft"
  | "shoulderRight";

// -----------------------------------------------------------------------------
// VisualState - Estado visual completo do jogador
// -----------------------------------------------------------------------------

/**
 * Estado visual completo de um jogador.
 *
 * Combina ActionContext e ContactContext com dados adicionais para
 * renderizacao de alto nivel (Cinema profile).
 */
export interface VisualState {
  /** Contexto da acao atual */
  action: ActionContext;

  /** Contexto de contato fisico */
  contact: ContactContext;

  /** Foco visual (para onde o jogador esta olhando) */
  focus: FocusTarget;

  /** Nivel de fadiga visual (0-1, afeta respiracao, suor, etc.) */
  visualFatigue: number;

  /** Estado emocional (afeta expressoes faciais em Cinema) */
  emotion: EmotionState;

  /** Modificadores de silhueta (para LOD e Cinema) */
  silhouette: SilhouetteModifiers;
}

/** Alvo de foco visual */
export type FocusTarget =
  | { type: "none" }
  | { type: "ball"; x: number; z: number; height: number }
  | { type: "player"; playerId: string; x: number; z: number }
  | { type: "direction"; x: number; z: number }
  | { type: "ground"; x: number; z: number };

/** Estado emocional (para expressoes faciais em Cinema) */
export type EmotionState =
  | "neutral"
  | "focused"
  | "determined"
  | "stressed"
  | "tired"
  | "excited"
  | "disappointed"
  | "angry"
  | "pain"
  | "joy";

/** Modificadores de silhueta para LOD e Cinema */
export interface SilhouetteModifiers {
  /** Multiplicador de tamanho da silhueta (para legibilidade) */
  sizeScale: number;

  /** Ofset vertical (para evitar z-fighting) */
  verticalOffset: number;

  /** Prioridade de renderizacao (para culling) */
  renderPriority: number;

  /** Nivel de detalhe ativo */
  lodLevel: "cinema" | "high" | "medium" | "low";
}

// -----------------------------------------------------------------------------
// Dados de versionamento para replays
// -----------------------------------------------------------------------------

/** Versao do contrato visual */
export const VISUAL_CONTEXT_VERSION = 2;

/** Tipos de dados visuais para versionamento */
export type VisualDataVersion = typeof VISUAL_CONTEXT_VERSION;

/**
 * Estrutura para armazenar dados visuais versionados em replays.
 *
 * Permite que replays antigos (sem dados visuais) ainda funcionem,
 * enquanto novos replays incluam os dados completos.
 */
export interface VersionedVisualData {
  /** Versao do contrato visual */
  version: VisualDataVersion;

  /** Dados de ActionContext por jogador (ou null se nao disponivel) */
  actionContexts: (ActionContext | null)[];

  /** Dados de ContactContext por jogador (ou null se nao disponivel) */
  contactContexts: (ContactContext | null)[];

  /** Metadados adicionais do frame (opcional) */
  metadata?: {
    /** Tempo de simulacao do frame */
    simTime: number;
    /** Hash para verificacao de integridade */
    hash?: string;
  } | null;
}

// -----------------------------------------------------------------------------
// Funcoes utilitarias
// -----------------------------------------------------------------------------

/** Cria um ActionContext vazio */
export function emptyActionContext(): ActionContext {
  return {
    action: null,
    actionT: 0,
    actionDur: 0,
    phase: "anticipation",
    dominantFoot: "right",
    usedFoot: "right",
    target: null,
    contactPoint: null,
    direction: 0,
    intensity: 0,
    result: "none",
    reaction: "none",
  };
}

/** Cria um ContactContext vazio */
export function emptyContactContext(): ContactContext {
  return {
    type: "none",
    groundFoot: null,
    force: 0,
    bodyPoint: null,
    contactPlayerId: null,
    relativeVelocity: null,
  };
}

/** Cria um VisualState vazio */
export function emptyVisualState(): VisualState {
  return {
    action: emptyActionContext(),
    contact: emptyContactContext(),
    focus: { type: "none" },
    visualFatigue: 0,
    emotion: "neutral",
    silhouette: {
      sizeScale: 1,
      verticalOffset: 0,
      renderPriority: 0,
      lodLevel: "low",
    },
  };
}

/**
 * Determina o pe dominante de forma deterministica a partir de uma seed.
 *
 * @param seed - Semente do jogador (pid ou id)
 * @returns "left" ou "right"
 */
export function getDominantFoot(seed: string): DominantFoot {
  // Usa o hash da string para determinar de forma deterministica
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  // 50% de chance para cada pe (deterministico)
  return hash % 2 === 0 ? "right" : "left";
}

/**
 * Determina a fase da acao com base no progresso (u = actionT/actionDur).
 *
 * @param u - Progresso normalizado (0-1)
 * @returns Fase da acao
 */
export function getActionPhase(u: number): ActionPhase {
  if (u < 0.15) return "anticipation";
  if (u < 0.45) return "action";
  if (u < 0.65) return "contact";
  if (u < 0.85) return "followThrough";
  return "recovery";
}

/**
 * Cria um VersionedVisualData vazio para compatibilidade.
 */
export function emptyVersionedVisualData(playerCount: number): VersionedVisualData {
  return {
    version: VISUAL_CONTEXT_VERSION,
    actionContexts: Array(playerCount).fill(null),
    contactContexts: Array(playerCount).fill(null),
  };
}

// -----------------------------------------------------------------------------
// Funcoes de migracao de versao
// -----------------------------------------------------------------------------

/**
 * Migra dados visuais de uma versao antiga para a atual.
 *
 * @param oldData - Dados da versao antiga (ou null/undefined)
 * @param playerCount - Numero de jogadores
 * @returns Dados migrados para a versao atual
 */
export function migrateVisualData(
  oldData: Partial<VersionedVisualData> | null | undefined,
  playerCount: number,
): VersionedVisualData {
  // Se nao ha dados antigos, retorna dados vazios
  if (!oldData) {
    return emptyVersionedVisualData(playerCount);
  }

  // Se a versao for a atual, apenas preenche campos missing
  if (oldData.version === VISUAL_CONTEXT_VERSION) {
    const actionContexts = oldData.actionContexts ?? [];
    const contactContexts = oldData.contactContexts ?? [];

    // Garante que os arrays tem o tamanho correto
    const filledActionContexts = Array(playerCount).fill(null);
    const filledContactContexts = Array(playerCount).fill(null);

    for (let i = 0; i < Math.min(actionContexts.length, playerCount); i++) {
      filledActionContexts[i] = actionContexts[i];
    }
    for (let i = 0; i < Math.min(contactContexts.length, playerCount); i++) {
      filledContactContexts[i] = contactContexts[i];
    }

    return {
      version: VISUAL_CONTEXT_VERSION,
      actionContexts: filledActionContexts,
      contactContexts: filledContactContexts,
      ...(oldData.metadata !== undefined && { metadata: oldData.metadata }),
    };
  }

  // Migracao de versao 1 para 2
  // (Adicionar migracoes especificas aqui quando necessario)
  return emptyVersionedVisualData(playerCount);
}
