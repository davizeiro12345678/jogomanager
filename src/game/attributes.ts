// ============================================================================
//  attributes.ts
//  Ficha detalhada do jogador: atributos por área, físico, personalidade,
//  traços e passagem por clubes. Tudo derivado de forma determinística do id
//  do jogador, então não ocupa espaço no save e nunca muda entre sessões.
// ============================================================================

import { CLUBS } from "./data/leagues";
import { makeRng } from "./rng";
import type { Personality, Player, Position } from "./types";

export interface DetailedAttributes {
  // técnico
  finishing: number;
  dribbling: number;
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
  // físico
  pace: number;
  acceleration: number;
  strength: number;
  stamina: number;
  agility: number;
  jumping: number;
  // mental
  positioning: number;
  composure: number;
  leadership: number;
  workRate: number;
  discipline: number;
  decisions: number;
  // goleiro
  reflexes: number;
  handling: number;
  aerialReach: number;
  distribution: number;
}

export interface AttributeGroup {
  label: string;
  keys: (keyof DetailedAttributes)[];
}

export const ATTR_LABELS: Record<keyof DetailedAttributes, string> = {
  finishing: "Finalização",
  dribbling: "Drible",
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
  pace: "Velocidade",
  acceleration: "Aceleração",
  strength: "Força",
  stamina: "Fôlego",
  agility: "Agilidade",
  jumping: "Impulsão",
  positioning: "Posicionamento",
  composure: "Frieza",
  leadership: "Liderança",
  workRate: "Entrega",
  discipline: "Disciplina",
  decisions: "Decisão",
  reflexes: "Reflexo",
  handling: "Encaixe",
  aerialReach: "Saída aérea",
  distribution: "Reposição",
};

export const FIELD_GROUPS: AttributeGroup[] = [
  { label: "Técnico", keys: ["finishing", "dribbling", "passing", "vision", "crossing", "firstTouch", "longShots", "setPieces"] },
  { label: "Defensivo", keys: ["marking", "tackling", "heading", "interceptions"] },
  { label: "Físico", keys: ["pace", "acceleration", "strength", "stamina", "agility", "jumping"] },
  { label: "Mental", keys: ["positioning", "composure", "leadership", "workRate", "discipline", "decisions"] },
];

export const GK_GROUPS: AttributeGroup[] = [
  { label: "Goleiro", keys: ["reflexes", "handling", "aerialReach", "distribution", "positioning"] },
  { label: "Com os pés", keys: ["passing", "firstTouch", "composure", "decisions"] },
  { label: "Físico", keys: ["agility", "jumping", "strength", "stamina", "pace"] },
  { label: "Mental", keys: ["leadership", "workRate", "discipline", "vision"] },
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

function clamp(v: number) {
  return Math.max(20, Math.min(99, Math.round(v)));
}

function buildAttrs(p: Player, rnd: () => number): DetailedAttributes {
  const j = (base: number, spread = 7) => clamp(base + rnd() * spread - spread / 2);
  const { ovr, pos } = p;
  const pace = p.pace;
  const sho = p.shooting;
  const pas = p.passing;
  const def = p.defending;
  const phy = p.physical;

  const common = {
    pace: j(pace, 4),
    acceleration: j(pace + (pos === "FW" ? 3 : 0)),
    strength: j(phy),
    stamina: j(phy - 2 + (pos === "MF" ? 6 : 0)),
    agility: j(pace - 2 + (pos === "GK" ? 6 : 0)),
    jumping: j(phy - 3 + (pos === "DF" || pos === "GK" ? 6 : 0)),
    positioning: j(ovr - 2),
    composure: j(ovr - 3),
    leadership: j(ovr - 10 + (p.age > 29 ? 8 : 0)),
    workRate: j(ovr - 4),
    discipline: j(72 + rnd() * 20, 6),
    decisions: j(ovr - 3),
  };

  if (pos === "GK") {
    return {
      ...common,
      finishing: j(30, 10),
      dribbling: j(38, 10),
      passing: j(pas),
      vision: j(pas - 6),
      crossing: j(28, 10),
      firstTouch: j(pas - 8),
      longShots: j(34, 12),
      setPieces: j(35, 14),
      marking: j(35, 10),
      tackling: j(32, 10),
      heading: j(40, 12),
      interceptions: j(42, 12),
      reflexes: j(def + 3),
      handling: j(def),
      aerialReach: j(def - 2),
      distribution: j(pas + 2),
    };
  }

  const attack = pos === "FW";
  const mid = pos === "MF";
  const back = pos === "DF";

  return {
    ...common,
    finishing: j(sho + (attack ? 4 : mid ? -6 : -18)),
    dribbling: j((sho + pas) / 2 + (attack ? 4 : mid ? 2 : -12)),
    passing: j(pas),
    vision: j(pas + (mid ? 5 : -3)),
    crossing: j(pas + (back ? 2 : mid ? 3 : -2)),
    firstTouch: j((pas + sho) / 2 + 2),
    longShots: j(sho - (back ? 12 : 2)),
    setPieces: j((pas + sho) / 2 - 4, 16),
    marking: j(def + (back ? 4 : mid ? -4 : -18)),
    tackling: j(def + (back ? 3 : mid ? -2 : -20)),
    heading: j((phy + def) / 2 + (back || attack ? 5 : -4)),
    interceptions: j(def + (mid ? 2 : 0)),
    reflexes: j(30, 8),
    handling: j(28, 8),
    aerialReach: j(30, 8),
    distribution: j(pas - 10),
  };
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
export function profileFor(p: Player): PlayerProfile {
  const hit = cache.get(p.id);
  if (hit) return hit;
  const rnd = makeRng(`profile-${p.id}-${p.name}`);
  const attrs = buildAttrs(p, rnd);
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
  cache.set(p.id, profile);
  return profile;
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
