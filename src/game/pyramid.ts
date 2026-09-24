// ============================================================================
//  pyramid.ts
//  Divisões ligadas: acesso e rebaixamento entre a primeira e a segunda divisão
//  do mesmo país. O número de vagas é editável (Brasil 4, demais países 3).
//
//  O mundo original nunca é alterado: a composição de cada divisão na campanha
//  fica guardada no próprio save (`leagueClubs`), então recarregar o jogo
//  mantém a tabela exatamente como estava.
// ============================================================================

import { CLUBS, LEAGUES, getLeague } from "./data/leagues";
import type { CareerState, TableRow } from "./types";

/** primeira divisão → segunda divisão do mesmo país */
export const PYRAMID: Record<string, string> = {
  bra: "bra2",
  eng: "eng2",
  esp: "esp2",
  ita: "ita2",
  ger: "ger2",
  fra: "fra2",
  por: "por2",
  ned: "ned2",
  arg: "arg2",
  // divisões de acesso (terceira divisão em diante)
  bra2: "bra3",
  bra3: "y5079a",
  por2: "y5216",
  ita2: "y5340",
  esp2: "y5088",
};

// Remove elos cujas divisões não existem no catálogo (evita cair na liga padrão).
for (const [top, second] of Object.entries(PYRAMID)) {
  if (!LEAGUES.some((l) => l.id === top) || !LEAGUES.some((l) => l.id === second)) {
    delete PYRAMID[top];
  }
}

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

interface LinkResult {
  topId: string;
  secondId: string;
  nextTop: string[];
  nextSecond: string[];
  promoted: string[];
  relegated: string[];
}

/**
 * Troca clubes entre duas divisões ligadas. Se o treinador disputou uma delas,
 * a tabela final decide; a outra é ordenada pela força (determinístico).
 */
function applyLink(
  state: CareerState,
  topId: string,
  secondId: string,
  table: TableRow[],
  slotsOverride?: number,
): LinkResult | null {
  const slots = slotsFor(topId, slotsOverride);
  const topIds = leagueClubIds(state, topId);
  const secondIds = leagueClubIds(state, secondId);
  if (topIds.length <= slots || secondIds.length <= slots) return null;
  const byStrength = (ids: string[]) => [...ids].sort((a, b) => strengthOf(b) - strengthOf(a));
  const playedTop = state.leagueId === topId;
  const playedSecond = state.leagueId === secondId;
  const relegated = playedTop
    ? table.slice(-slots).map((r) => r.clubId)
    : byStrength(topIds).slice(-slots);
  const promoted = playedSecond
    ? table.slice(0, slots).map((r) => r.clubId)
    : byStrength(secondIds).slice(0, slots);
  return {
    topId,
    secondId,
    nextTop: [...topIds.filter((id) => !relegated.includes(id)), ...promoted],
    nextSecond: [...secondIds.filter((id) => !promoted.includes(id)), ...relegated],
    promoted,
    relegated,
  };
}

/**
 * Aplica acesso e rebaixamento ao fim da temporada.
 * `table` é a classificação final da divisão em que o treinador jogou.
 * Divisões intermediárias (ex.: Série B) sobem e descem ao mesmo tempo.
 */
export function applyPyramid(
  state: CareerState,
  table: TableRow[],
  slotsOverride?: number,
): PyramidMove | null {
  const here = state.leagueId;
  const up = PYRAMID_UP[here] ? applyLink(state, PYRAMID_UP[here]!, here, table, slotsOverride) : null;
  const down = PYRAMID[here] ? applyLink(state, here, PYRAMID[here]!, table, slotsOverride) : null;
  if (!up && !down) return null;

  const leagueClubs: Record<string, string[]> = {};
  if (up) {
    leagueClubs[up.topId] = up.nextTop;
    leagueClubs[up.secondId] = up.nextSecond;
  }
  if (down) {
    // A divisão do treinador perde os promovidos (elo de cima) e os rebaixados (elo de baixo).
    const base = leagueClubs[here] ?? leagueClubIds(state, here);
    leagueClubs[here] = [
      ...base.filter((id) => !down.relegated.includes(id)),
      ...down.promoted,
    ];
    leagueClubs[down.secondId] = down.nextSecond;
  }

  const promoted = up?.promoted ?? down?.promoted ?? [];
  const relegated = down?.relegated ?? up?.relegated ?? [];
  const mine = state.clubId;
  const moved =
    up?.promoted.includes(mine) ? "subiu" : down?.relegated.includes(mine) ? "desceu" : null;
  const leagueId = moved === "subiu" ? up!.topId : moved === "desceu" ? down!.secondId : here;
  return { leagueId, leagueClubs, moved, promoted, relegated };
}
