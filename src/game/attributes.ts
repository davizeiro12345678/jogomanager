// ============================================================================
//  attributes.ts
//  Ficha detalhada do jogador: atributos por área, físico, personalidade,
//  traços e passagem por clubes. Tudo derivado de forma determinística do id
//  do jogador, então não ocupa espaço no save e nunca muda entre sessões.
// ============================================================================

import { CLUBS } from "./data/leagues";
import { makeRng } from "./rng";
import { buildAttrs } from "./player-physique";
import type { Personality, Player, Position } from "./types";
import {
  effectivePlayer,
  limitedDevelopmentDelta,
  type AttributeSource,
} from "./player-development";
import type { CareerState } from "./types";
import { normalizedPlayerRatings, ratingValue } from "./player-rating-inputs";

export interface DetailedAttributes {
  // técnico
  finishing: number;
  dribbling: number;
  technique: number;
  ballControl: number;
  flair: number;
  passing: number;
  vision: number;
  crossing: number;
  firstTouch: number;
  longShots: number;
  setPieces: number;
  // defensivo
  marking: number;
  tackling: number;
  heading: number;
  interceptions: number;
  anticipation: number;
  concentration: number;
  bravery: number;
  aggression: number;
  // físico
  pace: number;
  acceleration: number;
  strength: number;
  stamina: number;
  agility: number;
  jumping: number;
  balance: number;
  naturalFitness: number;
  injuryResistance: number;
  // mental
  positioning: number;
  composure: number;
  leadership: number;
  workRate: number;
  discipline: number;
  decisions: number;
  offBall: number;
  teamwork: number;
  determination: number;
  consistency: number;
  // goleiro
  reflexes: number;
  handling: number;
  aerialReach: number;
  distribution: number;
  oneOnOnes: number;
  commandOfArea: number;
  rushingOut: number;
  communication: number;
}

export interface AttributeGroup {
  label: string;
  keys: (keyof DetailedAttributes)[];
}

export const ATTR_LABELS: Record<keyof DetailedAttributes, string> = {
  finishing: "Finalização",
  dribbling: "Drible",
  technique: "Técnica",
  ballControl: "Controle de bola",
  flair: "Criatividade",
  passing: "Passe",
  vision: "Visão de jogo",
  crossing: "Cruzamento",
  firstTouch: "Domínio",
  longShots: "Chute de longe",
  setPieces: "Bola parada",
  marking: "Marcação",
  tackling: "Desarme",
  heading: "Cabeceio",
  interceptions: "Interceptação",
  anticipation: "Antecipação",
  concentration: "Concentração",
  bravery: "Coragem",
  aggression: "Combatividade",
  pace: "Velocidade",
  acceleration: "Aceleração",
  strength: "Força",
  stamina: "Fôlego",
  agility: "Agilidade",
  jumping: "Impulsão",
  balance: "Equilíbrio",
  naturalFitness: "Condição natural",
  injuryResistance: "Resistência a lesões",
  positioning: "Posicionamento",
  composure: "Frieza",
  leadership: "Liderança",
  workRate: "Entrega",
  discipline: "Disciplina",
  decisions: "Decisão",
  offBall: "Movimentação sem bola",
  teamwork: "Trabalho em equipe",
  determination: "Determinação",
  consistency: "Regularidade",
  reflexes: "Reflexo",
  handling: "Encaixe",
  aerialReach: "Saída aérea",
  distribution: "Reposição",
  oneOnOnes: "Um contra um",
  commandOfArea: "Comando da área",
  rushingOut: "Saída do gol",
  communication: "Comunicação",
};

export const FIELD_GROUPS: AttributeGroup[] = [
  {
    label: "Técnico",
    keys: [
      "finishing",
      "dribbling",
      "technique",
      "ballControl",
      "flair",
      "passing",
      "vision",
      "crossing",
      "firstTouch",
      "longShots",
      "setPieces",
    ],
  },
  {
    label: "Defensivo",
    keys: [
      "marking",
      "tackling",
      "heading",
      "interceptions",
      "anticipation",
      "concentration",
      "bravery",
      "aggression",
    ],
  },
  {
    label: "Físico",
    keys: [
      "pace",
      "acceleration",
      "strength",
      "stamina",
      "agility",
      "jumping",
      "balance",
      "naturalFitness",
      "injuryResistance",
    ],
  },
  {
    label: "Mental",
    keys: [
      "positioning",
      "composure",
      "leadership",
      "workRate",
      "discipline",
      "decisions",
      "offBall",
      "teamwork",
      "determination",
      "consistency",
    ],
  },
];

export const GK_GROUPS: AttributeGroup[] = [
  {
    label: "Goleiro",
    keys: [
      "reflexes",
      "handling",
      "aerialReach",
      "distribution",
      "oneOnOnes",
      "commandOfArea",
      "rushingOut",
      "communication",
      "positioning",
    ],
  },
  { label: "Com os pés", keys: ["passing", "firstTouch", "composure", "decisions"] },
  {
    label: "Físico",
    keys: ["agility", "jumping", "strength", "stamina", "pace", "balance", "naturalFitness"],
  },
  {
    label: "Mental",
    keys: ["leadership", "workRate", "discipline", "vision", "concentration", "consistency"],
  },
];

export type Foot = "destro" | "canhoto" | "ambidestro";

export interface ClubSpell {
  clubId: string;
  clubName: string;
  from: number;
  to: number;
  apps: number;
  goals: number;
}

export const TRAITS = [
  "Cobra faltas",
  "Corta para dentro",
  "Chega na área",
  "Passe em profundidade",
  "Marca por antecipação",
  "Segura a bola",
  "Explode no contra-ataque",
  "Bom no mano a mano",
  "Cabeceador",
  "Líder de vestiário",
  "Motor do meio-campo",
  "Finalizador frio",
] as const;

export type Trait = (typeof TRAITS)[number];

export const PERSONALITIES: Personality[] = [
  "líder",
  "profissional",
  "ambicioso",
  "temperamental",
  "caseiro",
  "determinado",
];

export const PERSONALITY_DESC: Record<Personality, string> = {
  líder: "Puxa o grupo, levanta a moral dos companheiros em fases ruins.",
  profissional: "Treina sempre no limite. Evolui de forma constante e raramente reclama.",
  ambicioso: "Quer títulos e vitrine. Fica insatisfeito se o clube não briga em cima.",
  temperamental: "Explosivo. Rende muito bem ou muito mal, e pega mais cartões.",
  caseiro: "Ligado ao clube e à cidade. Difícil de convencer a sair.",
  determinado: "Reage bem à pressão e cresce em jogo decisivo.",
};

/** Efeito da personalidade em moral, evolução e disciplina. */
export function personalityEffect(p: Personality) {
  switch (p) {
    case "líder":
      return { morale: 6, growth: 0, discipline: 8, loyalty: 6 };
    case "profissional":
      return { morale: 3, growth: 6, discipline: 12, loyalty: 4 };
    case "ambicioso":
      return { morale: -2, growth: 5, discipline: 0, loyalty: -8 };
    case "temperamental":
      return { morale: -5, growth: 2, discipline: -14, loyalty: -4 };
    case "caseiro":
      return { morale: 4, growth: -2, discipline: 5, loyalty: 14 };
    default:
      return { morale: 2, growth: 4, discipline: 4, loyalty: 2 };
  }
}

export interface PlayerProfile {
  attrs: DetailedAttributes;
  foot: Foot;
  /** cm */
  height: number;
  /** kg */
  weight: number;
  traits: Trait[];
  personality: Personality;
  spells: ClubSpell[];
  /** afinidade com o treinador 0..100 */
  rapport: number;
}

const cache = new Map<string, PlayerProfile>();

/* -------------------------------------------------------------------------- */
/*  Evolução persistente                                                      */
/*  A base dos 46 atributos continua determinística; o que a carreira guarda  */
/*  é apenas a diferença acumulada (treino, idade, temporadas jogadas).       */
/* -------------------------------------------------------------------------- */

export type AttrDelta = Partial<Record<keyof DetailedAttributes, number>>;
export type AttrDeltas = Record<string, AttrDelta>;

let deltas: AttrDeltas = {};

/** Liga a ficha dos jogadores à evolução guardada na carreira atual. */
export function setAttrDeltas(next: AttrDeltas | undefined) {
  deltas = next ?? {};
  cache.clear();
}

export function getAttrDeltas(): AttrDeltas {
  return deltas;
}

const ALL_KEYS = Object.keys(ATTR_LABELS) as (keyof DetailedAttributes)[];

/**
 * Uma temporada de evolução: jovens crescem até o potencial, veteranos perdem
 * físico e ganham cabeça. O sorteio é determinístico por jogador e temporada.
 */
export function evolveSeason(
  players: Player[],
  season: number,
  current: AttrDeltas,
  preciseDeltas = false,
): AttrDeltas {
  const out: AttrDeltas = { ...current };
  for (const p of players) {
    const rnd = makeRng(`evo-${p.id}-${season}`);
    // Ficha já evoluída: a base "limpa" é ela menos o que já foi acumulado.
    const evolved = profileFor(p, { attrDeltas: current }).attrs;
    const delta: AttrDelta = { ...(current[p.id] ?? {}) };
    const potential = Math.max(p.ovr, p.potential ?? p.ovr);
    const room = Math.max(0, potential - p.ovr);
    const young = p.age <= 23 ? 1 : p.age <= 28 ? 0.45 : 0;
    const old = p.age >= 31 ? (p.age - 30) * 0.6 : 0;
    for (const k of ALL_KEYS) {
      const physical =
        k === "pace" ||
        k === "acceleration" ||
        k === "stamina" ||
        k === "agility" ||
        k === "jumping" ||
        k === "balance" ||
        k === "naturalFitness" ||
        k === "injuryResistance";
      const mental =
        k === "composure" ||
        k === "leadership" ||
        k === "decisions" ||
        k === "positioning" ||
        k === "anticipation" ||
        k === "concentration" ||
        k === "teamwork" ||
        k === "determination" ||
        k === "consistency" ||
        k === "communication";
      let move = young * (0.6 + room * 0.1) * (rnd() * 1.6 - 0.2);
      if (physical) move -= old * (0.5 + rnd() * 0.8);
      if (mental) move += (p.age >= 29 ? 0.5 : 0) + rnd() * 0.6;
      const raw = (delta[k] ?? 0) + move;
      // O resultado final nunca sai da faixa 20..99 do atributo.
      const base = evolved[k] - (current[p.id]?.[k] ?? 0);
      const clamped = Math.max(20 - base, Math.min(99 - base, raw));
      const precision = preciseDeltas ? 1e6 : 10;
      const rounded = Math.round(clamped * precision) / precision;
      if (rounded !== 0) delta[k] = rounded;
      else delete delta[k];
    }
    if (Object.keys(delta).length) out[p.id] = delta;
    else delete out[p.id];
  }
  return out;
}

/** Ganho de treino aplicado fora do fim de temporada (impulsos, academia). */
export function trainingGain(
  playerId: string,
  keys: (keyof DetailedAttributes)[],
  amount: number,
): AttrDeltas {
  const delta: AttrDelta = { ...(deltas[playerId] ?? {}) };
  for (const k of keys) delta[k] = Math.round(((delta[k] ?? 0) + amount) * 10) / 10;
  return { ...deltas, [playerId]: delta };
}

function clamp(v: number) {
  return Math.max(20, Math.min(99, Math.round(v)));
}

function pickTraits(p: Player, a: DetailedAttributes, rnd: () => number): Trait[] {
  const out: Trait[] = [];
  const push = (t: Trait) => {
    if (!out.includes(t) && out.length < 3) out.push(t);
  };
  if (a.setPieces >= 78) push("Cobra faltas");
  if (a.finishing >= 80) push("Finalizador frio");
  if (a.heading >= 80) push("Cabeceador");
  if (a.leadership >= 78) push("Líder de vestiário");
  if (a.vision >= 80) push("Passe em profundidade");
  if (a.acceleration >= 84) push("Explode no contra-ataque");
  if (a.marking >= 80) push("Marca por antecipação");
  if (a.workRate >= 82 && p.pos === "MF") push("Motor do meio-campo");
  while (out.length < 2) push(TRAITS[Math.floor(rnd() * TRAITS.length)]!);
  return out;
}

function buildSpells(p: Player, rnd: () => number): ClubSpell[] {
  const ids = Object.keys(CLUBS);
  const startAge = 17 + Math.floor(rnd() * 3);
  const years = Math.max(0, p.age - startAge);
  const spells: ClubSpell[] = [];
  let year = 2026 - years;
  let guard = 0;
  while (year < 2026 && guard < 6) {
    const span = Math.min(2026 - year, 1 + Math.floor(rnd() * 4));
    const previous = guard === 0 || rnd() < 0.75;
    const id = previous ? ids[Math.floor(rnd() * ids.length)]! : p.clubId;
    const club = CLUBS[id];
    const apps = Math.round(span * (14 + rnd() * 22));
    const rate = p.pos === "FW" ? 0.38 : p.pos === "MF" ? 0.16 : p.pos === "DF" ? 0.05 : 0.002;
    spells.push({
      clubId: id,
      clubName: club?.name ?? "Clube amador",
      from: year,
      to: year + span,
      apps,
      goals: Math.round(apps * rate * (0.6 + rnd() * 0.9)),
    });
    year += span;
    guard++;
  }
  const current = CLUBS[p.clubId];
  spells.push({
    clubId: p.clubId,
    clubName: current?.name ?? "Clube atual",
    from: 2026,
    to: 2026 + (p.contractYears ?? 2),
    apps: p.apps,
    goals: p.goals,
  });
  return spells;
}

/** Ficha completa do jogador — determinística e em cache. */
function baseProfileFor(p: Player, stableIdentity = false): PlayerProfile {
  p = normalizedPlayerRatings(p);
  // Imported/custom records retain their existing deterministic identity when frozen.
  const seedPlayer = stableIdentity ? { ...p, name: "" } : p;
  const cacheKey = JSON.stringify([
    p.id,
    p.name,
    p.pos,
    p.age,
    p.clubId,
    p.personality,
    p.ovr,
    p.pace,
    p.shooting,
    p.passing,
    p.defending,
    p.physical,
    stableIdentity,
  ]);
  const hit = cache.get(cacheKey);
  if (hit) return hit;
  const rnd = makeRng(stableIdentity ? `profile-id-${p.id}` : `profile-${p.id}-${p.name}`);
  const attrs = buildAttrs(seedPlayer, rnd);
  const tall = p.pos === "GK" ? 8 : p.pos === "DF" ? 4 : 0;
  const profile: PlayerProfile = {
    attrs,
    foot: rnd() < 0.72 ? "destro" : rnd() < 0.9 ? "canhoto" : "ambidestro",
    height: Math.round(171 + tall + rnd() * 16),
    weight: Math.round(65 + tall * 0.9 + rnd() * 18),
    traits: pickTraits(p, attrs, rnd),
    personality: p.personality ?? PERSONALITIES[Math.floor(rnd() * PERSONALITIES.length)]!,
    spells: buildSpells(p, rnd),
    rapport: Math.round(45 + rnd() * 45),
  };
  if (cache.size > 2048) cache.clear();
  cache.set(cacheKey, profile);
  return profile;
}

/** Freeze an initial identity once. Legacy saves keep their existing main ratings and profile. */
export function withDevelopmentBase(p: Player, rulesVersion: 1 | 2): Player {
  const base = p.developmentBase;
  if (
    base &&
    (base.rulesVersion === 1 || base.rulesVersion === 2) &&
    Number.isFinite(base.ovr) &&
    base.ovr >= 20 &&
    base.ovr <= 99 &&
    base.core &&
    ["pace", "shooting", "passing", "defending", "physical"].every((key) =>
      Number.isFinite(base.core[key as keyof typeof base.core]),
    ) &&
    base.profile?.attrs &&
    ALL_KEYS.every(
      (key) =>
        Number.isFinite(base.profile.attrs[key]) &&
        base.profile.attrs[key] >= 20 &&
        base.profile.attrs[key] <= 99,
    ) &&
    Array.isArray(base.profile.traits) &&
    Array.isArray(base.profile.spells) &&
    Number.isFinite(base.profile.height) &&
    Number.isFinite(base.profile.weight)
  )
    return p;
  const stable = rulesVersion === 2 && p.rosterSource !== "imported" && p.rosterSource !== "custom";
  const generated = baseProfileFor(p, stable);
  const attrs = { ...generated.attrs };
  // Explicit imported/custom technical data takes precedence over generation.
  for (const key of ALL_KEYS)
    if (Number.isFinite(p.detailedAttributes?.[key]))
      attrs[key] = ratingValue(p.detailedAttributes![key]);
  return {
    ...p,
    developmentBase: {
      rulesVersion,
      ovr: p.ovr,
      core: {
        pace: p.pace,
        shooting: p.shooting,
        passing: p.passing,
        defending: p.defending,
        physical: p.physical,
      },
      profile: {
        ...generated,
        attrs,
        traits: [...generated.traits],
        spells: generated.spells.map((spell) => ({ ...spell })),
      },
    },
  };
}

/** Explicit source prevents one opened career from changing another career's players. */
export function profileFor(p: Player, source?: AttributeSource): PlayerProfile {
  const initial = p.developmentBase?.profile ?? baseProfileFor(p);
  const attrs = { ...initial.attrs };
  const delta = source ? source.attrDeltas?.[p.id] : p.developmentDelta;
  for (const key of ALL_KEYS) {
    const move = delta?.[key];
    if (typeof move === "number" && Number.isFinite(move))
      attrs[key] =
        p.developmentBase?.rulesVersion === 2
          ? ratingValue(attrs[key] + move)
          : clamp(attrs[key] + move);
    else if (!p.developmentBase && Number.isFinite(p.detailedAttributes?.[key]))
      attrs[key] = ratingValue(p.detailedAttributes![key]);
  }
  return {
    ...initial,
    attrs,
    personality: p.personality ?? initial.personality,
    traits: [...initial.traits],
    spells: initial.spells.map((spell) => ({ ...spell })),
  };
}

/** Match and UI projection. The saved base and source deltas remain authoritative. */
export function developedPlayer(p: Player, source?: AttributeSource): Player {
  const effective = effectivePlayer(p, source);
  return {
    ...effective,
    developmentDelta: {
      ...(source ? (source.attrDeltas?.[p.id] ?? {}) : (p.developmentDelta ?? {})),
    },
    detailedAttributes: profileFor(p, source).attrs,
  };
}

export function evolveSeasonV2(players: Player[], state: CareerState): AttrDeltas {
  const closingPlayers = players.map((p) => ({ ...p, age: state.players[p.id]?.age ?? p.age }));
  const proposed = evolveSeason(
    closingPlayers.map((p) => effectivePlayer(p, state)),
    state.season,
    state.attrDeltas ?? {},
    true,
  );
  const out: AttrDeltas = { ...(state.attrDeltas ?? {}) };
  for (const p of closingPlayers) {
    const changes: AttrDelta = {};
    for (const key of ALL_KEYS)
      changes[key] = (proposed[p.id]?.[key] ?? 0) - (state.attrDeltas?.[p.id]?.[key] ?? 0);
    out[p.id] = limitedDevelopmentDelta(p, state, changes);
  }
  return out;
}

export function groupsFor(pos: Position): AttributeGroup[] {
  return pos === "GK" ? GK_GROUPS : FIELD_GROUPS;
}

/** Cor semântica de um atributo pela faixa de valor. */
export function attrTone(v: number) {
  if (v >= 85) return "text-emerald-400";
  if (v >= 74) return "text-primary";
  if (v >= 62) return "text-foreground";
  if (v >= 50) return "text-amber-400";
  return "text-destructive";
}
