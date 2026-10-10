import { CLUBS } from "./data/leagues";
import { quickSimulate } from "./career";
import { makeRng } from "./rng";
import { developedPlayer, profileFor, withDevelopmentBase } from "./attributes";
import {
  developmentResponse,
  effectivePlayer,
  limitedDevelopmentDelta,
  withDevelopmentSeasonStart,
} from "./player-development";
import type { AttrDeltas, DetailedAttributes } from "./attributes";
import type { CareerState, NewsItem, Player, Position, TrainingReport } from "./types";

/** Atributos que um exercício pode desenvolver. */
type DrillAttr = "pace" | "shooting" | "passing" | "defending" | "physical";

export interface Drill {
  id: string;
  label: string;
  /** o que o exercício treina, em linguagem de vestiário */
  desc: string;
  /** atributo principal desenvolvido */
  attr: DrillAttr;
  /** atributos detalhados que recebem evolução gradual no save de carreira */
  attrKeys: readonly (keyof DetailedAttributes)[];
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
    attrKeys: ["passing", "vision", "firstTouch", "ballControl", "teamwork"],
    targets: ["MF", "DF"],
    fatigue: 4,
    morale: 2,
  },
  {
    id: "linha",
    label: "Linha defensiva em bloco",
    desc: "Sobe e desce a linha em conjunto para treinar impedimento e compactação.",
    attr: "defending",
    attrKeys: ["marking", "tackling", "positioning", "anticipation", "concentration", "teamwork"],
    targets: ["DF", "MF"],
    fatigue: 5,
    morale: 1,
  },
  {
    id: "finalizacao",
    label: "Finalização em velocidade",
    desc: "Cruzamentos e chutes de primeira dentro da área. Melhora a pontaria dos atacantes.",
    attr: "shooting",
    attrKeys: ["finishing", "firstTouch", "offBall", "composure", "technique"],
    targets: ["FW", "MF"],
    fatigue: 5,
    morale: 3,
  },
  {
    id: "transicao",
    label: "Transição rápida",
    desc: "Recuperou, ataca em cinco segundos. Treina contra-ataque e tomada de decisão.",
    attr: "pace",
    attrKeys: ["pace", "acceleration", "decisions", "offBall", "anticipation", "stamina"],
    targets: ["FW", "MF", "DF"],
    fatigue: 7,
    morale: 2,
  },
  {
    id: "bolaparada",
    label: "Bola parada",
    desc: "Escanteios, faltas ensaiadas e marcação por zona na área.",
    attr: "shooting",
    attrKeys: ["setPieces", "crossing", "heading", "marking", "bravery", "concentration"],
    targets: ["DF", "FW"],
    fatigue: 3,
    morale: 2,
  },
  {
    id: "drible",
    label: "Um contra um",
    desc: "Duelos individuais pelos lados. Desenvolve drible e marcação em espaço aberto.",
    attr: "pace",
    attrKeys: ["dribbling", "ballControl", "technique", "agility", "balance", "tackling"],
    targets: ["FW", "MF"],
    fatigue: 6,
    morale: 3,
  },
  {
    id: "forca",
    label: "Força e resistência",
    desc: "Trabalho físico pesado: aguenta melhor os minutos finais, mas cansa a semana.",
    attr: "physical",
    attrKeys: ["strength", "stamina", "balance", "naturalFitness", "injuryResistance", "jumping"],
    targets: ["GK", "DF", "MF", "FW"],
    fatigue: 9,
    morale: -1,
  },
  {
    id: "goleiros",
    label: "Treino de goleiros",
    desc: "Reflexo, saída de gol e reposição com o pé para os arqueiros.",
    attr: "defending",
    attrKeys: ["reflexes", "handling", "oneOnOnes", "commandOfArea", "rushingOut", "distribution"],
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

function rounded(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/**
 * Cada atleta reage de forma reproduzível à mesma sessão. Condição, idade,
 * teto de evolução e personalidade alteram a resposta; por isso dois pontas
 * não recebem o mesmo ganho apenas por ocuparem a mesma posição.
 */
function trainingResponse(
  player: Player,
  intensity: 0 | 1 | 2,
  profile: ReturnType<typeof profileFor>,
) {
  const age = player.age <= 20 ? 1.15 : player.age <= 23 ? 1.08 : player.age <= 28 ? 1 : 0.76;
  const condition = Math.max(0.45, Math.min(1.1, player.condition / 82));
  const headroom = Math.max(
    0.25,
    Math.min(1.12, ((player.potential ?? player.ovr) - player.ovr + 8) / 12),
  );
  const personality =
    profile.personality === "profissional"
      ? 1.14
      : profile.personality === "determinado"
        ? 1.1
        : profile.personality === "líder"
          ? 1.05
          : profile.personality === "temperamental"
            ? 0.9
            : 1;
  const intensityFactor = intensity === 0 ? 0.78 : intensity === 2 ? 1.16 : 1;
  return age * condition * headroom * personality * intensityFactor;
}

function applyDetailedTrainingGain(
  deltas: AttrDeltas,
  player: Player,
  keys: readonly (keyof DetailedAttributes)[],
  response: number,
  state: CareerState,
) {
  const existing = { ...(deltas[player.id] ?? {}) };
  const profile = profileFor(player, { attrDeltas: deltas });
  const before = deltas[player.id] ?? {};
  let changed = false;

  keys.forEach((key, index) => {
    const weight = index === 0 ? 1 : Math.max(0.45, 0.78 - index * 0.06);
    const currentDelta = existing[key] ?? 0;
    const base = profile.attrs[key] - (before[key] ?? 0);
    const maxDelta = Math.max(0, 99 - base);
    const next = Math.min(maxDelta, currentDelta + 0.12 * response * weight);
    if (next > currentDelta + 0.001) {
      existing[key] = rounded(next, state.developmentRulesVersion === 2 ? 6 : 1);
      changed = true;
    }
  });

  if (changed) {
    if (state.developmentRulesVersion === 2) {
      const changes = Object.fromEntries(
        keys.map((key) => [key, (existing[key] ?? 0) - (before[key] ?? 0)]),
      );
      deltas[player.id] = limitedDevelopmentDelta(
        player,
        { ...state, attrDeltas: deltas },
        changes,
      );
    } else deltas[player.id] = existing;
  }
  return changed;
}

/** Aplica um exercício ao elenco: desgaste, moral e evolução de atributo. */
export function runDrill(state: CareerState, drillId: string): CareerState {
  const drill = getDrill(drillId);
  if (!drill) return state;
  if (drillDoneThisRound(state)) return state;

  // Garante que a ficha em cache parte exatamente do save recebido. Sem isso,
  // abrir duas carreiras na mesma sessão poderia reutilizar deltas da anterior.
  state = withDevelopmentSeasonStart(state);

  const intensity = state.trainingIntensity ?? 1;
  const fatigue = drill.fatigue * (intensity === 0 ? 0.6 : intensity === 2 ? 1.4 : 1);
  const growthChance = 0.1 + intensity * 0.05;

  const players: Record<string, Player> = {};
  const responders: string[] = [];
  const attrDeltas: AttrDeltas = { ...(state.attrDeltas ?? {}) };

  for (const [id, p] of Object.entries(state.players)) {
    if (p.clubId !== state.clubId) {
      players[id] = p;
      continue;
    }
    const q: Player = { ...withDevelopmentBase(p, state.developmentRulesVersion === 2 ? 2 : 1) };
    const focused = drill.targets.includes(q.pos);
    const rnd = makeRng(`drill-${drillId}-${roundKey(state)}-${state.clubId}-${id}`);
    if (!q.injuryWeeks) {
      q.condition = Math.max(40, Math.min(100, q.condition - Math.round(fatigue)));
      q.morale = Math.max(25, Math.min(99, q.morale + drill.morale));
      const youthBonus = q.age <= 23 ? 1.6 : q.age <= 28 ? 1 : 0.5;
      const profile = profileFor(q, state);
      const response =
        state.developmentRulesVersion === 2
          ? developmentResponse(effectivePlayer(q, state), intensity, profile)
          : trainingResponse(q, intensity, profile);
      const applied = focused && rnd() < growthChance * youthBonus * Math.min(1.22, response);
      if (applied) {
        const detailedChanged = applyDetailedTrainingGain(
          attrDeltas,
          q,
          drill.attrKeys,
          response,
          state,
        );
        const current = q[drill.attr] as number;
        const cap = q.potential ?? Math.min(99, q.ovr + 6);
        if (state.developmentRulesVersion !== 2 && current < 99 && q.ovr <= cap) {
          if (rnd() < 0.42 * Math.min(1.15, response))
            (q as unknown as Record<string, number>)[drill.attr] = Math.min(99, current + 1);
          if (rnd() < 0.22 * Math.min(1.12, response)) q.ovr = Math.min(cap, q.ovr + 1);
        }
        if (detailedChanged) responders.push(q.name);
      }
    }
    players[id] = developedPlayer(q, { ...state, attrDeltas });
  }

  // O perfil detalhado é cacheado; sincroniza o delta novo para a ficha aberta
  // refletir o treino sem precisar fechar e recarregar a carreira.
  const report: TrainingReport = {
    id: `training-${drillId}-${roundKey(state)}`,
    season: state.season,
    round: state.round,
    drillId,
    load: Math.round(fatigue),
    recovery: Math.round(
      Object.values(players)
        .filter((p) => p.clubId === state.clubId)
        .reduce((sum, p) => sum + p.condition, 0) /
        Math.max(1, Object.values(players).filter((p) => p.clubId === state.clubId).length),
    ),
    responders: responders.slice(0, 8),
  };

  const news: NewsItem = {
    id: `drill-${drillId}-${roundKey(state)}`,
    season: state.season,
    round: state.round,
    kind: "sistema",
    title: `Treino tático: ${drill.label}`,
    body: responders.length
      ? `${responders.slice(0, 3).join(", ")}${responders.length > 3 ? " e outros" : ""} responderam bem ao exercício; a ficha técnica registrou evolução gradual.`
      : "O elenco cumpriu o trabalho, sem evolução destacada nesta semana.",
  };

  return {
    ...state,
    players,
    attrDeltas,
    trainingReports: [report, ...(state.trainingReports ?? [])].slice(0, 24),
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
