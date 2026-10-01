// ============================================================================
//  draw-budget.ts
//  Alocação de desenhos (draw calls) por subsistema.
//
//  O contrato de cada tier define um teto de desenhos (`maxDrawCalls`). O
//  jogador em rig completo é o item mais caro da cena: um atleta em LOD 0 custa
//  `HERO_MESH_COST` desenhos (medido em `rig-skin.test.ts`). Em vez de fixar
//  "2 heróis" e torcer para caber, a quantidade de heróis é derivada do quanto
//  sobrou no orçamento depois dos subsistemas medidos.
//
//  Função pura: recebe o total medido e devolve quantos heróis cabem.
// ============================================================================

import { GRAPHICS_PROFILES, type GraphicsTier } from "./contracts/graphics-profile";

/**
 * Custo medido de um atleta em rig completo, LOD 0, qualidade alta: o corpo é
 * rendido como SkinnedMesh (`buildRigSkin`), um desenho por grupo de material
 * — materiais compartilhados, contra ~53 malhas da versão mesclada por junta
 * e ~117 do rig original. Só os grupos "core" entram no mapa de sombras.
 * O pior caso medido em 128 variantes de porte, cabelo, manga e acessórios
 * custa 34 desenhos, incluindo a passagem de sombras (player-sculpt.test.ts).
 * Nas LODs distantes os grupos de detalhe ficam ocultos, e o custo real é
 * menor — usamos o pior caso para o allocador nunca prometer demais.
 */
export const HERO_MESH_COST = 34;

/** Margem de segurança: não encosta no teto do tier. */
export const BUDGET_HEADROOM = 0.95;

export interface HeroAllocation {
  /** desenhos disponíveis para heróis */
  available: number;
  /** heróis que cabem, já limitados pelo teto do tier */
  count: number;
  /** motivo útil para depuração/overlay */
  reason: "orçamento" | "teto" | "mínimo";
}

/**
 * Deriva quantos atletas em rig completo a cena pode pagar.
 *
 * @param maxDraws      teto de desenhos do tier
 * @param nonHeroDraws  desenhos medidos fora dos heróis
 * @param cap           teto de heróis do tier/pressão (do orçamento de cena)
 * @param min           mínimo aceitável (0 em baixa, 1 quando há heróis)
 */
export function allocateHeroes(
  maxDraws: number,
  nonHeroDraws: number,
  cap: number,
  min = 0,
  heroCost: number = HERO_MESH_COST,
): HeroAllocation {
  const available = Math.max(0, maxDraws * BUDGET_HEADROOM - nonHeroDraws);
  const fits = Math.floor(available / Math.max(1, heroCost));
  const count = Math.max(min, Math.min(cap, fits));
  const reason = fits >= cap ? "teto" : fits <= min ? "mínimo" : "orçamento";
  return { available, count, reason };
}

/**
 * Desenhos fora dos heróis, estimados a partir do total medido e de quantos
 * heróis estão montados (o custo por herói é conhecido).
 */
export function nonHeroDraws(
  totalDraws: number,
  heroesMounted: number,
  heroCost = HERO_MESH_COST,
): number {
  return Math.max(0, totalDraws - heroesMounted * heroCost);
}

/** Teto de heróis de um tier antes da pressão do governador. */
export function heroCapFor(tier: GraphicsTier): number {
  return GRAPHICS_PROFILES[tier].maxDrawCalls > 0 ? HERO_CAP[tier] : 0;
}

const HERO_CAP: Record<GraphicsTier, number> = {
  baixa: 0,
  media: 3,
  alta: 6,
  cinema: 8,
};

/** Teto equivalente para replays (câmera fecha nos heróis, cabe mais). */
export function replayHeroCapFor(tier: GraphicsTier): number {
  return Math.min(12, heroCapFor(tier) + 4);
}
