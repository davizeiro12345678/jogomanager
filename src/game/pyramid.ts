// ============================================================================
//  pyramid.ts
//  Divisões ligadas: acesso e rebaixamento entre a primeira e a segunda divisão
//  do mesmo país. O número de vagas é editável (Brasil 4, demais países 3).
//
//  O mundo original nunca é alterado: a composição de cada divisão na campanha
//  fica guardada no próprio save (`leagueClubs`), então recarregar o jogo
//  mantém a tabela exatamente como estava.
// ============================================================================

import { CLUBS, getLeague } from "./data/leagues";
import type { CareerState, TableRow } from "./types";

/** primeira divisão → segunda divisão do mesmo país */
export const PYRAMID: Record<string, string> = {
  bra: "bra2",
  eng: "eng2",
  esp: "esp2",
  ita: "ita2",
  ger: "ger2",
  fra: "fra2",
};

/** segunda divisão → primeira divisão */
export const PYRAMID_UP: Record<string, string> = Object.fromEntries(
  Object.entries(PYRAMID).map(([top, second]) => [second, top]),
);

const DEFAULT_SLOTS = 3;
const SLOTS: Record<string, number> = { bra: 4 };

/** Quantos clubes sobem/descem entre estas duas divisões. */
export function slotsFor(topLeagueId: string, override?: number): number {
  if (override && override > 0) return Math.min(8, Math.floor(override));
  return SLOTS[topLeagueId] ?? DEFAULT_SLOTS;
}

/** A divisão participa do sistema de acesso/rebaixamento? */
export function hasPyramid(leagueId: string): boolean {
  return leagueId in PYRAMID || leagueId in PYRAMID_UP;
}

/** Clubes da divisão dentro desta campanha (nunca a lista global). */
export function leagueClubIds(state: CareerState, leagueId?: string): string[] {
  const id = leagueId ?? state.leagueId;
  const saved = state.leagueClubs?.[id];
  if (saved && saved.length) return [...saved];
  return getLeague(id).clubs.map((c) => c.id);
}

export interface PyramidMove {
  /** divisão do treinador na próxima temporada */
  leagueId: string;
  /** composição das duas divisões depois da troca */
  leagueClubs: Record<string, string[]>;
  moved: "subiu" | "desceu" | null;
  promoted: string[];
  relegated: string[];
}

const strengthOf = (id: string) => CLUBS[id]?.strength ?? 70;

/**
 * Aplica acesso e rebaixamento ao fim da temporada.
 * `table` é a classificação final da divisão em que o treinador jogou.
 */
export function applyPyramid(
  state: CareerState,
  table: TableRow[],
  slotsOverride?: number,
): PyramidMove | null {
  const here = state.leagueId;
  const isTop = here in PYRAMID;
  const topId = isTop ? here : PYRAMID_UP[here];
  const secondId = isTop ? PYRAMID[here] : here;
  if (!topId || !secondId) return null;

  const slots = slotsFor(topId, slotsOverride);
  const topIds = leagueClubIds(state, topId);
  const secondIds = leagueClubIds(state, secondId);
  if (topIds.length <= slots || secondIds.length <= slots) return null;

  // A divisão que o treinador não disputou não roda simulação própria: a ordem
  // vem da força dos clubes, o que é determinístico e não inventa resultados.
  const byStrength = (ids: string[]) => [...ids].sort((a, b) => strengthOf(b) - strengthOf(a));

  const relegated = isTop
    ? table.slice(-slots).map((r) => r.clubId)
    : byStrength(topIds).slice(-slots);
  const promoted = isTop
    ? byStrength(secondIds).slice(0, slots)
    : table.slice(0, slots).map((r) => r.clubId);

  const nextTop = [...topIds.filter((id) => !relegated.includes(id)), ...promoted];
  const nextSecond = [...secondIds.filter((id) => !promoted.includes(id)), ...relegated];

  const mine = state.clubId;
  const moved = promoted.includes(mine) ? "subiu" : relegated.includes(mine) ? "desceu" : null;
  const leagueId = moved === "subiu" ? topId : moved === "desceu" ? secondId : here;

  return {
    leagueId,
    leagueClubs: { [topId]: nextTop, [secondId]: nextSecond },
    moved,
    promoted,
    relegated,
  };
}
