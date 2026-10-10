// ============================================================================
//  kit-atlas.ts
//  Política de textura de camisa: quemrecebe versão de herói e quem recebe a
//  versão reduzida.
//
//  O desenho da camisa mora em `kits.ts` (padrão do clube, brasão, número).
//  Aqui fica a decisão de QUAL nível de detalhe pedir, porque é essa decisão
//  que define quanta memória de textura e quantos uploads a partida faz:
//
//   - herói (512² com nome): só os atletas em LOD 0 e com qualidade alta;
//   - elenco (128² sem nome): todo o resto do time em campo.
//
//  Também centraliza o orçamento: `kitBudgetReport()` diz quanto está gasto e
//  `trimKitTextures()` devolve ao limite quando o cache cresce demais (troca de
//  clube em sequência, replay de várias partidas).
// ============================================================================

import {
  kitTexture,
  kitTextureStats,
  trimKitTextureCache,
  type Kit,
  type KitDetail,
} from "@/game/kits";

export type { KitDetail };

export interface KitRequest {
  /** nível de LOD do atleta (0 = perto) */
  lod?: number;
  /** qualidade efetiva da cena */
  quality?: "alta" | "media" | "baixa";
  /** modo de câmera que valoriza close (replay/cinema) */
  closeUp?: boolean;
}

/**
 * Decide o nível de detalhe da camisa. A regra é conservadora de propósito:
 * em qualidade média ou baixa ninguém recebe 512², porque o gargalo desses
 * tiers é memória e bandwidth, não nitidez de número.
 */
export function kitDetailFor({
  lod = 2,
  quality = "media",
  closeUp = false,
}: KitRequest): KitDetail {
  if (quality === "baixa") return "squad";
  if (quality !== "alta") return "squad";
  return lod === 0 || closeUp ? "hero" : "squad";
}

/** Textura da camisa já com o nível de detalhe certo para a distância. */
export function kitTextureFor(
  kit: Kit,
  number: number,
  name: string | undefined,
  request: KitRequest = {},
): ReturnType<typeof kitTexture> {
  return kitTexture(kit, number, name, kitDetailFor(request));
}

export interface KitBudget {
  entries: number;
  bytes: number;
  heroBytes: number;
  /** Active owners are protected; keep only a small warm atlas cache. */
  limitBytes: number;
  overBudget: boolean;
}

const MB = 1024 * 1024;

/** Orçamento de textura de camisa por qualidade. */
export function kitBudget(quality: "alta" | "media" | "baixa" = "media"): KitBudget {
  const stats = kitTextureStats();
  const limitBytes = (quality === "alta" ? 16 : 8) * MB;
  return { ...stats, limitBytes, overBudget: stats.bytes > limitBytes };
}

export function formatKitBudget(budget: KitBudget): string {
  const mb = (bytes: number) => `${(bytes / MB).toFixed(1)} MB`;
  return `camisas: ${budget.entries} tex · ${mb(budget.bytes)} (herói ${mb(budget.heroBytes)}) / ${mb(budget.limitBytes)}${budget.overBudget ? " ⚠" : ""}`;
}

/**
 * Poda o cache de camisas quando passa do limite. A estratégia é descartar
 * primeiro as versões de herói (caras e fáceis de recalcular) e manter as
 * reduzidas, que são as que aparecem em quantidade.
 *
 * Devolve quantas entradas saíram; 0 significa "nada a fazer". O chamador
 * decide se quer forçar um novo frame depois da poda.
 */
export function trimKitTextures(limitBytes = 128 * MB): number {
  return trimKitTextureCache(limitBytes);
}
