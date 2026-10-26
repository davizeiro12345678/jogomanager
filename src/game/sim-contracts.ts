/** Match runtime contracts. Rendering and replays can import these without
 * pulling the full deterministic MatchSim state machine into their bundle. */
import type { PlayerAction } from "./animation";
import type { Player, Tactics } from "./types";
import type { VersionedVisualData } from "./visual-context";
import type { VisualBallState } from "./visual-ball";
import type { WindVector } from "./ball-climate";
import type { WeatherKind } from "./sim-rules";
import type { MatchExecutionContract } from "./match-execution-contract";
import type { BallPhysicsCheckpoint } from "./rapier-ball-authority";

export const LIVE_MATCH_CLOCK_SCALE = 6;
/** Batch completion shares the live spatial step and match clock. */
export const MATCH_SIMULATION_STEP = 1 / 30;
export const MATCH_SIMULATION_TICK_LIMIT = 60_000;
export const MAX_LIVE_MOTION_SCALE = 2;

export type Side = "home" | "away";

/** Papo de intervalo do usuário: motivar, cobrar ou poupar o time. */
export type TeamTalkKind = "motivar" | "cobrar" | "poupar";

export interface SimPlayer {
  id: string;
  side: Side;
  name: string;
  number: number;
  pos: string;
  /** Original role while an active outfielder covers an absent goalkeeper. */
  emergencyKeeper?: { pos: string; slotX: number; slotZ: number };
  /** Cosmetic body measurements from the player's profile (cm / kg). */
  heightCm?: number;
  weightKg?: number;
  x: number;
  z: number;
  vx: number;
  vz: number;
  slotX: number;
  slotZ: number;
  pace: number;
  shooting: number;
  passing: number;
  defending: number;
  physical: number;
  stamina: number;
  /** ação de animação em curso (curta duração) */
  action: PlayerAction | null;
  /** tempo restante da ação, em segundos */
  actionT: number;
  /** duração total da ação atual */
  actionDur: number;
  /** id do jogador na carreira (sem prefixo de lado) */
  pid: string;
  goals: number;
  assists: number;
  shots: number;
  passes: number;
  tackles: number;
  saves: number;
  onSince: number;
  minutes: number;
  /** amarelos na partida (2 = rua) */
  yellows: number;
  /** expulso: fora do jogo, time com um a menos */
  sentOff: boolean;
  /** semanas de lesão causadas NESTA partida (vão para a carreira) */
  injuryWeeks: number;
  /** cortes de passe adversário */
  interceptions: number;
  /** impedimentos marcados */
  offsides: number;
  /** faltas sofridas */
  foulsWon: number;
  /** pênaltis convertidos/perdidos na partida */
  pensScored: number;
  pensMissed: number;
  /** xG acumulado */
  xg: number;
}

export interface ShotRecord {
  x: number;
  z: number;
  side: Side;
  result: "goal" | "saved" | "off";
  minute: number;
  name: string;
  /** probabilidade de gol do chute (0..1) */
  xg: number;
  /** chance clara (xg >= 0.3) */
  bigChance: boolean;
  /** como a bola foi finalizada */
  bodyPart: "foot" | "head";
}

export interface PlayerRating {
  pid: string;
  side: Side;
  name: string;
  number: number;
  pos: string;
  goals: number;
  assists: number;
  passes: number;
  tackles: number;
  saves: number;
  rating: number;
  minutes: number;
  yellows: number;
  /** expulso na partida */
  red: boolean;
  /** semanas de lesão causadas na partida */
  injuryWeeks: number;
  interceptions: number;
  xg: number;
}

export interface TeamSetup {
  clubId: string;
  name: string;
  short: string;
  primary: string;
  secondary: string;
  players: Player[]; // 11 titulares na ordem da formação
  tactics: Tactics;
  /** reservas disponíveis para a IA substituir */
  bench?: Player[];
  /** moral média do elenco 0-100 (afeta decisões e duelos) */
  morale?: number;
  /** lado controlado pela IA (substitui e ajusta a tática sozinha) */
  cpu?: boolean;
}

export interface MatchStats {
  goals: number;
  shots: number;
  onTarget: number;
  possessionTicks: number;
  fouls: number;
  /** passes tentados */
  passes: number;
  /** passes controlados por um companheiro, incluindo desvios do alvo pretendido */
  passesOk: number;
  corners: number;
  yellow: number;
  red: number;
  /** gols esperados acumulados */
  xg: number;
  /** impedimentos marcados */
  offsides: number;
  /** cortes de passe */
  interceptions: number;
  /** defesas do goleiro */
  saves: number;
  /** pênaltis a favor */
  pens: number;
}

/** estatísticas zeradas — usado pela partida ao vivo e pela repetição */
export function emptyStats(): MatchStats {
  return {
    goals: 0,
    shots: 0,
    onTarget: 0,
    possessionTicks: 0,
    fouls: 0,
    passes: 0,
    passesOk: 0,
    corners: 0,
    yellow: 0,
    red: 0,
    xg: 0,
    offsides: 0,
    interceptions: 0,
    saves: 0,
    pens: 0,
  };
}

export interface Scorer {
  minute: number;
  side: Side;
  name: string;
}

/**
 * Superfície de leitura usada pela cena 3D. Tanto a partida ao vivo
 * (`MatchSim`) quanto a repetição gravada (`ReplaySim`) a implementam.
 */
export interface SimView {
  time: number;
  players: SimPlayer[];
  ball: { x: number; z: number; vx: number; vz: number; holder: string | null; height: number };
  /** Pose opcional produzida pelo adaptador Rapier, usada apenas pelo render. */
  visualBall?: VisualBallState | undefined;
  possession: Side;
  stats: Record<Side, MatchStats>;
  home: TeamSetup;
  away: TeamSetup;
  /** clima da partida (visuais: chuva, gramado molhado). Ausente em replays. */
  weather?: WeatherKind | undefined;
  /** vento da partida (visuais: bandeiras, chuva inclinada). */
  wind?: WindVector | undefined;
  minute(): number;
  /**
   * Gera contexto visual deterministico para todos os jogadores.
   * Opcional: so implementado em MatchSim, ReplaySim usa dados gravados.
   */
  generateVisualContext?(): VersionedVisualData;
}

export interface MatchCheckpoint {
  version: 1 | 2;
  execution?: MatchExecutionContract;
  seed: string;
  rng: number;
  state: Record<string, unknown>;
  physics: BallPhysicsCheckpoint | null;
  perception: "compat" | "wasm";
  athleteRemainders: number[];
}
