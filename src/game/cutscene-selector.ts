// ============================================================================
//  cutscene-selector.ts
//  Sorteio contextual de cenas de história: a carreira ESCOLHE o roteiro.
//
//  Antes o sorteio era uma lista de `if`s dentro do modo temporada. Agora as
//  regras vivem aqui, ordenadas por prioridade, cada uma explicando QUANDO
//  dispara e SE pode repetir. A ordem importa: demissão atropela crise, crise
//  atropela rotina, e a rotina nunca atropela uma cerimônia.
//
//  Regras de repetição:
//   - marcos (acesso, demissão, reconstrução) disparam uma vez por carreira;
//   - humores (crise, pressão, guerra de palavras) podem voltar, mas nunca em
//     semanas seguidas — a cena da semana passada é vetada para não cansar.
// ============================================================================

import type { CareerState, Player } from "@/game/types";

export interface WeekResult {
  /** gols pró e contra da semana */
  gf: number;
  ga: number;
  /** rodada recém-jogada */
  round: number;
  /** id do adversário */
  opponentId: string;
}

export interface SelectorInput {
  before: CareerState;
  after: CareerState;
  week: WeekResult;
}

interface Rule {
  id: string;
  /** uma vez por carreira (true) ou pode voltar (false) */
  once: boolean;
  matches: (input: SelectorInput) => boolean;
}

function lineupOf(state: CareerState): Player[] {
  return state.lineup.map((id) => state.players[id]).filter((p): p is Player => Boolean(p));
}

/**
 * Gols do MEU clube num resultado guardado. Os resultados guardam o placar do
 * mandante (`hg`) e do visitante (`ag`); quem é quem depende de onde eu joguei.
 */
function myScore(
  result: CareerState["results"][number],
  clubId: string,
): { gf: number; ga: number } {
  const home = result.home === clubId;
  return { gf: home ? result.hg : result.ag, ga: home ? result.ag : result.hg };
}

function winlessRun(results: CareerState["results"], clubId: string, count: number): boolean {
  const tail = results.slice(-count);
  if (tail.length < count) return false;
  return tail.every((r) => myScore(r, clubId).gf <= myScore(r, clubId).ga);
}

function goalsConcededRun(results: CareerState["results"], clubId: string, count: number): boolean {
  const tail = results.slice(-count);
  if (tail.length < count) return false;
  return tail.every((r) => myScore(r, clubId).ga >= 2);
}

const RULES: Rule[] = [
  // ---- marcos de carreira (uma vez, prioridade máxima) ----
  {
    id: "sacking-night",
    once: true,
    matches: ({ before, after }) => !before.sacked && after.sacked,
  },
  {
    id: "rebuild-day-one",
    once: true,
    matches: ({ before, after }) =>
      before.sacked && !after.sacked && before.clubId !== after.clubId,
  },
  {
    id: "season-kickoff",
    once: true,
    matches: ({ after }) => after.round <= 2 && after.season >= 1,
  },
  {
    id: "legend-retirement",
    once: true,
    matches: ({ after }) => Object.values(after.players).some((p) => p.age >= 39 && p.apps >= 20),
  },
  // ---- pressão da diretoria ----
  {
    id: "ultimatum",
    once: false,
    matches: ({ after }) => !after.sacked && after.pressure >= 85,
  },
  {
    id: "crisis-meeting",
    once: false,
    matches: ({ after }) =>
      !after.sacked && after.pressure >= 62 && winlessRun(after.results, after.clubId, 3),
  },
  // ---- vestiário: o racha vem antes da união ----
  {
    id: "captain-split",
    once: true,
    matches: ({ after }) =>
      !after.sacked && after.pressure >= 55 && winlessRun(after.results, after.clubId, 2),
  },
  {
    id: "dressing-unity",
    once: true,
    matches: ({ after, week }) => !after.sacked && week.gf > week.ga && (after.streak ?? 0) >= 1,
  },
  // ---- luta contra a queda ----
  {
    id: "relegation-fight",
    once: false,
    matches: ({ after }) => !after.sacked && after.round >= 24 && (after.streak ?? 0) <= -2,
  },
  // ---- janela de transferências ----
  {
    id: "deadline-day",
    once: false,
    matches: ({ after }) => after.round === 4 || after.round === 22,
  },
  {
    id: "transfer-saga",
    once: false,
    matches: ({ after }) =>
      (after.round <= 4 || (after.round >= 19 && after.round <= 22)) &&
      (after.offers?.length ?? 0) > 0,
  },
  // ---- rotina de rivalidade e elenco ----
  {
    id: "mind-games",
    once: false,
    matches: ({ after }) => !after.sacked && after.round % 9 === 5,
  },
  {
    id: "captain-injury",
    once: false,
    matches: ({ after }) => lineupOf(after).some((p) => p.injuryWeeks >= 6),
  },
  {
    id: "academy-gem",
    once: true,
    matches: ({ after }) =>
      Object.values(after.players).some((p) => p.age <= 18 && (p.potential ?? 0) >= 82),
  },
  // ---- decisão: véspera de jogo grande ----
  {
    id: "cup-final-eve",
    once: false,
    // fases de copa são números: 0 oitavas, 1 quartas, 2 semifinal, 3 final
    matches: ({ after }) =>
      !after.sacked && (after.cups ?? []).some((cup) => !cup.out && cup.stage >= 2),
  },
  // ---- segundo arco: rotina de um time grande ----
  {
    id: "unbeatable-run",
    once: false,
    // acima do gatilho clássico (4): a cena nova é a "versão deluxe" da fase boa
    matches: ({ after }) => !after.sacked && (after.streak ?? 0) >= 6,
  },
  {
    id: "captain-100",
    once: true,
    matches: ({ after }) => Object.values(after.players).some((p) => p.apps >= 100),
  },
  {
    id: "injury-crisis",
    once: false,
    matches: ({ after }) =>
      Object.values(after.players).filter((p) => p.injuryWeeks > 0).length >= 3,
  },
  {
    id: "fan-fury",
    once: false,
    matches: ({ after }) => !after.sacked && after.pressure >= 78 && (after.streak ?? 0) <= -3,
  },
  {
    id: "board-pleased",
    once: false,
    matches: ({ before, after }) => !after.sacked && before.pressure - after.pressure >= 25,
  },
  {
    id: "empty-seats",
    once: false,
    matches: ({ after }) => after.ticketPrice >= 60 && (after.fanApproval ?? 50) < 40,
  },
];

export interface SelectorMemory {
  seen: Set<string>;
  /** cena da semana passada (nunca repete em sequência) */
  last?: string | undefined;
}

export function memoryFrom(state: CareerState, last?: string): SelectorMemory {
  return last === undefined
    ? { seen: new Set(state.seenScenes ?? []) }
    : { seen: new Set(state.seenScenes ?? []), last };
}

/**
 * Primeira regra que casa, respeitando marcos e anti-repetição. Devolve
 * `undefined` quando nenhuma regra casa — a semana segue sem cena.
 */
export function selectStoryScene(input: SelectorInput, memory: SelectorMemory): string | undefined {
  for (const rule of RULES) {
    if (rule.once && memory.seen.has(rule.id)) continue;
    if (!rule.once && memory.last === rule.id) continue;
    if (rule.matches(input)) return rule.id;
  }
  return undefined;
}

/** Regras que podem disparar agora, em ordem (para depuração e galeria). */
export function matchingRules(input: SelectorInput, memory: SelectorMemory): string[] {
  return RULES.filter((rule) => {
    if (rule.once && memory.seen.has(rule.id)) return false;
    if (!rule.once && memory.last === rule.id) return false;
    return rule.matches(input);
  }).map((rule) => rule.id);
}

export { goalsConcededRun };
