import { CLUBS } from "./data/leagues";
import { quickSimulate } from "./career";
import { makeRng } from "./rng";
import type { CareerState, NewsItem, Player, Position } from "./types";

/** Atributos que um exercício pode desenvolver. */
type DrillAttr = "pace" | "shooting" | "passing" | "defending" | "physical";

export interface Drill {
  id: string;
  label: string;
  /** o que o exercício treina, em linguagem de vestiário */
  desc: string;
  /** atributo principal desenvolvido */
  attr: DrillAttr;
  /** posições que mais aproveitam o exercício */
  targets: readonly Position[];
  /** desgaste médio de condição física */
  fatigue: number;
  /** ganho de moral do elenco */
  morale: number;
}

/** Exercícios táticos disponíveis. Um por rodada. */
export const DRILLS: readonly Drill[] = [
  {
    id: "posse",
    label: "Rondo de posse",
    desc: "Quadrado reduzido com dois toques. Melhora passe e saída de bola sob pressão.",
    attr: "passing",
    targets: ["MF", "DF"],
    fatigue: 4,
    morale: 2,
  },
  {
    id: "linha",
    label: "Linha defensiva em bloco",
    desc: "Sobe e desce a linha em conjunto para treinar impedimento e compactação.",
    attr: "defending",
    targets: ["DF", "MF"],
    fatigue: 5,
    morale: 1,
  },
  {
    id: "finalizacao",
    label: "Finalização em velocidade",
    desc: "Cruzamentos e chutes de primeira dentro da área. Melhora a pontaria dos atacantes.",
    attr: "shooting",
    targets: ["FW", "MF"],
    fatigue: 5,
    morale: 3,
  },
  {
    id: "transicao",
    label: "Transição rápida",
    desc: "Recuperou, ataca em cinco segundos. Treina contra-ataque e tomada de decisão.",
    attr: "pace",
    targets: ["FW", "MF", "DF"],
    fatigue: 7,
    morale: 2,
  },
  {
    id: "bolaparada",
    label: "Bola parada",
    desc: "Escanteios, faltas ensaiadas e marcação por zona na área.",
    attr: "shooting",
    targets: ["DF", "FW"],
    fatigue: 3,
    morale: 2,
  },
  {
    id: "drible",
    label: "Um contra um",
    desc: "Duelos individuais pelos lados. Desenvolve drible e marcação em espaço aberto.",
    attr: "pace",
    targets: ["FW", "MF"],
    fatigue: 6,
    morale: 3,
  },
  {
    id: "forca",
    label: "Força e resistência",
    desc: "Trabalho físico pesado: aguenta melhor os minutos finais, mas cansa a semana.",
    attr: "physical",
    targets: ["GK", "DF", "MF", "FW"],
    fatigue: 9,
    morale: -1,
  },
  {
    id: "goleiros",
    label: "Treino de goleiros",
    desc: "Reflexo, saída de gol e reposição com o pé para os arqueiros.",
    attr: "defending",
    targets: ["GK"],
    fatigue: 3,
    morale: 1,
  },
];

export function getDrill(id: string): Drill | undefined {
  return DRILLS.find((d) => d.id === id);
}

/** Chave da rodada atual, usada para liberar um exercício por rodada. */
function roundKey(state: CareerState): string {
  return `${state.season}-${state.round}`;
}

export function drillDoneThisRound(state: CareerState): string | null {
  return state.drillsByRound?.[roundKey(state)] ?? null;
}

export function friendlyDoneThisRound(state: CareerState): boolean {
  return (state.friendlies ?? []).some((f) => f.season === state.season && f.round === state.round);
}

/** Aplica um exercício ao elenco: desgaste, moral e evolução de atributo. */
export function runDrill(state: CareerState, drillId: string): CareerState {
  const drill = getDrill(drillId);
  if (!drill) return state;
  if (drillDoneThisRound(state)) return state;

  const intensity = state.trainingIntensity ?? 1;
  const fatigue = drill.fatigue * (intensity === 0 ? 0.6 : intensity === 2 ? 1.4 : 1);
  const growthChance = 0.1 + intensity * 0.05;
  const rnd = makeRng(`drill-${drillId}-${roundKey(state)}-${state.clubId}`);

  const players: Record<string, Player> = {};
  const improved: string[] = [];

  for (const [id, p] of Object.entries(state.players)) {
    const q: Player = { ...p };
    const focused = drill.targets.includes(q.pos);
    if (!q.injuryWeeks) {
      q.condition = Math.max(40, Math.min(100, q.condition - Math.round(fatigue)));
      q.morale = Math.max(25, Math.min(99, q.morale + drill.morale));
      const youthBonus = q.age <= 23 ? 1.6 : q.age <= 28 ? 1 : 0.5;
      if (focused && rnd() < growthChance * youthBonus) {
        const current = q[drill.attr] as number;
        const cap = q.potential ?? Math.min(99, q.ovr + 6);
        if (current < 99 && q.ovr <= cap) {
          (q as unknown as Record<string, number>)[drill.attr] = Math.min(99, current + 1);
          if (rnd() < 0.3) q.ovr = Math.min(cap, q.ovr + 1);
          improved.push(q.name);
        }
      }
    }
    players[id] = q;
  }

  const news: NewsItem = {
    id: `drill-${drillId}-${roundKey(state)}`,
    season: state.season,
    round: state.round,
    kind: "sistema",
    title: `Treino tático: ${drill.label}`,
    body: improved.length
      ? `${improved.slice(0, 3).join(", ")}${improved.length > 3 ? " e outros" : ""} responderam bem ao exercício.`
      : "O elenco cumpriu o trabalho, sem evolução destacada nesta semana.",
  };

  return {
    ...state,
    players,
    drillsByRound: { ...(state.drillsByRound ?? {}), [roundKey(state)]: drillId },
    news: [news, ...state.news].slice(0, 60),
  };
}

export interface FriendlyResult {
  state: CareerState;
  hg: number;
  ag: number;
  opponent: string;
}

/** Disputa um amistoso contra um clube real: resultado, desgaste e moral. */
export function playFriendly(state: CareerState, opponentId: string): FriendlyResult | null {
  if (friendlyDoneThisRound(state)) return null;
  const opponent = CLUBS[opponentId];
  if (!opponent || opponentId === state.clubId) return null;

  const seed = `friendly-${roundKey(state)}-${state.clubId}-${opponentId}`;
  const { hg, ag } = quickSimulate(state.clubId, opponentId, seed);
  const rnd = makeRng(`${seed}-fx`);
  const won = hg > ag;

  const players: Record<string, Player> = {};
  for (const [id, p] of Object.entries(state.players)) {
    const q: Player = { ...p };
    if (!q.injuryWeeks) {
      const played = state.lineup.includes(id) || state.bench.includes(id);
      q.condition = Math.max(40, q.condition - (played ? 7 + Math.floor(rnd() * 5) : 2));
      q.morale = Math.max(25, Math.min(99, q.morale + (won ? 3 : hg === ag ? 1 : -1)));
    }
    players[id] = q;
  }

  const news: NewsItem = {
    id: `friendly-${roundKey(state)}-${opponentId}`,
    season: state.season,
    round: state.round,
    kind: "sistema",
    title: `Amistoso: ${hg} x ${ag} ${opponent.short}`,
    body: won
      ? `Vitória no amistoso contra o ${opponent.name}. Elenco volta animado aos treinos.`
      : hg === ag
        ? `Empate no amistoso contra o ${opponent.name}, com rodízio de titulares.`
        : `Derrota no amistoso contra o ${opponent.name}. Serve de alerta antes da rodada.`,
  };

  return {
    opponent: opponent.name,
    hg,
    ag,
    state: {
      ...state,
      players,
      friendlies: [
        { season: state.season, round: state.round, opponentId, hg, ag },
        ...(state.friendlies ?? []),
      ].slice(0, 40),
      news: [news, ...state.news].slice(0, 60),
    },
  };
}
