// ============================================================================
//  pyramid.ts
//  Divisões ligadas: acesso e rebaixamento entre a primeira e a segunda divisão
//  do mesmo país. O número de vagas é editável (Brasil 4, demais países 3).
//
//  O mundo original nunca é alterado: o elenco de cada divisão na campanha fica
//  guardado no próprio save (`leagueClubs`), então recarregar o jogo mantém a
//  tabela exatamente como estava.
// ============================================================================

import { getLeague } from "./data/leagues";
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

/** A divisão tem ligação de acesso/rebaixamento? */
export function hasPyramid(leagueId: string): boolean {
  return leagueId in PYRAMID || leagueId in PYRAMID_UP;
}

/** Lista de clubes da divisão dentro desta campanha (nunca a global). */
export function leagueClubIds(state: CareerState, leagueId?: string): string[] {
  const id = leagueId ?? state.leagueId;
  const saved = state.leagueClubs?.[id];
  if (saved && saved.length) return [...saved];
  return getLeague(id).clubs.map((c) => c.id);
}

export interface PyramidMove {
  /** divisão do treinador na próxima temporada */
  leagueId: string;
  /** composição das divisões afetadas depois da troca */
  leagueClubs: Record<string, string[]>;
  moved: "subiu" | "desceu" | null;
  promoted: string[];
  relegated: string[];
}

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
  const other = isTop ? PYRAMID[here]! : PYRAMID_UP[here];
  if (!other) return null;

  const topId = isTop ? here : other;
  const slots = slotsFor(topId, slotsOverride);

  const hereIds = leagueClubIds(state, here);
  const otherIds = leagueClubIds(state, other);
  if (hereIds.length <= slots || otherIds.length <= slots) return null;

  // classificação da outra divisão: sem simulação própria, usa a força dos
  // clubes como ordem estável da temporada (determinístico e sem inventar).
  const otherRanked = [...otherIds].sort((a, b) => strength(b) - strength(a));

  let relegated: string[];
  let promoted: string[];

  if (isTop) {
    // os últimos daqui descem, os primeiros de baixo sobem
    relegated = table.slice(-slots).map((r) => r.clubId);
    promoted = otherRanked.slice(0, slots);
  } else {
    // os primeiros daqui sobem, os últimos de cima descem
    promoted = table.slice(0, slots).map((r) => r.clubId);
    relegated = otherRanked.slice(-slots);
  }

  const topIds = isTop ? hereIds : otherIds;
  const secondIds = isTop ? otherIds : hereIds;

  const nextTop = [...topIds.filter((id) => !relegated.includes(id)), ...promoted];
  const nextSecond = [...secondIds.filter((id) => !promoted.includes(id)), ...relegated];

  const mine = state.clubId;
  const moved = promoted.includes(mine) ? "subiu" : relegated.includes(mine) ? "desceu" : null;
  const leagueId = nextTop.includes(mine) ? topId : nextSecond.includes(mine) ? other === topId ? here : (isTop ? other : here) : here;

  return {
    leagueId: moved === "subiu" ? topId : moved === "desceu" ? (isTop ? other : here) : leagueId,
    leagueClubs: { [topId]: nextTop, [isTop ? other : here]: nextSecond },
    moved,
    promoted,
    relegated,
  };
}

function strength(clubId: string): number {
  for (const league of [] as never[]) void league;
  return CLUB_STRENGTH[clubId] ?? 70;
}

/** força por clube, lida uma vez (a lista global é imutável durante o jogo) */
const CLUB_STRENGTH: Record<string, number> = {};
export function primeStrengthCache(ids: string[]) {
  for (const id of ids) {
    if (CLUB_STRENGTH[id] !== undefined) continue;
    const club = getLeague("bra").clubs.find((c) => c.id === id);
    if (club) CLUB_STRENGTH[id] = club.strength;
  }
}
