// ============================================================================
//  sim-rules.ts
//  Regras puras da simulação de partida: xG, impedimento, árbitro, bolas
//  paradas, disputa de pênaltis, IA do treinador e contexto (mando/moral/clima).
//
//  Tudo aqui é função pura e determinística (recebe `rnd`) para poder ser
//  testada sem instanciar o motor. O `MatchSim` chama estes solucionadores e
//  cuida de animação, física da bola e eventos.
// ============================================================================

import type { Side } from "./sim";

/* -------------------------------------------------------------------------- */
/*  Medidas do campo (fonte única: `sim.ts` reexporta para compatibilidade)   */
/* -------------------------------------------------------------------------- */

export const FIELD_X = 52.5;
export const FIELD_Z = 34;
export const GOAL_Z = 3.66;
export const GOAL_H = 2.44;
/** distância da marca do pênalti até a linha de fundo */
export const PENALTY_DIST = 11;
/** profundidade e meia-largura da grande área */
export const BOX_DEPTH = 16.5;
export const BOX_HALF = 20.16;

/* -------------------------------------------------------------------------- */
/*  xG — gols esperados por finalização                                        */
/* -------------------------------------------------------------------------- */

export interface ShotChance {
  /** distância até o centro do gol, em metros */
  dist: number;
  /** deslocamento lateral do chute (|z|), em metros */
  wide: number;
  bodyPart: "foot" | "head";
  /** distância do marcador mais próximo no momento do chute */
  pressDist: number;
  /** recebeu em velocidade (lançamento em profundidade) */
  onRun: boolean;
}

/**
 * Probabilidade de gol 0.01..0.9. Decai com a distância, pune ângulo fechado
 * e marcador em cima, premia cabeçada perto e bola recebida em velocidade.
 */
export function xgForShot(c: ShotChance): number {
  const base = 0.46 * Math.exp(-c.dist / 12.5);
  const angle = 1 - Math.min(0.55, (c.wide / (FIELD_Z * 0.9)) * 0.7);
  const press = c.pressDist < 1.5 ? 0.5 : c.pressDist < 3 ? 0.75 : c.pressDist < 5 ? 0.9 : 1;
  const body = c.bodyPart === "head" ? (c.dist < 12 ? 0.62 : 0.34) : 1;
  const run = c.onRun ? 1.22 : 1;
  return Math.max(0.01, Math.min(0.9, base * angle * press * body * run));
}

/** xG de uma falta direta (barreira no caminho derruba muito o valor). */
export function xgForDirectFK(dist: number, central: boolean): number {
  const base = 0.16 * Math.exp(-Math.max(0, dist - 16) / 14);
  return Math.max(0.02, Math.min(0.18, central ? base : base * 0.6));
}

/** pênalti em jogo corrido; na disputa cai um pouco pela pressão */
export const XG_PENALTY = 0.76;
export const XG_SHOOTOUT = 0.72;

/* -------------------------------------------------------------------------- */
/*  Impedimento                                                                */
/* --------------------------------------------------------------------------- */

export interface OffsideLineInput {
  x: number;
  side: Side;
  pos: string;
  sentOff: boolean;
}

/**
 * Linha do penúltimo adversário (goleiro conta). Devolve a coordenada x da
 * linha no sistema absoluto; quem ataca compara com o próprio `dir`.
 */
export function defensiveLineX(players: OffsideLineInput[], attacking: Side): number {
  const foes = players
    .filter((p) => p.side !== attacking && !p.sentOff)
    .map((p) => p.x)
    .sort((a, b) => (attacking === "home" ? a - b : b - a));
  if (foes.length < 2) return attacking === "home" ? -FIELD_X : FIELD_X;
  return foes[1]!;
}

/**
 * Posição irregular: além da linha (com 0,4 m de benefício da dúvida) E no
 * campo de ataque. O passe para trás nunca é impedimento (verificado fora).
 */
export function isOffside(x: number, lineX: number, dir: 1 | -1): boolean {
  const past = dir === 1 ? x > lineX + 0.4 : x < lineX - 0.4;
  const attackingHalf = dir === 1 ? x > 0 : x < 0;
  return past && attackingHalf;
}

/* -------------------------------------------------------------------------- */
/*  Arbitragem                                                                 */
/* --------------------------------------------------------------------------- */

export interface RefProfile {
  name: string;
  /** 0 = deixa jogar, 1 = distribui cartão */
  strict: number;
}

export const REFEREES: RefProfile[] = [
  { name: "C. Duarte", strict: 0.25 },
  { name: "R. Sampaio", strict: 0.45 },
  { name: "M. Tavares", strict: 0.6 },
  { name: "J. Peixoto", strict: 0.8 },
];

export function refFor(rnd: () => number): RefProfile {
  return REFEREES[Math.floor(rnd() * REFEREES.length)]!;
}

export interface FoulInput {
  slide: boolean;
  /** mata contra-ataque claro */
  tactical: boolean;
  /** nega chance clara de gol */
  goalDenied: boolean;
  /** faltas do jogador na partida (reincidência pesa) */
  rapSheet: number;
  ref: RefProfile;
  rnd: () => number;
}

/** Decisão do árbitro: nada, amarelo ou vermelho direto. */
export function cardForFoul(f: FoulInput): "none" | "yellow" | "red" {
  if (f.goalDenied && (f.slide || f.rnd() < 0.5)) return "red";
  let yellowP = 0.1 + f.ref.strict * 0.22 + (f.slide ? 0.16 : 0) + (f.tactical ? 0.2 : 0);
  yellowP += Math.min(0.2, f.rapSheet * 0.06);
  const redP = f.slide ? 0.008 + f.ref.strict * 0.014 : 0.003;
  const roll = f.rnd();
  if (roll < redP) return "red";
  return roll < redP + yellowP ? "yellow" : "none";
}

/* -------------------------------------------------------------------------- */
/*  Bolas paradas                                                              */
/* --------------------------------------------------------------------------- */

export interface DirectFKOutcome {
  result: "goal" | "saved" | "wall" | "off";
  targetZ: number;
  targetH: number;
  xg: number;
}

/** Falta direta: barreira desvia parte, goleiro cobre o canto. */
export function solveDirectFK(o: {
  dist: number;
  central: boolean;
  taker: number;
  wall: number;
  gk: number;
  rnd: () => number;
}): DirectFKOutcome {
  const xg = xgForDirectFK(o.dist, o.central);
  const skill = o.taker / 100;
  const wallBlock = Math.min(0.42, 0.1 + o.wall * 0.07) * (o.dist < 22 ? 1 : 0.55);
  const goalP = xg * (0.7 + skill * 0.6) * (1 - wallBlock);
  const saveP = (0.3 + (o.gk / 100) * 0.35) * (1 - wallBlock - goalP);
  const roll = o.rnd();
  const result: DirectFKOutcome["result"] =
    roll < goalP ? "goal" : roll < goalP + wallBlock ? "wall" : roll < goalP + wallBlock + saveP ? "saved" : "off";
  const inside = (o.rnd() - 0.5) * GOAL_Z * 1.5;
  const outside = Math.sign(o.rnd() - 0.5 || 1) * (GOAL_Z + 1 + o.rnd() * GOAL_Z * 1.5);
  return {
    result,
    targetZ: result === "off" ? outside : inside,
    targetH: result === "off" && o.rnd() < 0.4 ? 3 + o.rnd() * 1.6 : 0.3 + o.rnd() * 1.7,
    xg,
  };
}

export interface PenaltyOutcome {
  scored: boolean;
  /** canto do batedor e do goleiro (-1 esquerda, 0 meio, 1 direita) */
  takerSide: -1 | 0 | 1;
  gkSide: -1 | 0 | 1;
  /** isolou (nem no gol foi) */
  skied: boolean;
}

/** Pênalti: batedor escolhe o canto, goleiro tenta ler; pressão pesa. */
export function solvePenalty(o: {
  taker: number;
  gk: number;
  /** 0 jogo corrido .. 1 última cobrança da disputa */
  pressure: number;
  rnd: () => number;
}): PenaltyOutcome {
  const sides = [-1, 0, 1] as const;
  const takerSide = sides[Math.floor(o.rnd() * 3)]!;
  // goleiro lê a passada: quanto melhor, mais acerta o canto
  const readP = 0.28 + (o.gk / 100) * 0.25 - (o.taker / 100) * 0.1;
  const gkSide = o.rnd() < readP ? takerSide : sides[Math.floor(o.rnd() * 3)]!;
  const skyP = 0.04 + o.pressure * 0.05 + Math.max(0, (70 - o.taker) / 100) * 0.1;
  if (o.rnd() < skyP) return { scored: false, takerSide, gkSide, skied: true };
  if (gkSide === takerSide) {
    const saveP = 0.32 + (o.gk / 100) * 0.2 - (o.taker / 100) * 0.12;
    if (o.rnd() < saveP) return { scored: false, takerSide, gkSide, skied: false };
  }
  return { scored: true, takerSide, gkSide, skied: false };
}

/** Disputa aérea do escanteio: força de cada lado + goleiro que sai do gol. */
export function solveCornerDuel(o: {
  attack: number;
  defense: number;
  gkComes: boolean;
  gk: number;
  rnd: () => number;
}): { winner: "attack" | "defense" | "gk"; headerXg: number } {
  const gkClaim = o.gkComes ? 0.12 + (o.gk / 100) * 0.14 : 0.02;
  const attShare = o.attack / Math.max(1, o.attack + o.defense);
  const roll = o.rnd();
  if (roll < gkClaim) return { winner: "gk", headerXg: 0 };
  if (roll < gkClaim + (1 - gkClaim) * attShare * 0.62) {
    return { winner: "attack", headerXg: 0.07 + o.rnd() * 0.09 };
  }
  return { winner: "defense", headerXg: 0 };
}

/* -------------------------------------------------------------------------- */
/*  Disputa de pênaltis                                                        */
/* --------------------------------------------------------------------------- */

export interface ShootoutKick {
  side: Side;
  name: string;
  scored: boolean;
}

export function shootoutScore(kicks: ShootoutKick[]): { home: number; away: number } {
  let home = 0;
  let away = 0;
  for (const k of kicks) {
    if (k.scored) {
      if (k.side === "home") home++;
      else away++;
    }
  }
  return { home, away };
}

/**
 * Vencedor da disputa (ou null se segue). Séries de 5 com morte súbita:
 * encerra cedo quando um lado não alcança mais.
 */
export function shootoutWinner(kicks: ShootoutKick[]): Side | null {
  const hk = kicks.filter((k) => k.side === "home");
  const ak = kicks.filter((k) => k.side === "away");
  const hs = hk.filter((k) => k.scored).length;
  const as = ak.filter((k) => k.scored).length;
  // mesma quantidade de cobranças: decide na 5ª ou na morte súbita
  if (hk.length === ak.length && hk.length >= 5 && hs !== as) return hs > as ? "home" : "away";
  if (hk.length <= 5 && ak.length <= 5) {
    const hr = 5 - hk.length;
    const ar = 5 - ak.length;
    if (hs > as + ar) return "home";
    if (as > hs + hr) return "away";
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/*  IA do treinador                                                            */
/* --------------------------------------------------------------------------- */

export interface AiLineupInput {
  id: string;
  pid: string;
  pos: string;
  stamina: number;
  injuryWeeks: number;
  sentOff: boolean;
  yellows: number;
  ovr: number;
}

export interface AiBenchInput {
  id: string;
  pos: string;
  ovr: number;
  condition: number;
  injuryWeeks: number;
  suspended: boolean;
}

function posGroup(pos: string): string {
  const p = pos.toUpperCase();
  if (p === "GK") return "GK";
  if (p.startsWith("D") || p === "CB" || p === "LB" || p === "RB" || p === "WB") return "DF";
  if (p.startsWith("F") || p === "ST" || p === "CF" || p === "WG" || p === "LW" || p === "RW") return "FW";
  return "MF";
}

/**
 * Escolha da IA para substituir. Prioridade: lesão > fadiga extrema >
 * tática (perdendo põe atacante, ganhando fecha). Devolve null se está bem.
 */
export function aiSubPick(
  lineup: AiLineupInput[],
  bench: AiBenchInput[],
  goalDiff: number,
  minute: number,
  subsUsed: number,
  rnd: () => number,
): { outPid: string; inId: string; reason: string } | null {
  if (subsUsed >= 5 || minute < 50) return null;
  const avail = bench.filter((b) => b.injuryWeeks === 0 && !b.suspended && b.condition > 40);
  if (!avail.length) return null;
  const field = lineup.filter((p) => !p.sentOff);

  // 1) lesão: tira na hora, mesmo setor
  const hurt = field.find((p) => p.injuryWeeks > 0);
  if (hurt) {
    const repo = avail
      .filter((b) => posGroup(b.pos) === posGroup(hurt.pos))
      .sort((a, b) => b.ovr - a.ovr)[0];
    if (repo) return { outPid: hurt.pid, inId: repo.id, reason: "lesão" };
  }
  // 2) fadiga extrema depois dos 60'
  if (minute >= 60) {
    const dead = field
      .filter((p) => p.pos !== "GK" && p.stamina < 42)
      .sort((a, b) => a.stamina - b.stamina)[0];
    if (dead && rnd() < 0.75) {
      const repo = avail
        .filter((b) => posGroup(b.pos) === posGroup(dead.pos))
        .sort((a, b) => b.ovr - a.ovr)[0];
      if (repo) return { outPid: dead.pid, inId: repo.id, reason: "fadiga" };
    }
  }
  // 3) tática: perdendo põe atacante, ganhando no fim fecha o time
  if (minute >= 63 && rnd() < 0.6) {
    if (goalDiff < 0) {
      const out = field
        .filter((p) => posGroup(p.pos) === "DF" || (posGroup(p.pos) === "MF" && p.yellows > 0))
        .sort((a, b) => a.ovr - b.ovr)[0];
      const fw = avail.filter((b) => posGroup(b.pos) === "FW").sort((a, b) => b.ovr - a.ovr)[0];
      if (out && fw) return { outPid: out.pid, inId: fw.id, reason: "tática" };
    } else if (goalDiff > 0 && minute >= 74) {
      const out = field.filter((p) => posGroup(p.pos) === "FW").sort((a, b) => a.ovr - b.ovr)[0];
      const df = avail
        .filter((b) => posGroup(b.pos) === "DF" || posGroup(b.pos) === "MF")
        .sort((a, b) => b.ovr - a.ovr)[0];
      if (out && df) return { outPid: out.pid, inId: df.id, reason: "tática" };
    }
  }
  return null;
}

/** Ajuste de postura da IA ao longo do jogo (chamado a cada ~10'). */
export function aiMentalityTweak(
  goalDiff: number,
  minute: number,
  sentOffs: number,
): { mentality: number; pressing: number } | null {
  if (minute < 55) return null;
  if (sentOffs > 0) return { mentality: -1, pressing: -1 };
  if (goalDiff < 0 && minute >= 60) return { mentality: 1, pressing: 1 };
  if (goalDiff > 0 && minute >= 70) return { mentality: -1, pressing: 0 };
  if (goalDiff === 0 && minute >= 80) return { mentality: 1, pressing: 0 };
  return null;
}

/* -------------------------------------------------------------------------- */
/*  Contexto: mando, moral e clima                                             */
/* --------------------------------------------------------------------------- */

export type WeatherKind = "clear" | "rain" | "heat";

/** bônus de duelo: mando + moral (multiplicador ~0.94..1.08) */
export function duelMult(o: { home: boolean; morale: number }): number {
  return (o.home ? 1.03 : 1) * (0.94 + Math.max(0, Math.min(100, o.morale)) / 1000);
}

/** chuva derruba o controle e aumenta erro de passe, faltas e desgaste */
export function controlFailAdd(weather: WeatherKind): number {
  return weather === "rain" ? 0.09 : 0;
}

export function passErrMult(weather: WeatherKind): number {
  return weather === "rain" ? 1.3 : 1;
}

export function staminaDrainMult(weather: WeatherKind): number {
  if (weather === "heat") return 1.22;
  if (weather === "rain") return 1.08;
  return 1;
}

export function foulMult(weather: WeatherKind): number {
  return weather === "rain" ? 1.2 : 1;
}

/* -------------------------------------------------------------------------- */
/*  Relógio da partida                                                         */
/* --------------------------------------------------------------------------- */

export type MatchPhase = "first" | "half" | "second" | "et1" | "etBreak" | "et2" | "shootout" | "done";

/** texto do relógio: 45+2', 90+3', 105', 120', PEN */
export function clockText(
  phase: MatchPhase,
  time: number,
  added1: number,
  added2: number,
  etAdded: number,
): string {
  const t = Math.floor(time / 60);
  if (phase === "shootout" || phase === "done") {
    if (phase === "shootout") return "PEN";
    const base = etAdded > 0 || t > 95 ? 120 : 90;
    return `${base}'`;
  }
  if (phase === "first" || phase === "half") {
    if (t <= 45) return `${t}'`;
    return `45+${Math.min(t - 45, added1)}'`;
  }
  if (phase === "second") {
    if (t <= 90) return `${t}'`;
    return `90+${Math.min(t - 90, added2)}'`;
  }
  // tempo corrido contínuo: o relógio só formata (acréscimos incluídos)
  if (phase === "et1") return t <= 105 ? `${t}'` : `105+${Math.min(t - 105, etAdded)}'`;
  return t <= 120 ? `${t}'` : `120+${Math.min(t - 120, etAdded)}'`;
}

/* -------------------------------------------------------------------------- */
/*  Trave                                                                      */
/* --------------------------------------------------------------------------- */

/** Altura do travessão (as traves ficam em |z| = GOAL_Z). */
export const GOAL_BAR_H = 2.44;

export type WoodworkHit = "post" | "bar" | null;

/**
 * A bola raspou a trave? Testado no ponto em que a trajetória cruza o plano
 * da meta. Margem generosa (poste 0.075 + bola 0.12 + folga de jogo) para a
 * trave aparecer com a frequência do futebol real (~1 a cada 3-4 jogos).
 */
export function woodworkAt(crossingZ: number, crossingH: number): WoodworkHit {
  const az = Math.abs(crossingZ);
  const nearPost = az >= GOAL_Z - 0.38 && az <= GOAL_Z + 0.55 && crossingH < GOAL_BAR_H + 0.45;
  const nearBar =
    Math.abs(crossingH - GOAL_BAR_H) <= 0.35 && az <= GOAL_Z + 0.55 && crossingH > 0.4;
  if (nearPost && nearBar) {
    // quina: decide pelo mais próximo
    const dPost = Math.abs(az - GOAL_Z);
    const dBar = Math.abs(crossingH - GOAL_BAR_H);
    return dPost <= dBar ? "post" : "bar";
  }
  if (nearPost) return "post";
  if (nearBar) return "bar";
  return null;
}
