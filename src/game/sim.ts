import { FORMATIONS } from "./formations";
import {
  evaluatePassLanesFallback,
  evaluatePassLanesIntoFallback,
  MAX_PASS_LANE_PLAYERS,
  type PassLaneKernel,
  type PassLaneIntoKernel,
} from "./wasm/match-perception";
import {
  MATCH_EXECUTION_REVISION,
  validExecutionContract,
  type MatchExecutionContract,
} from "./match-execution-contract";
import { PassLaneBuffers } from "./wasm/pass-lane-buffers";
import { makeRng } from "./rng";
import { physiqueFor } from "./player-physique";
import { matchAttributes } from "./match-readiness";
import { positionalOverall } from "./overall";
import {
  BOX_DEPTH,
  BOX_HALF,
  PENALTY_DIST,
  type AiBenchInput,
  type AiLineupInput,
  aiMentalityTweak,
  aiSubPick,
  cardForFoul,
  clockText,
  controlFailAdd,
  defensiveLineX,
  duelMult,
  type FoulInput,
  foulMult,
  isOffside,
  type MatchPhase,
  passErrMult,
  type RefProfile,
  refFor,
  type ShootoutKick,
  shootoutWinner,
  solveCornerDuel,
  solveDirectFK,
  solvePenalty,
  shotProbabilities,
  staminaDrainMult,
  type WeatherKind,
  woodworkAt,
  XG_PENALTY,
  xgForShot,
} from "./sim-rules";
import { pitchCondition, windFor, type WindVector } from "./ball-climate";
import {
  advanceAthlete,
  athleteContact,
  athleteRemainder,
  restoreAthleteRemainder,
} from "./athlete-dynamics";
import type { PlayerAction } from "./animation";
import { HIGH_FIDELITY_PHYSICS_STEP } from "./physics-quality";
import type { MatchEventLog, Player, Tactics } from "./types";
import {
  type ActionContext,
  type BodyContactPoint,
  type ContactContext,
  type ContactType,
  type DominantFoot,
  emptyActionContext,
  emptyContactContext,
  getActionPhase,
  getDominantFoot,
  type VisualResult,
  type ReactionType,
  VISUAL_CONTEXT_VERSION,
  type VersionedVisualData,
} from "./visual-context";
import type { CanonicalBallPhysicsState, VisualBallState } from "./visual-ball";
import type {
  BallPhysicsAuthority,
  BallPhysicsCheckpoint,
  RapierBallHolder,
  RapierBallState,
} from "./rapier-ball-authority";

// Medidas do campo vivem em sim-rules.ts; reexportadas aqui por compatibilidade.
import { FIELD_X, FIELD_Z, GOAL_Z } from "./sim-rules";
export { FIELD_X, FIELD_Z, GOAL_Z };
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
  /** passes que chegaram ao destinatário pretendido */
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
const CHECKPOINT_EXTERNAL = new Set(["rnd", "passLaneKernel", "ballPhysics"]);

function clampFinite(value: number, lower: number, upper: number, fallback: number): number {
  if (!Number.isFinite(value)) value = fallback;
  return value <= lower ? lower : value >= upper ? upper : value;
}

export class MatchSim {
  // Native private fields are excluded from checkpoint enumeration and saves.
  readonly #passLaneReceivers = new PassLaneBuffers();
  readonly #passLaneDefenders = new PassLaneBuffers();
  readonly #passLaneOutput = new Float64Array(MAX_PASS_LANE_PLAYERS * 3);
  #passLaneIntoKernel: PassLaneIntoKernel | null = evaluatePassLanesIntoFallback;
  #perceptionBackend: "compat" | "wasm" = "compat";
  #execution: MatchExecutionContract | null = null;
  #physicsFault = false;
  private passLaneKernel: PassLaneKernel = evaluatePassLanesFallback;

  setPassLaneKernel(kernel: PassLaneKernel) {
    if (this.#execution) throw new Error("Match execution is already fixed");
    this.passLaneKernel = kernel;
    this.#passLaneIntoKernel = null;
    this.#perceptionBackend = kernel === evaluatePassLanesFallback ? "compat" : "wasm";
  }

  setPassLaneIntoKernel(kernel: PassLaneIntoKernel, backend: "compat" | "wasm") {
    if (this.#execution) throw new Error("Match execution is already fixed");
    this.#passLaneIntoKernel = kernel;
    this.#perceptionBackend = backend;
  }

  executionContract(): MatchExecutionContract {
    if (this.#execution) return { ...this.#execution };
    return {
      revision: MATCH_EXECUTION_REVISION,
      physics: this.ballPhysics ? "rapier" : "compat",
      perception: this.#perceptionBackend,
    };
  }

  /** Internal recovery snapshot, never a career save or authority attestation. */
  checkpoint(): MatchCheckpoint {
    if (this.#physicsFault) throw new Error("Physics recovery is required");
    const state: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(this))
      if (!CHECKPOINT_EXTERNAL.has(key)) state[key] = value;
    if (this.ballPhysics && !this.ballPhysics.checkpoint)
      throw new Error("Physics backend cannot checkpoint");
    return {
      version: 2,
      execution: this.executionContract(),
      seed: this.matchSeed,
      rng: this.rnd.state(),
      state: structuredClone(state),
      physics: this.ballPhysics?.checkpoint?.() ?? null,
      athleteRemainders: this.players.map(athleteRemainder),
      perception: this.#perceptionBackend,
    };
  }

  restoreCheckpoint(checkpoint: MatchCheckpoint, authority?: BallPhysicsAuthority): void {
    if (
      !checkpoint ||
      !checkpoint.state ||
      (checkpoint.version !== 1 && checkpoint.version !== 2) ||
      (checkpoint.version === 2 &&
        (!validExecutionContract(checkpoint.execution) ||
          checkpoint.execution.physics !== (checkpoint.physics ? "rapier" : "compat") ||
          checkpoint.execution.perception !== checkpoint.perception)) ||
      checkpoint.seed !== this.matchSeed ||
      typeof checkpoint.state["time"] !== "number" ||
      !Number.isFinite(checkpoint.state["time"]) ||
      checkpoint.state["time"] < 0 ||
      !Array.isArray(checkpoint.state["players"]) ||
      checkpoint.state["players"].length > 22 ||
      !Number.isInteger(checkpoint.rng) ||
      checkpoint.rng < 1 ||
      checkpoint.rng > 0xffffffff ||
      !["compat", "wasm"].includes(checkpoint.perception)
    )
      throw new Error("Invalid match checkpoint");
    const keys = Object.keys(this).filter((key) => !CHECKPOINT_EXTERNAL.has(key));
    if (
      keys.length !== Object.keys(checkpoint.state).length ||
      keys.some((key) => !Object.hasOwn(checkpoint.state, key))
    )
      throw new Error("Checkpoint schema mismatch");
    if (checkpoint.physics && !authority?.restore)
      throw new Error("Physics checkpoint requires matching backend");
    // Validate the complete integration journal before changing PRNG, state or
    // releasing live physics. Previously a bad remainder left a half-restored match.
    if (
      !Array.isArray(checkpoint.athleteRemainders) ||
      checkpoint.athleteRemainders.length !== checkpoint.state["players"].length ||
      Array.from(checkpoint.athleteRemainders).some(
        (value) => !Number.isFinite(value) || value < 0 || value >= HIGH_FIDELITY_PHYSICS_STEP,
      )
    )
      throw new Error("Invalid athlete checkpoint");
    const players = checkpoint.state["players"] as SimPlayer[];
    if (
      Array.from(players).some(
        (p) =>
          !p ||
          typeof p.id !== "string" ||
          ![p.x, p.z, p.vx, p.vz, p.stamina].every(Number.isFinite),
      )
    )
      throw new Error("Invalid player checkpoint");
    const state = structuredClone(checkpoint.state);
    // A fresh recovery backend must restore successfully before committing state.
    if (checkpoint.physics) authority!.restore!(checkpoint.physics);
    this.rnd.restore(checkpoint.rng);
    if (this.ballPhysics !== authority) this.ballPhysics?.dispose();
    Object.assign(this, state);
    this.players.forEach((player, index) =>
      restoreAthleteRemainder(player, checkpoint.athleteRemainders[index]!),
    );
    this.ballPhysics = authority ?? null;
    this.#execution =
      checkpoint.version === 2
        ? { ...checkpoint.execution! }
        : {
            revision: MATCH_EXECUTION_REVISION,
            physics: checkpoint.physics ? "rapier" : "compat",
            perception: checkpoint.perception,
          };
    this.#physicsFault = false;
  }
  time = 0; // segundos de jogo
  players: SimPlayer[] = [];
  ball = { x: 0, z: 0, vx: 0, vz: 0, holder: null as string | null, height: 0 };
  possession: Side = "home";
  stats: Record<Side, MatchStats> = {
    home: emptyStats(),
    away: emptyStats(),
  };
  events: MatchEventLog[] = [];
  scorers: Scorer[] = [];
  /** finalizações registradas para o mapa de chutes */
  shotMap: ShotRecord[] = [];
  /** jogadores que saíram por substituição (mantêm estatísticas) */
  subsOut: SimPlayer[] = [];
  subsUsed: Record<Side, number> = { home: 0, away: 0 };
  /** último passador de cada lado, para creditar assistência */
  private lastPass: Record<Side, { id: string; time: number } | null> = { home: null, away: null };
  /** jogadores em "freeze" curto após um chute próximo */
  private reactionUntil = new Map<string, number>();
  private mentalityCache: Record<Side, number> | null = null;
  /** Reused every tick to avoid allocating/sorting temporary chase arrays. */
  private chaseIds = new Set<string>();
  finished = false;
  lastEventId = 0;
  private decisionTimer = 0;
  private rnd: ReturnType<typeof makeRng>;
  private restartTimer = 0;
  /** tempo com a bola solta, usado para destravar a jogada */
  private looseTime = 0;
  /** Pressão coletiva curta disparada por erro técnico ou passe para trás. */
  private pressSurge: Record<Side, number> = { home: 0, away: 0 };
  /** último lado que tocou na bola — define lateral, escanteio e tiro de meta */
  private lastTouch: Side = "home";
  /** velocidade vertical da bola (m/s) — a altura passa a ser física de verdade */
  private ballVy = 0;
  /** curva lateral (efeito Magnus) aplicada enquanto a bola voa */
  private ballSpin = 0;
  /**
   * Autoridade física opcional da bola, injetada apenas pela partida ao vivo.
   * A simulação ainda decide posse, regras e eventos; o Rapier integra a
   * trajetória entre essas decisões.
   */
  private ballPhysics: BallPhysicsAuthority | null = null;
  /** finalização em voo: só vira gol/defesa quando a bola chega lá */
  private pendingShot: {
    side: Side;
    shooter: string;
    outcome: "goal" | "saved" | "off";
    fromX: number;
    fromZ: number;
    targetZ: number;
    xg: number;
    bigChance: boolean;
    bodyPart: "foot" | "head";
  } | null = null;
  /** passe em voo: quem deve receber e até quando o passador não retoma a bola */
  private pass: {
    to: string;
    from: string;
    until: number;
    fromX: number;
    dir: 1 | -1;
    side: Side;
  } | null = null;

  /* ---------------- estrutura da partida (Ciclo 2) ---------------- */
  /** fase atual: tempos, intervalo, prorrogação, disputa ou fim */
  phase: MatchPhase = "first";
  /** mata-mata: empate leva à prorrogação e à disputa de pênaltis */
  readonly knockout: boolean;
  /** clima sorteado ou injetado: afeta controle, passes, faltas e desgaste */
  readonly weather: WeatherKind;
  /** vento da partida (fluxo próprio de semente: não desloca outras rolagens) */
  readonly wind: WindVector;
  /** árbitro da partida (perfil de rigor) */
  readonly ref: RefProfile;
  /** semente original (fluxos dedicados: vento, reclamações) */
  private readonly matchSeed: string;
  /** qual integrador moveu a bola no último tick (trave só reflete no compat) */
  private lastAuthoritative = false;
  /** papo de intervalo do usuário: um por lado e por partida */
  private talkUsed: Record<Side, boolean> = { home: false, away: false };
  /** empurrão da torcida: uma vez por partida */
  private crowdPushDone = false;
  /** acréscimos sorteados do 1º, 2º tempo e 2º tempo da prorrogação */
  private added1 = 0;
  private added2 = 0;
  private addedET = 0;
  /** dívida de acréscimo acumulada por gols, subs, lesões e expulsões */
  private stoppageDebt = 0;
  /** relógio congelado durante intervalo e pausa da prorrogação */
  private freezeT = 0;
  /** até quando (this.time) não há impedimento (isenção pós-bola parada) */
  private exemptUntil = 0;
  /** bola parada armada: cobra após a barreira se posicionar */
  private setPiece: {
    kind: "penalty" | "directFK" | "corner";
    side: Side;
    takerId: string;
    timer: number;
  } | null = null;
  /** disputa de pênaltis: cobranças na ordem */
  shootout: ShootoutKick[] = [];
  private shootoutTimer = 0;
  private shootoutTurn: Side = "home";
  /** última checagem da IA (subs + ajustes táticos), em segundos de jogo */
  private aiLastCheck = 0;
  /** minuto do último ajuste de postura de cada lado */
  private aiTweakMin: Record<Side, number> = { home: 0, away: 0 };
  /** tolerância extra para não apitar no meio de um ataque */
  private graceUntil = 0;

  constructor(
    public home: TeamSetup,
    public away: TeamSetup,
    seed: string,
    opts?: { knockout?: boolean | undefined; weather?: WeatherKind | undefined },
  ) {
    this.rnd = makeRng(seed);
    this.matchSeed = seed;
    this.knockout = opts?.knockout ?? false;
    this.weather = opts?.weather ?? "clear";
    this.wind = windFor(seed);
    this.added1 = 1 + Math.floor(this.rnd() * 3);
    this.added2 = 2 + Math.floor(this.rnd() * 4);
    this.addedET = Math.floor(this.rnd() * 2);
    this.ref = refFor(this.rnd);
    this.reset();
    this.events.push({
      minute: 0,
      type: "kickoff",
      side: "neutral",
      text: `Bola rolando no duelo entre ${home.name} e ${away.name}. Apita ${this.ref.name}.`,
    });
  }

  /** Entrega uma cópia serializável da bola para apresentação ou física ao vivo. */
  physicsBallState(): CanonicalBallPhysicsState {
    return {
      x: this.ball.x,
      z: this.ball.z,
      height: this.ball.height,
      vx: this.ball.vx,
      vy: this.ballVy,
      vz: this.ball.vz,
      spin: this.ballSpin,
      attached: this.ball.holder !== null,
      holder: this.ball.holder,
    };
  }

  /** Liga ou desliga a autoridade física sem acoplar MatchSim ao WASM. */
  setBallPhysicsAuthority(authority: BallPhysicsAuthority | null) {
    if (this.ballPhysics === authority) return;
    if (this.#execution) throw new Error("Match execution is already fixed");
    this.ballPhysics?.dispose();
    this.ballPhysics = authority;
    authority?.setCondition?.(this.weather, this.wind);
    this.synchronizeBallPhysics();
  }

  /** Permite ao Worker detectar uma falha WASM e cair para a rota compatível. */
  hasBallPhysicsAuthority() {
    return this.ballPhysics !== null;
  }

  /** Rebaseia Rapier depois de um reinício, chute, troca ou salto de partida. */
  synchronizeBallPhysics() {
    const physics = this.ballPhysics;
    if (!physics) return;
    try {
      const state = this.mutableBallPhysicsState();
      physics.reset(state, this.ballPhysicsHolder());
      this.applyMutableBallPhysicsState(state);
    } catch {
      physics.dispose();
      if (this.ballPhysics === physics) this.ballPhysics = null;
      if (this.#execution) {
        this.#physicsFault = true;
        throw new Error("Physics recovery is required");
      }
    }
  }

  dispose() {
    this.ballPhysics?.dispose();
    this.ballPhysics = null;
  }

  private mutableBallPhysicsState(): RapierBallState {
    return {
      x: this.ball.x,
      z: this.ball.z,
      height: this.ball.height,
      vx: this.ball.vx,
      vy: this.ballVy,
      vz: this.ball.vz,
      spin: this.ballSpin,
      holder: this.ball.holder,
    };
  }

  private ballPhysicsHolder(): RapierBallHolder | null {
    const holderId = this.ball.holder;
    if (!holderId) return null;
    const holder = this.players.find((player) => player.id === holderId);
    if (!holder) return null;
    return {
      id: holder.id,
      x: holder.x,
      z: holder.z,
      vx: holder.vx,
      vz: holder.vz,
    };
  }

  private applyMutableBallPhysicsState(state: RapierBallState) {
    this.ball.x = state.x;
    this.ball.z = state.z;
    this.ball.height = state.height;
    this.ball.vx = state.vx;
    this.ball.vz = state.vz;
    this.ballVy = state.vy;
    this.ballSpin = state.spin;
  }

  private stepAuthoritativeBall(dt: number, holder: SimPlayer | null): boolean {
    const physics = this.ballPhysics;
    if (!physics) return false;
    try {
      const state = this.mutableBallPhysicsState();
      const holderState = holder
        ? { id: holder.id, x: holder.x, z: holder.z, vx: holder.vx, vz: holder.vz }
        : null;
      physics.step(dt, state, holderState);
      this.applyMutableBallPhysicsState(state);
      return true;
    } catch {
      physics.dispose();
      if (this.ballPhysics === physics) this.ballPhysics = null;
      this.#physicsFault = true;
      throw new Error("Physics recovery is required");
    }
  }

  private buildTeam(setup: TeamSetup, side: Side): SimPlayer[] {
    const slots = FORMATIONS[setup.tactics.formation];
    const dir = side === "home" ? 1 : -1;
    return setup.players.slice(0, 11).map((p, i) => {
      const slot = slots[Math.min(i, slots.length - 1)]!;
      const physique = physiqueFor(p);
      const x = slot.x * FIELD_X * 0.92 * dir;
      const z = slot.z * FIELD_Z * 0.8 * dir;
      return {
        id: `${side}-${p.id}`,
        side,
        name: p.name,
        number: p.number,
        pos: p.pos,
        heightCm: physique.height,
        weightKg: physique.weight,
        x,
        z,
        vx: 0,
        vz: 0,
        slotX: slot.x * dir,
        slotZ: slot.z * dir,
        ...matchAttributes(p, this.matchSeed, side),
        action: null,
        actionT: 0,
        actionDur: 0,
        pid: p.id,
        goals: 0,
        assists: 0,
        shots: 0,
        passes: 0,
        tackles: 0,
        saves: 0,
        onSince: 0,
        minutes: 0,
        yellows: 0,
        sentOff: false,
        injuryWeeks: 0,
        interceptions: 0,
        offsides: 0,
        foulsWon: 0,
        pensScored: 0,
        pensMissed: 0,
        xg: 0,
      };
    });
  }

  /**
   * Troca um titular por um reserva mantendo a posição na formação.
   * Devolve falso quando o jogador que sai não está em campo.
   */
  substitute(side: Side, outPid: string, incoming: Player, reason?: string): boolean {
    if (this.finished || (side !== "home" && side !== "away") || this.subsUsed[side] >= 5)
      return false;
    const setup = this.setup(side);
    if (!incoming || incoming.clubId !== setup.clubId) return false;
    // A command chooses a registered reserve; it cannot supply replacement
    // attributes, revive a dismissed slot or return a previously used athlete.
    const registered = setup.bench?.find((player) => player.id === incoming.id);
    if (
      !registered ||
      registered.clubId !== setup.clubId ||
      registered.suspended ||
      registered.injuryWeeks > 0 ||
      this.players.some((player) => player.pid === incoming.id) ||
      this.subsOut.some((player) => player.pid === incoming.id)
    )
      return false;
    const idx = this.players.findIndex((p) => p.side === side && p.pid === outPid);
    if (idx < 0) return false;
    const out = this.players[idx]!;
    if (out.sentOff) return false;
    incoming = registered;
    const physique = physiqueFor(incoming);
    const fresh: SimPlayer = {
      ...out,
      id: `${side}-${incoming.id}`,
      pid: incoming.id,
      name: incoming.name,
      number: incoming.number,
      pos: incoming.pos,
      heightCm: physique.height,
      weightKg: physique.weight,
      ...matchAttributes(incoming, this.matchSeed, side),
      action: null,
      actionT: 0,
      actionDur: 0,
      goals: 0,
      assists: 0,
      shots: 0,
      passes: 0,
      tackles: 0,
      saves: 0,
      onSince: this.minute(),
      minutes: 0,
      yellows: 0,
      sentOff: false,
      injuryWeeks: 0,
      interceptions: 0,
      offsides: 0,
      foulsWon: 0,
      pensScored: 0,
      pensMissed: 0,
      xg: 0,
    };
    out.minutes += this.minute() - out.onSince;
    this.subsOut.push(out);
    setup.bench = setup.bench!.filter((player) => player.id !== incoming.id);
    if (this.ball.holder === out.id) this.ball.holder = fresh.id;
    this.players[idx] = fresh;
    this.synchronizeBallPhysics();
    this.subsUsed[side]++;
    this.stoppageDebt += 0.5;
    const why = reason === "lesão" ? " (lesão)" : reason === "fadiga" ? " (cansado)" : "";
    this.pushEvent({
      minute: this.minute(),
      type: "sub",
      side,
      text: `Substituição no ${this.setup(side).short}: entra ${incoming.name}, sai ${out.name}${why}.`,
    });
    return true;
  }

  /** Notas de 0 a 10 de todos os jogadores que atuaram na partida. */
  playerRatings(): PlayerRating[] {
    const all = [...this.players, ...this.subsOut];
    return all.map((p) => {
      const mins = Math.max(
        1,
        p.minutes + (this.subsOut.includes(p) ? 0 : this.minute() - p.onSince),
      );
      const scored = this.stats[p.side].goals;
      const conceded = this.stats[p.side === "home" ? "away" : "home"].goals;
      let r = 6.1;
      r += p.goals * 1.3 + p.assists * 0.8;
      r += Math.min(0.5, p.passes / 40) + Math.min(0.6, p.tackles * 0.15);
      r += Math.min(0.8, p.interceptions * 0.2) + Math.min(0.6, p.xg * 0.9);
      if (p.shots > 0) r += (p.goals / p.shots) * 0.4;
      if (p.pos === "GK") r += Math.min(1.3, p.saves * 0.3) - conceded * 0.4;
      else if (p.pos === "DF") r += conceded === 0 && mins >= 60 ? 0.5 : -conceded * 0.12;
      r += p.pensScored * 0.5 - p.pensMissed * 0.5;
      r -= p.yellows * 0.35 + (p.sentOff ? 1.2 : 0) + p.offsides * 0.08;
      r += (scored - conceded) * 0.1;
      r *= 0.8 + Math.min(1, mins / 70) * 0.2;
      return {
        pid: p.pid,
        side: p.side,
        name: p.name,
        number: p.number,
        pos: p.pos,
        goals: p.goals,
        assists: p.assists,
        passes: p.passes,
        tackles: p.tackles,
        saves: p.saves,
        minutes: mins,
        yellows: p.yellows,
        red: p.sentOff,
        injuryWeeks: p.injuryWeeks,
        interceptions: p.interceptions,
        xg: Math.round(p.xg * 100) / 100,
        rating: Math.max(3, Math.min(10, Math.round(r * 10) / 10)),
      };
    });
  }

  /** Melhor jogador da partida. */
  manOfTheMatch(): PlayerRating | null {
    const rs = this.playerRatings();
    if (!rs.length) return null;
    return rs.reduce((a, b) => (b.rating > a.rating ? b : a));
  }

  reset() {
    this.players = [...this.buildTeam(this.home, "home"), ...this.buildTeam(this.away, "away")];
    this.kickoff("home");
  }

  private kickoff(side: Side) {
    this.ball.x = 0;
    this.ball.z = 0;
    this.ball.vx = 0;
    this.ball.vz = 0;
    // Kickoff state can be serialized before another step sanitizes it; keep
    // the canonical ball center at the physical ground radius immediately.
    this.ball.height = 0.12;
    this.ballVy = 0;
    this.ballSpin = 0;
    this.pendingShot = null;
    this.pass = null;
    const team = this.players.filter((p) => p.side === side);
    const starter = team.find((p) => p.pos === "FW") ?? team[team.length - 1]!;
    starter.x = -0.6 * (side === "home" ? 1 : -1);
    starter.z = 0;
    this.ball.holder = starter.id;
    this.possession = side;
    this.lastTouch = side;
    this.restartTimer = 1.2;
    this.synchronizeBallPhysics();
  }

  private setup(side: Side) {
    return side === "home" ? this.home : this.away;
  }

  private attackDir(side: Side) {
    return side === "home" ? 1 : -1;
  }

  private mentalityShift(side: Side) {
    if (this.mentalityCache) return this.mentalityCache[side];
    const h = (this.home.tactics.mentality - 2) * 6 * 1;
    const a = (this.away.tactics.mentality - 2) * 6 * -1;
    this.mentalityCache = { home: h, away: a };
    return this.mentalityCache[side];
  }

  private pushEvent(e: MatchEventLog) {
    this.events.push(e);
    this.lastEventId++;
    if (this.events.length > 80) this.events.shift();
  }

  private recordShot(shot: ShotRecord) {
    this.shotMap.push(shot);
    if (this.shotMap.length > 120) this.shotMap.shift();
  }

  /** dispara uma animação curta no jogador */
  trigger(p: SimPlayer | null | undefined, action: PlayerAction, dur = 0.7) {
    if (!p) return;
    p.action = action;
    p.actionT = dur;
    p.actionDur = dur;
  }

  private tickActions(dt: number) {
    for (const p of this.players) {
      if (p.actionT > 0) {
        p.actionT -= dt;
        if (p.actionT <= 0) {
          p.actionT = 0;
          p.action = null;
        }
      }
    }
    if (this.reactionUntil.size) {
      for (const [id, until] of this.reactionUntil) {
        if (until <= this.time) this.reactionUntil.delete(id);
      }
    }
  }

  minute() {
    return Math.min(120, Math.floor(this.time / 60));
  }

  /** texto do relógio: 45+2', 90+3', 105', 120', PEN */
  clock(): string {
    return clockText(this.phase, this.time, this.added1, this.added2, this.addedET);
  }

  /** fim do período atual em segundos de jogo, com acréscimos e dívida */
  private phaseEndAt(): number {
    const debt = Math.min(3, Math.floor(this.stoppageDebt));
    if (this.phase === "first") return (45 + this.added1 + debt) * 60;
    if (this.phase === "second") return (90 + this.added1 + this.added2 + debt) * 60;
    if (this.phase === "et1") return (105 + this.added1 + this.added2) * 60;
    return (120 + this.added1 + this.added2 + this.addedET) * 60;
  }

  /** não apita no meio de um ataque: espera a bola esfriar (com limite) */
  private readyToWhistle(): boolean {
    if (this.setPiece) return false;
    if (this.pendingShot) return this.time > this.graceUntil;
    const holder = this.ball.holder ? this.players.find((p) => p.id === this.ball.holder) : null;
    if (holder) {
      const goalX = this.attackDir(holder.side) * FIELD_X;
      if (Math.hypot(goalX - holder.x, holder.z) < 18) return this.time > this.graceUntil;
    } else if (Math.hypot(this.ball.vx, this.ball.vz) > 12) {
      return this.time > this.graceUntil;
    }
    return true;
  }

  /** avança a máquina de fases; devolve true quando o jogo terminou */
  private advancePhase(): boolean {
    if (this.phase === "first") {
      this.phase = "half";
      this.freezeT = 6;
      this.ball.holder = null;
      this.pendingShot = null;
      this.pass = null;
      this.pushEvent({ minute: 45, type: "halftime", side: "neutral", text: "Intervalo." });
      this.halfTalk("home");
      this.halfTalk("away");
      return false;
    }
    if (this.phase === "half") {
      this.phase = "second";
      this.kickoff("away");
      this.pushEvent({
        minute: 45,
        type: "kickoff",
        side: "neutral",
        text: "Começa o segundo tempo.",
      });
      return false;
    }
    if (this.phase === "second") {
      const draw = this.stats.home.goals === this.stats.away.goals;
      if (this.knockout && draw) {
        this.phase = "et1";
        this.kickoff("home");
        this.pushEvent({
          minute: 90,
          type: "kickoff",
          side: "neutral",
          text: "Empate no mata-mata: começa a prorrogação.",
        });
        return false;
      }
      this.finishMatch();
      return true;
    }
    if (this.phase === "et1") {
      this.phase = "etBreak";
      this.freezeT = 3;
      this.ball.holder = null;
      this.pendingShot = null;
      this.pass = null;
      this.pushEvent({
        minute: 105,
        type: "halftime",
        side: "neutral",
        text: "Fim do 1º tempo da prorrogação.",
      });
      return false;
    }
    if (this.phase === "etBreak") {
      this.phase = "et2";
      this.kickoff("away");
      this.pushEvent({
        minute: 105,
        type: "kickoff",
        side: "neutral",
        text: "Começa o 2º tempo da prorrogação.",
      });
      return false;
    }
    // fim da prorrogação
    const draw = this.stats.home.goals === this.stats.away.goals;
    if (this.knockout && draw) {
      this.phase = "shootout";
      this.ball.holder = null;
      this.pendingShot = null;
      this.pass = null;
      this.shootoutTimer = 1.5;
      // mando decide: quem joga em casa começa cobrando
      this.shootoutTurn = "home";
      this.pushEvent({
        minute: 120,
        type: "shootout",
        side: "neutral",
        text: "Tudo igual: a vaga será decidida nos pênaltis.",
      });
      this.setupShootoutKick();
      return false;
    }
    this.finishMatch();
    return true;
  }

  /** papo de vestiário: mexe um pouco na moral de cada lado */
  private halfTalk(side: Side) {
    const setup = this.setup(side);
    const losing = this.stats[side].goals < this.stats[side === "home" ? "away" : "home"].goals;
    const delta = losing ? 2 + Math.floor(this.rnd() * 4) : -1 + Math.floor(this.rnd() * 4);
    setup.morale = Math.max(20, Math.min(100, (setup.morale ?? 70) + delta));
  }

  /**
   * Papo de intervalo do usuário (bônus além da conversa padrão): motivar sobe
   * a moral, cobrar troca moral por entrega, poupar guarda pernas. Uma vez por
   * lado e por partida. Chamado pelo Worker (talkLive) ou direto no fallback.
   */
  applyTeamTalk(side: Side, kind: TeamTalkKind): boolean {
    if (this.talkUsed[side] || this.finished) return false;
    this.talkUsed[side] = true;
    const setup = this.setup(side);
    const effects: Record<TeamTalkKind, { morale: number; stamina: number; text: string }> = {
      motivar: {
        morale: 6,
        stamina: 2,
        text: `Você inflama o vestiário: "É AGORA!" O ${setup.short} volta ligado!`,
      },
      cobrar: {
        morale: -2,
        stamina: 6,
        text: `Você cobra entrega: ninguém quer sair vaiado. O ${setup.short} volta mordendo!`,
      },
      poupar: {
        morale: 1,
        stamina: 8,
        text: `Você pede cabeça fria e pernas frescas. O ${setup.short} volta respirando.`,
      },
    };
    const fx = effects[kind];
    setup.morale = Math.max(20, Math.min(100, (setup.morale ?? 70) + fx.morale));
    for (const p of this.players) {
      if (p.side !== side || p.sentOff) continue;
      p.stamina = Math.max(12, Math.min(100, p.stamina + fx.stamina));
    }
    this.pushEvent({ minute: this.minute(), type: "talk", side, text: fx.text });
    return true;
  }

  private finishMatch() {
    this.phase = "done";
    this.finished = true;
    const winner = shootoutWinner(this.shootout);
    const suffix = winner ? ` Nos pênaltis, ${this.setup(winner).short} leva a vaga.` : "";
    this.pushEvent({
      minute: this.minute(),
      type: "fulltime",
      side: "neutral",
      text: `Fim de jogo: ${this.home.short} ${this.stats.home.goals} x ${this.stats.away.goals} ${this.away.short}.${suffix}`,
    });
  }

  /* ---------------- disputa de pênaltis ---------------- */

  /** próximo batedor: quem ainda não cobrou, do melhor para o pior */
  private shootoutTaker(side: Side): SimPlayer | null {
    const field = this.players.filter((p) => p.side === side && !p.sentOff && p.pos !== "GK");
    if (!field.length) return null;
    const taken = new Map<string, number>();
    for (const k of this.shootout) taken.set(k.name, (taken.get(k.name) ?? 0) + 1);
    const fresh = field.filter((p) => !taken.has(p.name)).sort((a, b) => b.shooting - a.shooting);
    if (fresh.length) return fresh[0]!;
    return (
      [...field].sort(
        (a, b) => taken.get(a.name)! - taken.get(b.name)! || b.shooting - a.shooting,
      )[0] ?? null
    );
  }

  /** posiciona batedor, goleiro e bola; a disputa é sempre no mesmo gol */
  private setupShootoutKick() {
    const side = this.shootoutTurn;
    const taker = this.shootoutTaker(side);
    const gk = this.players.find((p) => p.side !== side && p.pos === "GK") ?? null;
    if (taker) {
      taker.x = FIELD_X - PENALTY_DIST;
      taker.z = 0.6;
      taker.vx = 0;
      taker.vz = 0;
    }
    if (gk) {
      gk.x = FIELD_X - 0.8;
      gk.z = 0;
      gk.vx = 0;
      gk.vz = 0;
      gk.sentOff = false; // goleiro expulso na disputa seria caso de manual; ignora
    }
    this.ball.x = FIELD_X - PENALTY_DIST;
    this.ball.z = 0;
    this.ball.vx = 0;
    this.ball.vz = 0;
    this.ball.height = 0.12;
    this.ballVy = 0;
    this.ballSpin = 0;
    this.ball.holder = null;
    this.pendingShot = null;
    this.pass = null;
    this.shootoutTimer = 1.8;
    this.synchronizeBallPhysics();
  }

  private tickShootout(dt: number) {
    this.shootoutTimer -= dt;
    if (this.shootoutTimer > 0) return;
    const side = this.shootoutTurn;
    const taker = this.shootoutTaker(side);
    const gk = this.players.find((p) => p.side !== side && p.pos === "GK") ?? null;
    if (!taker) {
      this.finishMatch();
      return;
    }
    const round = Math.floor(this.shootout.length / 2) + 1;
    const pressureLvl = Math.min(1, (round - 1) / 4 + (this.shootout.length >= 10 ? 0.35 : 0));
    const out = solvePenalty({
      taker: taker.shooting,
      gk: gk?.defending ?? 60,
      pressure: pressureLvl,
      rnd: this.rnd,
    });
    if (gk)
      this.trigger(gk, out.gkSide === 0 ? "save" : out.gkSide > 0 ? "diveRight" : "diveLeft", 1.2);
    this.trigger(taker, "penalty", 0.9);
    // a bola viaja para o canto (ou por cima): só cenário, o sorteio já saiu
    this.ball.vx = (out.skied ? 14 : 22) + this.rnd() * 6;
    this.ball.vz = out.skied
      ? Math.sign(out.takerSide || 1) * (GOAL_Z + 2 + this.rnd() * 2)
      : out.takerSide * GOAL_Z * 0.7;
    this.ballVy = out.skied ? 7 : 1.2;
    if (out.scored) taker.pensScored++;
    else taker.pensMissed++;
    if (!out.scored && !out.skied && gk) gk.saves++;
    this.stats[side].pens++;
    this.shootout.push({ side, name: taker.name, scored: out.scored });
    const hs = this.shootout.filter((k) => k.side === "home" && k.scored).length;
    const as = this.shootout.filter((k) => k.side === "away" && k.scored).length;
    this.pushEvent({
      minute: 120,
      type: "shootout",
      side,
      text: out.scored
        ? `${taker.name} converte (${hs} x ${as}).`
        : out.skied
          ? `${taker.name} isola por cima! (${hs} x ${as})`
          : `${gk?.name ?? "O goleiro"} pega a cobrança de ${taker.name}! (${hs} x ${as})`,
    });
    const winner = shootoutWinner(this.shootout);
    if (winner) {
      this.pushEvent({
        minute: 120,
        type: "shootout",
        side: winner,
        text: `${this.setup(winner).name} vence nos pênaltis por ${winner === "home" ? hs : as} x ${winner === "home" ? as : hs}!`,
      });
      this.finishMatch();
      return;
    }
    this.shootoutTurn = side === "home" ? "away" : "home";
    this.setupShootoutKick();
  }

  /* ---------------- cartões, expulsões e lesões ---------------- */

  private issueYellow(p: SimPlayer) {
    p.yellows++;
    this.stats[p.side].yellow++;
    if (p.yellows >= 2) {
      this.sendOff(p, "segundo amarelo");
      return;
    }
    this.trigger(p, "protest", 1.2);
    this.pushEvent({
      minute: this.minute(),
      type: "yellow",
      side: p.side,
      text: `Cartão amarelo para ${p.name}.`,
    });
    // reclamação: quem parte para cima do árbitro pode tomar o segundo na hora.
    // Fluxo próprio de semente (sem deslocar o rng principal da partida).
    const dissentRnd = makeRng(`dissent-${this.matchSeed}-${p.id}-${this.minute()}`);
    if (dissentRnd() < 0.015 + this.ref.strict * 0.03) {
      this.pushEvent({
        minute: this.minute(),
        type: "yellow",
        side: p.side,
        text: `${p.name} reclama demais e toma o segundo amarelo!`,
      });
      this.issueYellow(p);
    }
  }

  /** expulsão vale de verdade: o jogador sai de campo e o time fica com 10 */
  private sendOff(p: SimPlayer, why: string) {
    if (p.sentOff) return;
    p.sentOff = true;
    this.stats[p.side].red++;
    this.stoppageDebt += 1;
    p.x = Math.sign(p.x || 1) * (FIELD_X + 1);
    p.z = FIELD_Z + 1;
    p.vx = 0;
    p.vz = 0;
    if (this.ball.holder === p.id) {
      this.ball.holder = null;
      this.looseTime = 0.3;
    }
    this.pushEvent({
      minute: this.minute(),
      type: "red",
      side: p.side,
      text: `Cartão vermelho para ${p.name} (${why})!`,
    });
  }

  /** lesão no lance: semanas parado, queda física e (em geral) substituição */
  private injure(p: SimPlayer, cause: string) {
    if (p.injuryWeeks > 0 || p.sentOff) return;
    p.injuryWeeks = 1 + Math.floor(this.rnd() * 3) + (this.rnd() < 0.15 ? 3 : 0);
    p.stamina = Math.max(12, p.stamina - 25);
    this.stoppageDebt += 1;
    this.trigger(p, "dejected", 2.5);
    this.pushEvent({
      minute: this.minute(),
      type: "injury",
      side: p.side,
      text: `${p.name} se machuca ${cause} e preocupa.`,
    });
  }

  /* ---------------- IA do treinador ---------------- */

  private aiManage(side: Side) {
    const min = this.minute();
    // time do usuário: a IA só tira lesionado; o resto é com o treinador
    const userManaged = this.setup(side).cpu === false;
    const foe: Side = side === "home" ? "away" : "home";
    const diff = this.stats[side].goals - this.stats[foe].goals;
    const lineup: AiLineupInput[] = this.players
      .filter((p) => p.side === side)
      .map((p) => ({
        id: p.id,
        pid: p.pid,
        pos: p.pos,
        stamina: p.stamina,
        injuryWeeks: p.injuryWeeks,
        sentOff: p.sentOff,
        yellows: p.yellows,
        ovr: positionalOverall(p.pos as Player["pos"], p),
      }));
    const setupBench = this.setup(side).bench ?? [];
    const bench: AiBenchInput[] = setupBench.map((b) => ({
      id: b.id,
      pos: b.pos,
      ovr: b.ovr,
      condition: b.condition,
      injuryWeeks: b.injuryWeeks,
      suspended: b.suspended,
    }));
    const pick = aiSubPick(lineup, bench, diff, min, this.subsUsed[side], this.rnd);
    if (pick && (!userManaged || pick.reason === "lesão")) {
      const incoming = setupBench.find((b) => b.id === pick.inId);
      if (incoming && this.subsUsed[side] < 5) {
        // The successful substitution consumes its reserve atomically.
        this.substitute(side, pick.outPid, incoming, pick.reason);
      }
    }
    // ajuste de postura no máximo a cada 10' (nunca no time do usuário)
    if (!userManaged && min - this.aiTweakMin[side] >= 10) {
      const sentOffs = this.players.filter((p) => p.side === side && p.sentOff).length;
      const tweak = aiMentalityTweak(diff, min, sentOffs);
      if (tweak) {
        this.aiTweakMin[side] = min;
        const t = this.setup(side).tactics;
        t.mentality = Math.max(0, Math.min(4, t.mentality + tweak.mentality));
        t.pressing = Math.max(0, Math.min(2, t.pressing + tweak.pressing));
      }
    }
  }

  /* ---------------- bolas paradas ---------------- */

  private inBox(x: number, z: number, defending: Side): boolean {
    const gx = defending === "home" ? -FIELD_X : FIELD_X;
    return Math.abs(x - gx) < BOX_DEPTH && Math.abs(z) < BOX_HALF;
  }

  /** melhor cobrador em campo (não expulso, não goleiro) */
  private bestTaker(side: Side, attr: "shooting" | "passing"): SimPlayer | null {
    let best: SimPlayer | null = null;
    for (const p of this.players) {
      if (p.side !== side || p.sentOff || p.pos === "GK") continue;
      if (!best || p[attr] > best[attr]) best = p;
    }
    return best;
  }

  private setupPenalty(side: Side) {
    const dir = this.attackDir(side);
    const goalX = dir * FIELD_X;
    const taker = this.bestTaker(side, "shooting");
    const gk = this.players.find((p) => p.side !== side && p.pos === "GK" && !p.sentOff) ?? null;
    if (!taker) return;
    taker.x = goalX - dir * PENALTY_DIST;
    taker.z = 0.6;
    taker.vx = 0;
    taker.vz = 0;
    if (gk) {
      gk.x = goalX - dir * 0.8;
      gk.z = 0;
      gk.vx = 0;
      gk.vz = 0;
    }
    // todo mundo a 9,15 m da marca
    for (const p of this.players) {
      if (p === taker || p === gk || p.sentOff) continue;
      const d = Math.hypot(p.x - (goalX - dir * PENALTY_DIST), p.z);
      if (d < 9.5) {
        const ang = Math.atan2(p.z, p.x - (goalX - dir * PENALTY_DIST));
        p.x = goalX - dir * PENALTY_DIST + Math.cos(ang) * 10.5;
        p.z = Math.sin(ang) * 10.5;
      }
    }
    this.ball.x = goalX - dir * PENALTY_DIST;
    this.ball.z = 0;
    this.ball.vx = 0;
    this.ball.vz = 0;
    this.ball.height = 0.12;
    this.ballVy = 0;
    this.ballSpin = 0;
    this.ball.holder = null;
    this.pendingShot = null;
    this.pass = null;
    this.setPiece = { kind: "penalty", side, takerId: taker.id, timer: 2.2 };
    this.restartTimer = 2.6;
    this.exemptUntil = this.time + 3;
    this.trigger(taker, "penalty", 2);
    this.pushEvent({
      minute: this.minute(),
      type: "penalty",
      side,
      text: `Pênalti para o ${this.setup(side).short}! ${taker.name} vai para a cobrança.`,
    });
    this.synchronizeBallPhysics();
  }

  private takePenalty() {
    const sp = this.setPiece;
    if (!sp) return;
    const side = sp.side;
    const dir = this.attackDir(side);
    const taker = this.players.find((p) => p.id === sp.takerId) ?? null;
    const gk = this.players.find((p) => p.side !== side && p.pos === "GK" && !p.sentOff) ?? null;
    this.setPiece = null;
    if (!taker) {
      this.scheduleRestart(side === "home" ? "away" : "home");
      return;
    }
    const late = this.minute() >= 75;
    const close = Math.abs(this.stats.home.goals - this.stats.away.goals) <= 1;
    const out = solvePenalty({
      taker: taker.shooting,
      gk: gk?.defending ?? 60,
      pressure: late && close ? 0.7 : 0.25,
      rnd: this.rnd,
    });
    this.trigger(taker, "shot", 0.8);
    if (gk)
      this.trigger(gk, out.gkSide === 0 ? "save" : out.gkSide > 0 ? "diveRight" : "diveLeft", 1.15);
    this.lastPass[side] = null; // pênalti não tem assistência
    this.stats[side].shots++;
    this.stats[side].pens++;
    this.stats[side].xg += XG_PENALTY;
    taker.shots++;
    taker.xg += XG_PENALTY;
    if (out.scored) taker.pensScored++;
    else taker.pensMissed++;
    const targetZ = out.skied
      ? Math.sign(out.takerSide || 1) * (GOAL_Z + 1.5 + this.rnd() * 2)
      : out.takerSide * GOAL_Z * 0.72;
    const targetH = out.skied ? 3.2 + this.rnd() * 1.5 : 0.35 + this.rnd() * 1.3;
    const dx = dir * FIELD_X - this.ball.x;
    const dz = targetZ - this.ball.z;
    const d = Math.hypot(dx, dz) || 1;
    const power = 24 + this.rnd() * 7;
    this.ball.vx = (dx / d) * power;
    this.ball.vz = (dz / d) * power;
    this.ball.height = 0.25;
    const flight = Math.max(0.15, d / power);
    this.ballVy = (targetH - 0.25) / flight + 4.905 * flight;
    this.ballSpin = 0;
    this.lastTouch = side;
    this.pendingShot = {
      side,
      shooter: taker.id,
      outcome: out.scored ? "goal" : out.skied ? "off" : "saved",
      fromX: this.ball.x,
      fromZ: this.ball.z,
      targetZ,
      xg: XG_PENALTY,
      bigChance: true,
      bodyPart: "foot",
    };
    if (!out.scored && out.skied) {
      this.recordShot({
        x: this.ball.x,
        z: this.ball.z,
        side,
        result: "off",
        minute: this.minute(),
        name: taker.name,
        xg: XG_PENALTY,
        bigChance: true,
        bodyPart: "foot",
      });
      this.pushEvent({
        minute: this.minute(),
        type: "penalty",
        side,
        text: `${taker.name} isola o pênalti!`,
      });
    }
    this.synchronizeBallPhysics();
  }

  private setupDirectFK(side: Side, fx: number, fz: number) {
    const dir = this.attackDir(side);
    const goalX = dir * FIELD_X;
    const taker = this.bestTaker(side, "shooting");
    if (!taker) return;
    taker.x = fx - dir * 1.2;
    taker.z = fz + 0.8;
    taker.vx = 0;
    taker.vz = 0;
    // barreira: 2 a 4 adversários a 9,15 m, entre a bola e o gol
    const foes = this.players
      .filter((p) => p.side !== side && !p.sentOff && p.pos !== "GK")
      .sort((a, b) => Math.hypot(a.x - fx, a.z - fz) - Math.hypot(b.x - fx, b.z - fz));
    const wall = Math.min(foes.length, 2 + Math.floor(this.rnd() * 3));
    const ang = Math.atan2(0 - fz, goalX - fx);
    for (let i = 0; i < wall; i++) {
      const w = foes[i]!;
      const off = (i - (wall - 1) / 2) * 0.9;
      w.x = fx + Math.cos(ang) * 9.15 - Math.sin(ang) * off;
      w.z = fz + Math.sin(ang) * 9.15 + Math.cos(ang) * off;
      w.vx = 0;
      w.vz = 0;
      this.trigger(w, "block", 2.4);
    }
    this.ball.x = fx;
    this.ball.z = fz;
    this.ball.vx = 0;
    this.ball.vz = 0;
    this.ball.height = 0.12;
    this.ballVy = 0;
    this.ballSpin = 0;
    this.ball.holder = null;
    this.pendingShot = null;
    this.pass = null;
    this.setPiece = { kind: "directFK", side, takerId: taker.id, timer: 2.4 };
    this.restartTimer = 2.8;
    this.exemptUntil = this.time + 3;
    this.trigger(taker, "freeKick", 2.2);
    this.pushEvent({
      minute: this.minute(),
      type: "freekick",
      side,
      text: `Falta perigosa para o ${this.setup(side).short}. ${taker.name} na cobrança.`,
    });
    this.synchronizeBallPhysics();
  }

  private takeDirectFK() {
    const sp = this.setPiece;
    if (!sp) return;
    const side = sp.side;
    const dir = this.attackDir(side);
    const taker = this.players.find((p) => p.id === sp.takerId) ?? null;
    const gk = this.players.find((p) => p.side !== side && p.pos === "GK" && !p.sentOff) ?? null;
    this.setPiece = null;
    if (!taker) {
      this.restartFor(side, "throwIn");
      return;
    }
    const fx = this.ball.x;
    const fz = this.ball.z;
    const dist = Math.hypot(dir * FIELD_X - fx, fz);
    const wall = this.players.filter(
      (p) => p.side !== side && !p.sentOff && Math.hypot(p.x - fx, p.z - fz) < 12,
    ).length;
    const out = solveDirectFK({
      dist,
      central: Math.abs(fz) < 12,
      taker: taker.shooting,
      wall,
      gk: gk?.defending ?? 60,
      rnd: this.rnd,
    });
    this.trigger(taker, "shot", 0.8);
    this.lastPass[side] = null; // falta direta não tem assistência
    this.stats[side].shots++;
    this.stats[side].xg += out.xg;
    taker.shots++;
    taker.xg += out.xg;
    if (out.result === "wall") {
      // explode na barreira e segue viva
      const dx = dir * FIELD_X - fx;
      const dz = out.targetZ - fz;
      const d = Math.hypot(dx, dz) || 1;
      this.ball.vx = (dx / d) * 12;
      this.ball.vz = (dz / d) * 12;
      this.ballVy = 2.5;
      this.lastTouch = side;
      this.looseTime = 0;
      this.pushEvent({
        minute: this.minute(),
        type: "freekick",
        side,
        text: `A cobrança de ${taker.name} explode na barreira!`,
      });
      this.recordShot({
        x: fx,
        z: fz,
        side,
        result: "off",
        minute: this.minute(),
        name: taker.name,
        xg: out.xg,
        bigChance: false,
        bodyPart: "foot",
      });
      this.synchronizeBallPhysics();
      return;
    }
    const dx = dir * FIELD_X - fx;
    const dz = out.targetZ - fz;
    const d = Math.hypot(dx, dz) || 1;
    const power = 21 + this.rnd() * 7;
    this.ball.vx = (dx / d) * power;
    this.ball.vz = (dz / d) * power;
    this.ball.height = 0.25;
    const flight = Math.max(0.15, d / power);
    this.ballVy = (out.targetH - 0.25) / flight + 4.905 * flight;
    this.ballSpin = (this.rnd() - 0.5) * 6;
    this.lastTouch = side;
    this.pendingShot = {
      side,
      shooter: taker.id,
      outcome: out.result,
      fromX: fx,
      fromZ: fz,
      targetZ: out.targetZ,
      xg: out.xg,
      bigChance: false,
      bodyPart: "foot",
    };
    if (out.result === "off") {
      this.recordShot({
        x: fx,
        z: fz,
        side,
        result: "off",
        minute: this.minute(),
        name: taker.name,
        xg: out.xg,
        bigChance: false,
        bodyPart: "foot",
      });
    }
    this.synchronizeBallPhysics();
  }

  private setupCorner(side: Side) {
    // batedor vai para a bandeira; área enche dos dois lados
    const dir = this.attackDir(side);
    const goalX = dir * FIELD_X;
    const cornerZ = Math.sign(this.ball.z || 1) * (FIELD_Z - 0.8);
    const taker =
      this.players
        .filter((p) => p.side === side && !p.sentOff && p.pos !== "GK")
        .sort((a, b) => b.passing - a.passing)[0] ?? null;
    if (!taker) return;
    taker.x = goalX - dir * 1.5;
    taker.z = cornerZ;
    taker.vx = 0;
    taker.vz = 0;
    const attack = this.players
      .filter((p) => p.side === side && !p.sentOff && p !== taker && p.pos !== "GK")
      .sort((a, b) => b.physical - a.physical)
      .slice(0, 5);
    attack.forEach((p, i) => {
      p.x = goalX - dir * (6 + (i % 3) * 3.5) + (this.rnd() - 0.5) * 2;
      p.z = (i - 2) * 3.4 + (this.rnd() - 0.5) * 2;
    });
    const defense = this.players
      .filter((p) => p.side !== side && !p.sentOff && p.pos !== "GK")
      .sort((a, b) => Math.hypot(a.x - goalX, a.z) - Math.hypot(b.x - goalX, b.z))
      .slice(0, 6);
    defense.forEach((p, i) => {
      p.x = goalX - dir * (4.5 + (i % 3) * 3) + (this.rnd() - 0.5) * 2;
      p.z = (i - 2.5) * 2.8 + (this.rnd() - 0.5) * 2;
    });
    this.ball.x = goalX - dir * 1.2;
    this.ball.z = cornerZ;
    this.ball.vx = 0;
    this.ball.vz = 0;
    this.ball.height = 0.12;
    this.ballVy = 0;
    this.ballSpin = 0;
    this.ball.holder = null;
    this.pendingShot = null;
    this.pass = null;
    this.stats[side].corners++;
    this.setPiece = { kind: "corner", side, takerId: taker.id, timer: 2.2 };
    this.restartTimer = 2.6;
    this.exemptUntil = this.time + 3.5;
    this.trigger(taker, "corner", 2);
    this.pushEvent({
      minute: this.minute(),
      type: "corner",
      side,
      text: `Escanteio para ${this.setup(side).short}.`,
    });
    this.synchronizeBallPhysics();
  }

  private takeCorner() {
    const sp = this.setPiece;
    if (!sp) return;
    const side = sp.side;
    const dir = this.attackDir(side);
    const goalX = dir * FIELD_X;
    // gol de escanteio tem assistência do batedor
    this.lastPass[side] = { id: sp.takerId, time: this.time };
    this.setPiece = null;
    const attack = this.players.filter(
      (p) => p.side === side && !p.sentOff && p.pos !== "GK" && Math.abs(p.x - goalX) < 22,
    );
    const defense = this.players.filter(
      (p) => p.side !== side && !p.sentOff && p.pos !== "GK" && Math.abs(p.x - goalX) < 22,
    );
    const gk = this.players.find((p) => p.side !== side && p.pos === "GK" && !p.sentOff) ?? null;
    const att = attack.reduce((s, p) => s + p.physical + p.shooting * 0.4, 0);
    const dfn = defense.reduce((s, p) => s + p.physical + p.defending * 0.4, 0);
    const duel = solveCornerDuel({
      attack: att,
      defense: dfn,
      gkComes: !!gk && this.rnd() < 0.5,
      gk: gk?.defending ?? 60,
      rnd: this.rnd,
    });
    if (duel.winner === "gk" && gk) {
      this.trigger(gk, "catch", 1);
      this.pushEvent({
        minute: this.minute(),
        type: "corner",
        side: gk.side,
        text: `${gk.name} sai do gol e fica com o escanteio.`,
      });
      this.scheduleRestart(gk.side);
      return;
    }
    if (duel.winner === "defense") {
      const clearer = [...defense].sort((a, b) => b.physical - a.physical)[0] ?? null;
      if (clearer) {
        this.trigger(clearer, "headClear", 0.9);
        this.ball.x = clearer.x;
        this.ball.z = clearer.z;
        this.ball.vx = -dir * (14 + this.rnd() * 8);
        this.ball.vz = (this.rnd() - 0.5) * 14;
        this.ballVy = 4 + this.rnd() * 3;
        this.ball.height = 1.8;
        this.lastTouch = clearer.side;
        this.looseTime = 0;
      }
      this.pushEvent({
        minute: this.minute(),
        type: "corner",
        side,
        text: `A zaga afasta o escanteio.`,
      });
      this.synchronizeBallPhysics();
      return;
    }
    // ataque ganha: cabeçada com o xG sorteado
    const header =
      [...attack].sort((a, b) => b.physical + b.shooting - (a.physical + a.shooting))[0] ?? null;
    if (!header) {
      this.restartFor(side, "throwIn");
      return;
    }
    this.trigger(header, "header", 0.9);
    const goalP = duel.headerXg * 1.1;
    const onP = goalP + 0.4;
    const roll = this.rnd();
    const outcome: "goal" | "saved" | "off" = roll < goalP ? "goal" : roll < onP ? "saved" : "off";
    this.stats[side].shots++;
    this.stats[side].xg += duel.headerXg;
    header.shots++;
    header.xg += duel.headerXg;
    const targetZ =
      outcome === "off"
        ? Math.sign(this.rnd() - 0.5 || 1) * (GOAL_Z + 1 + this.rnd() * 3)
        : (this.rnd() - 0.5) * GOAL_Z * 1.5;
    const dx = goalX - header.x;
    const dz = targetZ - header.z;
    const d = Math.hypot(dx, dz) || 1;
    const power = 13 + this.rnd() * 6;
    this.ball.x = header.x;
    this.ball.z = header.z;
    this.ball.vx = (dx / d) * power;
    this.ball.vz = (dz / d) * power;
    this.ball.height = 1.9;
    this.ballVy = 0.5 + this.rnd() * 1.5;
    this.ballSpin = 0;
    this.lastTouch = side;
    if (outcome === "goal" && gk) {
      const dive = targetZ - gk.z;
      this.trigger(gk, Math.abs(dive) < 1.15 ? "save" : dive > 0 ? "diveRight" : "diveLeft", 1.1);
    }
    this.pendingShot = {
      side,
      shooter: header.id,
      outcome,
      fromX: header.x,
      fromZ: header.z,
      targetZ,
      xg: duel.headerXg,
      bigChance: duel.headerXg > 0.12,
      bodyPart: "head",
    };
    if (outcome === "off") {
      if (this.rnd() < 0.2) this.lastTouch = side === "home" ? "away" : "home";
      this.recordShot({
        x: header.x,
        z: header.z,
        side,
        result: "off",
        minute: this.minute(),
        name: header.name,
        xg: duel.headerXg,
        bigChance: duel.headerXg > 0.12,
        bodyPart: "head",
      });
      this.pushEvent({
        minute: this.minute(),
        type: "shot",
        side,
        text: `${header.name} cabeceia para fora.`,
      });
    } else {
      this.pushEvent({
        minute: this.minute(),
        type: "shot",
        side,
        text: `${header.name} cabeceia após o escanteio!`,
      });
    }
    this.synchronizeBallPhysics();
  }

  private tickSetPiece(dt: number) {
    const sp = this.setPiece;
    if (!sp) return;
    sp.timer -= dt;
    if (sp.timer > 0) return;
    if (sp.kind === "penalty") this.takePenalty();
    else if (sp.kind === "directFK") this.takeDirectFK();
    else this.takeCorner();
  }

  private nearestOpponent(p: SimPlayer) {
    let best: SimPlayer | null = null;
    let bestD2 = Infinity;
    for (const o of this.players) {
      if (o.side === p.side || o.sentOff) continue;
      const d2 = (o.x - p.x) ** 2 + (o.z - p.z) ** 2;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = o;
      }
    }
    return { opp: best, dist: Math.sqrt(bestD2) };
  }

  step(dt: number, clockScale = 1, _legacyUseBallPhysics = true) {
    if (this.finished) return;
    if (this.#physicsFault) throw new Error("Physics recovery is required");
    this.#execution ??= this.executionContract();
    // intervalo e pausa da prorrogação: relógio parado, cena respira
    if (this.phase === "half" || this.phase === "etBreak") {
      this.freezeT -= dt;
      this.tickActions(dt);
      this.sanitize();
      if (this.freezeT <= 0) this.advancePhase();
      return;
    }
    // disputa de pênaltis: só as cobranças, sem jogo corrido
    if (this.phase === "shootout") {
      this.tickShootout(dt);
      this.tickActions(dt);
      this.sanitize();
      return;
    }
    const clockDt = dt * Math.max(1, clockScale);
    this.time += clockDt;
    this.pressSurge.home = Math.max(0, this.pressSurge.home - dt);
    this.pressSurge.away = Math.max(0, this.pressSurge.away - dt);
    this.mentalityCache = null;

    // fim do período (com tolerância para não apitar no meio do ataque)
    const endAt = this.phaseEndAt();
    if (this.time >= endAt) {
      if (this.graceUntil < endAt) this.graceUntil = endAt + 40;
      if (this.readyToWhistle() || this.time >= endAt + 45) {
        this.graceUntil = 0;
        this.advancePhase();
        return;
      }
    }

    this.stats[this.possession].possessionTicks += clockDt;
    if (this.restartTimer > 0) this.restartTimer -= dt;
    this.tickActions(dt);

    this.moveOffBall(dt);
    this.separate();
    this.drainStamina(clockDt);
    this.moveBall(dt);
    this.sanitize();

    const holder = this.ball.holder ? this.players.find((p) => p.id === this.ball.holder) : null;
    if (holder) {
      this.dribble(holder, dt);
      this.pressure(holder, dt);
      this.decisionTimer -= dt;
      if (this.decisionTimer <= 0 && this.restartTimer <= 0) {
        this.decide(holder);
        const tempo = this.setup(holder.side).tactics.tempo;
        this.decisionTimer = 1.5 - tempo * 0.35 + this.rnd() * 0.6;
      }
    }
    // segunda passada: o condutor também não pode terminar dentro de outro jogador
    this.separate();
    this.sanitize();

    // bola parada armada: a cobrança sai quando a barreira se posiciona
    if (this.setPiece) this.tickSetPiece(dt);
    // IA do treinador substitui e ajusta a postura a cada ~40s de jogo
    if (this.time - this.aiLastCheck > 40) {
      this.aiLastCheck = this.time;
      this.aiManage("home");
      this.aiManage("away");
    }
    this.crowdPush();
  }

  /**
   * A torcida empurra: aos 75', se o mandante não está vencendo, a arquibancada
   * pega fogo uma vez — pernas frescas para quem está em campo.
   */
  private crowdPush() {
    if (this.crowdPushDone || this.phase !== "second" || this.minute() < 75) return;
    if (this.stats.home.goals > this.stats.away.goals) return;
    this.crowdPushDone = true;
    for (const p of this.players) {
      if (p.side !== "home" || p.sentOff) continue;
      p.stamina = Math.min(100, p.stamina + 6);
    }
    this.pushEvent({
      minute: this.minute(),
      type: "crowd",
      side: "home",
      text: `A torcida empurra o ${this.setup("home").short}: o estádio inteiro canta!`,
    });
  }

  /** ids dos jogadores designados a perseguir a bola solta */
  private chasers(): Set<string> {
    const set = this.chaseIds;
    set.clear();
    if (this.ball.holder) return set;
    for (const side of ["home", "away"] as Side[]) {
      let first: SimPlayer | null = null;
      let second: SimPlayer | null = null;
      let firstDistance = Infinity;
      let secondDistance = Infinity;
      for (const player of this.players) {
        if (player.side !== side || player.pos === "GK" || player.sentOff) continue;
        const dx = player.x - this.ball.x;
        const dz = player.z - this.ball.z;
        const distance = dx * dx + dz * dz;
        if (distance < firstDistance) {
          second = first;
          secondDistance = firstDistance;
          first = player;
          firstDistance = distance;
        } else if (distance < secondDistance) {
          second = player;
          secondDistance = distance;
        }
      }
      if (first) set.add(first.id);
      if (second) set.add(second.id);
    }
    return set;
  }

  private moveOffBall(dt: number) {
    const bx = this.ball.x;
    const bz = this.ball.z;
    const chase = this.chasers();
    // The holder is skipped below, so its position stays fixed throughout this pass.
    const holder = this.ball.holder
      ? this.players.find((q) => q.id === this.ball.holder)
      : undefined;

    // Urgência pelo placar e pelo relógio: quem está perdendo no fim empurra a
    // equipe para a frente; quem está ganhando recua e segura o resultado.
    const remaining = Math.max(0, 90 - this.time / 60);
    const lateGame = remaining < 15;
    const goalDiff = this.stats.home.goals - this.stats.away.goals;
    const urgency = (side: Side) => {
      if (!lateGame) return 0;
      const diff = side === "home" ? goalDiff : -goalDiff;
      if (diff < 0) return Math.min(1, (15 - remaining) / 15) * (diff <= -2 ? 1 : 0.8);
      if (diff > 0) return -Math.min(1, (15 - remaining) / 15) * 0.6;
      return 0;
    };

    // Linha defensiva conjunta: a referência é o zagueiro mais recuado do lado
    // sem a bola, o que permite subir junto e armar impedimento.
    const lineX: Record<Side, number> = { home: FIELD_X, away: -FIELD_X };
    for (const q of this.players) {
      if (q.pos === "GK" || q.sentOff) continue;
      if (q.side === "home") {
        if (q.x < lineX.home) lineX.home = q.x;
      } else if (q.x > lineX.away) lineX.away = q.x;
    }

    for (const p of this.players) {
      if (p.sentOff) continue;
      if (p.id === this.ball.holder) continue;
      const setup = this.setup(p.side);
      const dir = this.attackDir(p.side);
      const attacking = this.possession === p.side;
      const defendingWide = !attacking && Math.abs(bz) > FIELD_Z * 0.7;
      const widthFactor = (0.62 + setup.tactics.width * 0.14) * (defendingWide ? 0.76 : 1);
      const surge = !attacking && this.pressSurge[p.side] > 0;
      const pressLine = attacking
        ? 10 + setup.tactics.mentality * 5
        : -6 + setup.tactics.pressing * 7 + (surge ? 7 : 0);

      let tx = p.slotX * FIELD_X * 0.9 + this.mentalityShift(p.side) + bx * 0.22 + pressLine * dir;
      let tz = p.slotZ * FIELD_Z * widthFactor + bz * 0.28;
      let sprint = 1;

      const ballDist = Math.hypot(bx - p.x, bz - p.z);

      if (p.pos === "GK") {
        // Goleiro acompanha ângulo e profundidade: protege o primeiro pau sem
        // abandonar a linha quando a bola ainda está longe.
        const ownGoalX = dir * -FIELD_X;
        const ballToGoal = Math.abs(bx - ownGoalX);
        const stepOut = Math.max(0, Math.min(9, (24 - ballToGoal) * 0.42));
        tx = ownGoalX + dir * stepOut;
        tz = Math.max(-GOAL_Z + 0.45, Math.min(GOAL_Z - 0.45, bz * (0.12 + stepOut * 0.022)));
        // A leitura do chute começa na batida, não apenas quando a bola cruza a
        // linha. O goleiro fecha o alvo previsto sem teletransportar ou conhecer
        // o resultado sorteado da finalização.
        const incoming = this.pendingShot?.side !== p.side ? this.pendingShot : null;
        if (incoming) {
          const reaction = 0.32 + p.defending / 220;
          tz +=
            (Math.max(-GOAL_Z + 0.35, Math.min(GOAL_Z - 0.35, incoming.targetZ)) - tz) * reaction;
          tx += dir * Math.min(1.4, ballDist * 0.04);
          sprint = 1.18;
        }
        // goleiro sai da área para bola solta muito perto
        const sweepRange = 9 + setup.tactics.mentality * 1.35 + p.pace / 35;
        if (
          !this.ball.holder &&
          !incoming &&
          ballDist < sweepRange &&
          Math.abs(bx - dir * -FIELD_X) < 18
        ) {
          tx = bx;
          tz = bz;
          sprint = 1.25;
        }
      } else if (chase.has(p.id)) {
        // interceptação: mira num ponto à frente da bola
        tx = bx + this.ball.vx * 0.22;
        tz = bz + this.ball.vz * 0.22;
        sprint = 1.35;
      } else if (!attacking) {
        // Linha defensiva conjunta: os defensores sobem/descem juntos em vez de
        // cada um seguir a bola por conta própria — é isso que cria a linha reta
        // e permite a armadilha de impedimento.
        if (p.pos === "DF") {
          const line = lineX[p.side];
          const trap = setup.tactics.pressing >= 3 && Math.abs(bx - line) > 14 ? dir * 3.5 : 0;
          tx = tx * 0.35 + (line + trap) * 0.65;
          // marcação por zona: cobre o adversário mais perigoso da sua faixa
          let markZ: number | null = null;
          let best = 9;
          for (const q of this.players) {
            if (q.side === p.side || q.pos === "GK" || q.sentOff) continue;
            const gap = Math.abs(q.z - tz);
            if (gap < best && Math.abs(q.x - tx) < 16) {
              best = gap;
              markZ = q.z;
            }
          }
          if (markZ !== null) tz = tz * 0.55 + markZ * 0.45;
        }
        if (ballDist < 18) {
          const pull = p.pos === "DF" ? 0.35 : 0.6;
          tx += (bx - tx) * pull;
          tz += (bz - tz) * pull;
          sprint = (surge ? 1.3 : 1.15) * (0.82 + p.stamina / 550);
        }
        // perdendo no fim: a equipe inteira sobe para pressionar
        tx += urgency(p.side) * 7 * dir;
      } else {
        // Movimento sem bola de verdade, em vez de balanço aleatório:
        // atacante ataca as costas da linha, ponta corta para dentro,
        // lateral faz a sobreposição e o meia oferece o apoio de recuo.
        const ahead = holder ? (holder.x - p.x) * dir : 0;
        if (p.pos === "FW") {
          const backline = lineX[p.side === "home" ? "away" : "home"];
          tx = tx * 0.4 + (backline + dir * 1.2) * 0.6;
          tz += (p.number % 2 === 0 ? 1 : -1) * 3.2;
        } else if (p.pos === "MF") {
          if (Math.abs(p.slotZ) > 0.45) {
            tz *= 0.55; // ponta cortando para dentro
            tx += dir * 4;
          } else if (ahead > 6) {
            tx -= dir * 3.5; // apoio de recuo atrás da linha da bola
          }
        } else if (p.pos === "DF" && Math.abs(p.slotZ) > 0.5 && ahead > -4) {
          // sobreposição do lateral pela linha de fundo
          tx += dir * 12;
          tz += Math.sign(p.slotZ) * 3.5;
          sprint = 1.2;
        }
        tz += Math.sin(this.time * 0.4 + p.number) * 0.9;
        tx += urgency(p.side) * 5 * dir;
      }

      tx = Math.max(-FIELD_X + 2, Math.min(FIELD_X - 2, tx));
      tz = Math.max(-FIELD_Z + 2, Math.min(FIELD_Z - 2, tz));

      const stam = 0.78 + (p.stamina / 100) * 0.22;
      const baseSpeed = 2.45 + (p.pace / 100) * 3.65;
      const speed = baseSpeed * (p.pos === "GK" ? 0.68 : 1) * Math.min(1.22, sprint) * stam;
      const dx = tx - p.x;
      const dz = tz - p.z;
      const d = Math.hypot(dx, dz);
      let speedEff = speed;
      if (d > 0.001) {
        // curva de corrida: quanto maior a mudança de direção, mais o jogador reduz
        const curSpeed = Math.hypot(p.vx, p.vz);
        if (curSpeed > 2.5) {
          const dot = (dx / d) * (p.vx / curSpeed) + (dz / d) * (p.vz / curSpeed);
          // só penaliza curvas realmente fechadas (> ~100°); o resto mantém o ritmo
          if (dot < 0.2) speedEff = speed * (0.6 + 0.4 * Math.max(0, (dot + 0.2) / 1.2));
        }
        // reação tardia a um chute próximo
        if ((this.reactionUntil.get(p.id) ?? 0) > this.time) speedEff *= 0.3;
      }
      advanceAthlete(p, tx, tz, speedEff, dt, this.weather === "rain" ? 0.72 : 1);
    }
  }

  /** empurra jogadores sobrepostos para que não se atravessem */
  private separate() {
    const R = 0.85; // raio do corpo
    const list = this.players;
    for (let i = 0; i < list.length; i++) {
      const a = list[i]!;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j]!;
        let dx = b.x - a.x;
        let dz = b.z - a.z;
        // Resolve contacts in the original order; only reject provably distant pairs.
        // NaN must reach the original recovery path instead of being hidden by the rejection.
        if ((dx > 1.7 || dx < -1.7) && !Number.isNaN(dz)) continue;
        const d2 = dx * dx + dz * dz;
        if (d2 > 2.89) continue; // (0.85 * 2)^2
        let d = Math.sqrt(d2);
        if (d > R * 2) continue;
        if (d < 1e-4) {
          dx = (this.rnd() - 0.5) * 0.02;
          dz = (this.rnd() - 0.5) * 0.02;
          d = Math.hypot(dx, dz) || 1e-4;
        }
        const overlap = R * 2 - d;
        // Quem conduz a bola cede menos, mas a soma dos deslocamentos sempre
        // resolve toda a sobreposição para não deixar atletas grudados.
        const aWeight = a.id === this.ball.holder ? 0.25 : 1;
        const bWeight = b.id === this.ball.holder ? 0.25 : 1;
        const totalWeight = aWeight + bWeight;
        const nx = dx / d;
        const nz = dz / d;
        athleteContact(a, b, nx, nz);
        a.x -= nx * overlap * (aWeight / totalWeight);
        a.z -= nz * overlap * (aWeight / totalWeight);
        b.x += nx * overlap * (bWeight / totalWeight);
        b.z += nz * overlap * (bWeight / totalWeight);
      }
    }
    for (const p of list) {
      p.x = Math.max(-FIELD_X - 1, Math.min(FIELD_X + 1, p.x));
      p.z = Math.max(-FIELD_Z - 1, Math.min(FIELD_Z + 1, p.z));
    }
  }

  /** desgaste físico ao longo do jogo (calor e chuva pesam) */
  private drainStamina(dt: number) {
    const climate = staminaDrainMult(this.weather);
    for (const p of this.players) {
      const speed = Math.hypot(p.vx, p.vz);
      const effort = 0.0015 + (speed / 9) * 0.008 * (p.pos === "GK" ? 0.25 : 1);
      const resist = 0.6 + (p.physical / 100) * 0.6;
      p.stamina = Math.max(12, p.stamina - ((effort * climate) / resist) * dt);
    }
  }

  /** blindagem contra NaN/Infinity vindos de dados ruins */
  private sanitize() {
    for (const p of this.players) {
      p.x = clampFinite(p.x, -FIELD_X - 1, FIELD_X + 1, 0);
      p.z = clampFinite(p.z, -FIELD_Z - 1, FIELD_Z + 1, 0);
      p.vx = clampFinite(p.vx, -14, 14, 0);
      p.vz = clampFinite(p.vz, -14, 14, 0);
      p.stamina = clampFinite(p.stamina, 0, 100, 70);
    }
    const b = this.ball;
    b.x = clampFinite(b.x, -FIELD_X - 2, FIELD_X + 2, 0);
    b.z = clampFinite(b.z, -FIELD_Z - 2, FIELD_Z + 2, 0);
    b.vx = clampFinite(b.vx, -45, 45, 0);
    b.vz = clampFinite(b.vz, -45, 45, 0);
    b.height = clampFinite(b.height, 0.1, 12, 0.12);
    this.ballVy = clampFinite(this.ballVy, -30, 30, 0);
    this.ballSpin = clampFinite(this.ballSpin, -12, 12, 0);
  }

  private moveBall(dt: number, useBallPhysics = true) {
    const holder = this.ball.holder ? this.players.find((p) => p.id === this.ball.holder) : null;
    if (holder) {
      this.looseTime = 0;
      this.ballVy = 0;
      this.ballSpin = 0;
      this.pendingShot = null;
      this.pass = null;
      if (useBallPhysics && this.stepAuthoritativeBall(dt, holder)) return;
      const hs = Math.hypot(holder.vx, holder.vz) || 1;
      this.ball.x = holder.x + (holder.vx / hs) * 0.9;
      this.ball.z = holder.z + (holder.vz / hs) * 0.9;
      this.ball.height = 0.12;
      return;
    }

    this.looseTime += dt;
    const previousBall = { x: this.ball.x, z: this.ball.z, height: this.ball.height };

    this.lastAuthoritative = useBallPhysics && this.stepAuthoritativeBall(dt, null);
    if (!this.lastAuthoritative) {
      // Compatibilidade para replays legados, simulação rápida e navegadores
      // em que a inicialização WASM não estiver disponível.
      const cond = pitchCondition(this.weather);
      const airborne = this.ball.height > 0.14;
      if (airborne) {
        // vento empurra a bola no ar (cruzamentos longos sentem mais)
        this.ball.vx += this.wind.x * dt;
        this.ball.vz += this.wind.z * dt;
      }
      if (this.ballSpin !== 0 && airborne) {
        const vx = this.ball.vx;
        const vz = this.ball.vz;
        const sp = Math.hypot(vx, vz) || 1;
        this.ball.vx += (-vz / sp) * this.ballSpin * dt;
        this.ball.vz += (vx / sp) * this.ballSpin * dt;
        this.ballSpin *= Math.exp(-0.8 * dt);
      }
      const drag = airborne ? cond.airDrag : cond.rollDrag;
      const kd = Math.exp(-drag * dt);
      this.ball.vx *= kd;
      this.ball.vz *= kd;

      this.ball.x += this.ball.vx * dt;
      this.ball.z += this.ball.vz * dt;

      this.ballVy -= 9.81 * dt;
      this.ball.height += this.ballVy * dt;
      if (this.ball.height <= 0.12) {
        this.ball.height = 0.12;
        if (this.ballVy < -0.6) {
          this.ballVy = -this.ballVy * cond.bounce;
          this.ball.vx *= cond.skid;
          this.ball.vz *= cond.skid;
        } else {
          this.ballVy = 0;
        }
      }
    }

    // --- bloqueio da defesa e interceptação no caminho da bola ---
    if (this.tryBlock(dt)) return;

    // --- finalização em voo: resolve quando a bola chega na área do gol ---
    if (this.pendingShot && this.resolveShot(previousBall)) return;

    // lateral: sai pela linha lateral, reposição do time que não tocou por último
    if (Math.abs(this.ball.z) > FIELD_Z - 0.5) {
      this.ball.z = Math.sign(this.ball.z) * (FIELD_Z - 1);
      this.ball.vz = 0;
      this.ball.height = 0.12;
      this.ballVy = 0;
      this.pendingShot = null;
      this.restartFor(this.lastTouch === "home" ? "away" : "home", "throwIn");
      return;
    }
    // linha de fundo: escanteio se o último toque foi do time que defende aquele lado
    if (Math.abs(this.ball.x) > FIELD_X - 0.5) {
      const endSide: Side = this.ball.x > 0 ? "away" : "home"; // dono daquela meta
      this.ball.x = Math.sign(this.ball.x) * (FIELD_X - 0.6);
      this.ball.height = 0.12;
      this.ballVy = 0;
      this.pendingShot = null;
      if (this.lastTouch === endSide) {
        // desviou na defesa → escanteio para o adversário
        this.ball.z = Math.sign(this.ball.z || 1) * (FIELD_Z - 1);
        this.restartFor(endSide === "home" ? "away" : "home", "corner");
      } else {
        this.ball.z = 0;
        this.scheduleRestart(endSide);
      }
      return;
    }

    // --- domínio: quem chega perto tenta o primeiro toque ---
    let closest: SimPlayer | null = null;
    let bestD = Infinity;
    for (const p of this.players) {
      if (p.sentOff) continue;
      if (this.pass && p.id === this.pass.from && this.time < this.pass.until) continue;
      const d = Math.hypot(p.x - this.ball.x, p.z - this.ball.z);
      if (d < bestD) {
        bestD = d;
        closest = p;
      }
    }
    const ballSpeed = Math.hypot(this.ball.vx, this.ball.vz);
    const h = this.ball.height;
    // bola muito alta não pode ser dominada; entre 0.9 e 2.4 é cabeceio
    const reachable = h <= 2.4;
    if (closest && bestD < 1.9 && ballSpeed < 30 && reachable) {
      this.controlBall(closest, ballSpeed, h);
      return;
    }
    // destravamento: bola parada sem dono por muito tempo
    if (this.looseTime > 3.5 && ballSpeed < 4 && closest) {
      closest.x = this.ball.x;
      closest.z = this.ball.z;
      this.ball.holder = closest.id;
      this.possession = closest.side;
      this.lastTouch = closest.side;
      this.ball.height = 0.12;
      this.ballVy = 0;
      this.ball.vx = 0;
      this.ball.vz = 0;
      this.pass = null;
      this.looseTime = 0;
      this.decisionTimer = 0.5;
      this.synchronizeBallPhysics();
    }
  }

  /**
   * Primeiro toque. Bola forte ou alta pode escapar do controle e sobrar viva —
   * o jogador toca nela em vez de a bola simplesmente colar no pé.
   */
  private controlBall(p: SimPlayer, ballSpeed: number, h: number) {
    const isReceiver = this.pass?.to === p.id;
    // corte no caminho: adversário que chega no passe soma interceptação
    if (this.pass && !isReceiver && p.side !== this.pass.side) {
      p.interceptions++;
      this.stats[p.side].interceptions++;
    }
    // impedimento: recebe à frente da linha num passe para frente (sem isenção)
    if (this.pass && isReceiver && this.time > this.exemptUntil) {
      const forward = (p.x - this.pass.fromX) * this.pass.dir > 1;
      if (forward && isOffside(p.x, defensiveLineX(this.players, p.side), this.pass.dir)) {
        p.offsides++;
        this.stats[p.side].offsides++;
        this.pass = null;
        this.ball.vx = 0;
        this.ball.vz = 0;
        this.ballVy = 0;
        this.ball.height = 0.12;
        this.trigger(p, "protest", 1.2);
        this.pushEvent({
          minute: this.minute(),
          type: "offside",
          side: p.side,
          text: `Impedimento de ${p.name}.`,
        });
        // infração: a defesa fica com a bola no local
        this.restartFor(p.side === "home" ? "away" : "home", "throwIn");
        return;
      }
    }
    const skill = (p.passing * 0.5 + p.physical * 0.3 + p.defending * 0.2) / 100;
    const difficulty = ballSpeed / 34 + (h > 0.9 ? 0.28 : 0) + controlFailAdd(this.weather);
    const ok = isReceiver
      ? this.rnd() < 0.62 + skill * 0.42 - difficulty * 0.5
      : this.rnd() < 0.45 + skill * 0.45 - difficulty * 0.55;

    this.trigger(p, h > 0.9 ? "header" : "trap", 0.5);
    this.lastTouch = p.side;
    this.pass = null;
    this.ballVy = 0;
    this.ballSpin = 0;

    if (ok) {
      this.ball.holder = p.id;
      this.possession = p.side;
      this.ball.vx = 0;
      this.ball.vz = 0;
      this.ball.height = 0.12;
      this.looseTime = 0;
      if (isReceiver) this.stats[p.side].passesOk++;
      this.synchronizeBallPhysics();
      return;
    }

    // toque mal dado: a bola sobra à frente, ainda em disputa
    const dirx = this.attackDir(p.side);
    const spill = 2.6 + this.rnd() * 3.4;
    const ang = (this.rnd() - 0.5) * 1.4;
    this.ball.holder = null;
    this.ball.vx = Math.cos(ang) * spill * dirx;
    this.ball.vz = Math.sin(ang) * spill;
    this.ball.height = h > 0.9 ? 0.9 : 0.12;
    this.ballVy = h > 0.9 ? 1.4 : 0;
    this.looseTime = 0.4;
    const pressingSide: Side = p.side === "home" ? "away" : "home";
    this.pressSurge[pressingSide] = Math.max(this.pressSurge[pressingSide], 2.5);
    this.synchronizeBallPhysics();
  }

  /**
   * Defesa ativa: um adversário no caminho pode bloquear o chute/passe.
   * Devolve verdadeiro quando a jogada foi encerrada aqui.
   */
  private tryBlock(dt: number): boolean {
    const speed = Math.hypot(this.ball.vx, this.ball.vz);
    if (speed < 8 || this.ball.height > 1.9) return false;
    const attacking = this.pendingShot?.side ?? (this.pass ? this.lastTouch : null);
    if (!attacking) return false;

    for (const p of this.players) {
      if (p.side === attacking || p.pos === "GK" || p.sentOff) continue;
      const d = Math.hypot(p.x - this.ball.x, p.z - this.ball.z);
      if (d > 1.25) continue;
      const chance = (0.35 + (p.defending / 100) * 0.5) * Math.min(1, dt * 30);
      if (this.rnd() > chance) continue;

      this.trigger(p, this.rnd() < 0.45 ? "slide" : "block", 0.7);
      p.tackles++;
      this.lastTouch = p.side;
      const wasShot = !!this.pendingShot;
      this.pendingShot = null;
      this.pass = null;
      // rebote: a bola volta desviada e perde muita força
      const ang = Math.atan2(this.ball.vz, this.ball.vx) + Math.PI + (this.rnd() - 0.5) * 1.6;
      const back = speed * (0.2 + this.rnd() * 0.25);
      this.ball.vx = Math.cos(ang) * back;
      this.ball.vz = Math.sin(ang) * back;
      this.ballVy = 1.6 + this.rnd() * 2.4;
      this.ballSpin = 0;
      this.synchronizeBallPhysics();
      if (wasShot) {
        this.pushEvent({
          minute: this.minute(),
          type: "shot",
          side: attacking,
          text: `${p.name} se joga e bloqueia a finalização!`,
        });
      }
      return true;
    }
    return false;
  }

  /**
   * Resolve a finalização quando a bola chega à meta: gol entre as traves,
   * defesa do goleiro no plano da linha, ou segue viva para fora.
   */
  private resolveShot(
    previous = { x: this.ball.x, z: this.ball.z, height: this.ball.height },
  ): boolean {
    const s = this.pendingShot!;
    const dir = this.attackDir(s.side);
    const goalX = dir * FIELD_X;
    const gk = this.players.find((p) => p.side !== s.side && p.pos === "GK") ?? null;
    const shooter = this.players.find((p) => p.id === s.shooter) ?? null;
    const planeX = goalX - dir * 1.6;
    const crossed =
      dir > 0
        ? previous.x < planeX && this.ball.x >= planeX
        : previous.x > planeX && this.ball.x <= planeX;
    const reached = crossed || (dir > 0 ? this.ball.x >= planeX : this.ball.x <= planeX);
    if (!reached) return false;
    // Resolve no ponto exato em que a trajetória cruza o plano da meta. Assim,
    // avanços rápidos não transformam um gol em tiro de meta por tunneling.
    const segment = this.ball.x - previous.x;
    const ratio =
      crossed && Math.abs(segment) > 0.0001
        ? Math.max(0, Math.min(1, (planeX - previous.x) / segment))
        : 1;
    const crossingZ = previous.z + (this.ball.z - previous.z) * ratio;
    const crossingHeight = previous.height + (this.ball.height - previous.height) * ratio;

    // defesa do goleiro
    if (s.outcome === "saved" && gk) {
      const dive = crossingZ - gk.z;
      this.trigger(
        gk,
        Math.abs(dive) < 1.2
          ? this.rnd() < 0.5
            ? "catch"
            : "save"
          : dive > 0
            ? "diveRight"
            : "diveLeft",
        1.1,
      );
      gk.saves++;
      this.stats[s.side].onTarget++;
      this.recordShot({
        x: s.fromX,
        z: s.fromZ,
        side: s.side,
        result: "saved",
        minute: this.minute(),
        name: shooter?.name ?? "",
        xg: s.xg,
        bigChance: s.bigChance,
        bodyPart: s.bodyPart,
      });
      this.pushEvent({
        minute: this.minute(),
        type: "save",
        side: s.side,
        text: `${gk.name} faz a defesa em chute de ${shooter?.name ?? "o atacante"}.`,
      });
      this.pendingShot = null;
      // metade das defesas dá rebote; a outra o goleiro segura
      if (this.rnd() < 0.45) {
        gk.x = this.ball.x - dir * 0.4;
        gk.z = this.ball.z * 0.6;
        const ang = Math.atan2(this.ball.z, -dir) + (this.rnd() - 0.5) * 1.2;
        const back = 6 + this.rnd() * 7;
        this.ball.holder = null;
        this.ball.vx = -dir * Math.abs(Math.cos(ang) * back);
        this.ball.vz = Math.sin(ang) * back;
        this.ballVy = 1.8 + this.rnd() * 2;
        this.lastTouch = gk.side;
        this.looseTime = 0;
      } else {
        this.scheduleRestart(gk.side);
      }
      return true;
    }

    if (s.outcome === "goal") {
      if (Math.abs(crossingZ) < GOAL_Z && crossingHeight < 2.44) {
        const shotXg = s.xg;
        const shotBig = s.bigChance;
        const shotBody = s.bodyPart;
        this.pendingShot = null;
        this.scoreGoal(s.side, shooter, s.fromX, s.fromZ, shotXg, shotBig, shotBody);
        return true;
      }
      // A curva/altura física pode levar uma finalização nominalmente certeira
      // para fora ou na trave. Checa a trave antes de liberar a bola.
      return this.woodworkOrRelease(s, shooter, crossingZ, crossingHeight, dir);
    }

    // fora: checa a trave; senão a bola segue viva até a linha de fundo/lateral
    return this.woodworkOrRelease(s, shooter, crossingZ, crossingHeight, dir);
  }

  /**
   * Trave viva: chute que cruza o plano da meta raspando poste/travessão vira
   * evento "Na trave!" e segue em jogo. No integrador compatível a reflexão é
   * manual (determinística pelo estado da bola, sem consumir o rng); na
   * autoridade Rapier a colisão física já aconteceu — só registra o evento.
   */
  private woodworkOrRelease(
    s: NonNullable<MatchSim["pendingShot"]>,
    shooter: SimPlayer | null,
    crossingZ: number,
    crossingH: number,
    dir: number,
  ): boolean {
    this.pendingShot = null;
    const hit = woodworkAt(crossingZ, crossingH);
    if (!hit) return false;
    const where = hit === "post" ? "a trave" : "o travessão";
    this.pushEvent({
      minute: this.minute(),
      type: "post",
      side: s.side,
      text: `NA TRAVE! ${shooter?.name ?? "O chute"} explode em ${where}!`,
    });
    this.trigger(shooter, "protest", 1.4);
    this.recordShot({
      x: s.fromX,
      z: s.fromZ,
      side: s.side,
      result: "off",
      minute: this.minute(),
      name: shooter?.name ?? "",
      xg: s.xg,
      bigChance: true,
      bodyPart: s.bodyPart,
    });
    if (!this.lastAuthoritative) {
      const speed = Math.hypot(this.ball.vx, this.ball.vz);
      if (hit === "post") {
        this.ball.vx = -dir * Math.abs(this.ball.vx) * 0.5;
        this.ball.vz += Math.sign(crossingZ || 1) * (1.5 + Math.min(2.5, speed * 0.12));
        this.ballVy = 1.6 + Math.min(2, speed * 0.06);
      } else {
        this.ballVy = Math.abs(this.ballVy) * 0.45 + 1.2;
        this.ball.vx *= 0.55;
        this.ball.vz *= 0.55;
      }
      this.ballSpin = 0;
      this.looseTime = 0;
    }
    return false;
  }

  /** Registra o gol, celebrações e reinício. */
  private scoreGoal(
    side: Side,
    shooter: SimPlayer | null,
    fromX: number,
    fromZ: number,
    xg = 0,
    bigChance = false,
    bodyPart: "foot" | "head" = "foot",
  ) {
    this.stats[side].onTarget++;
    this.stats[side].goals++;
    this.stoppageDebt += 0.5;
    if (shooter) shooter.goals++;
    const assist = this.lastPass[side];
    if (assist && this.time - assist.time < 12 && assist.id !== shooter?.id) {
      const provider = this.players.find((p) => p.id === assist.id);
      if (provider) provider.assists++;
    }
    this.lastPass[side] = null;
    this.recordShot({
      x: fromX,
      z: fromZ,
      side,
      result: "goal",
      minute: this.minute(),
      name: shooter?.name ?? "",
      xg,
      bigChance,
      bodyPart,
    });
    this.scorers.push({ minute: this.minute(), side, name: shooter?.name ?? "" });
    const celeb = this.rnd();
    this.trigger(
      shooter,
      celeb < 0.34 ? "kneeSlide" : celeb < 0.67 ? "celebrateRun" : "celebrate",
      6,
    );
    for (const m of this.players) {
      if (m.side === side && m.id !== shooter?.id)
        this.trigger(m, m.pos === "GK" ? "celebrate" : "hug", 5.2);
      else if (m.side !== side) this.trigger(m, "dejected", 4.4);
    }
    this.pushEvent({
      minute: this.minute(),
      type: "goal",
      side,
      text: `GOL! ${shooter?.name ?? "O atacante"} marca para o ${this.setup(side).short}!`,
    });
    this.kickoff(side === "home" ? "away" : "home");
  }

  /** entrega a bola parada ao jogador mais próximo do lado indicado */
  private restartFor(side: Side, kind: "throwIn" | "corner") {
    // escanteio é disputado na área, com goleiro, zaga e cabeçada
    if (kind === "corner") {
      this.setupCorner(side);
      return;
    }
    let best: SimPlayer | null = null;
    let bestD = Infinity;
    for (const p of this.players) {
      if (p.side !== side || p.pos === "GK") continue;
      const d = Math.hypot(p.x - this.ball.x, p.z - this.ball.z);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    if (!best) return;
    best.x = this.ball.x;
    best.z = this.ball.z;
    best.vx = 0;
    best.vz = 0;
    this.ball.holder = best.id;
    this.possession = side;
    this.lastTouch = side;
    this.ball.vx = 0;
    this.ball.vz = 0;
    this.ballVy = 0;
    this.ballSpin = 0;
    this.pendingShot = null;
    this.pass = null;
    this.looseTime = 0;
    this.restartTimer = 0.8;
    this.trigger(best, kind, 0.9);
    // não existe impedimento recebendo direto do lateral
    this.exemptUntil = this.time + 1.5;
    this.synchronizeBallPhysics();
  }

  private dribble(holder: SimPlayer, dt: number) {
    if (this.restartTimer > 0) {
      const k = Math.exp(-7 * dt);
      holder.vx *= k;
      holder.vz *= k;
      return;
    }
    const dir = this.attackDir(holder.side);
    const targetX = dir * FIELD_X;
    const dx = targetX - holder.x;
    const dz = -holder.z * 0.25 + Math.sin(this.time * 0.9 + holder.number) * 4;
    const d = Math.hypot(dx, dz) || 1;
    const speed = (2.35 + (holder.pace / 100) * 3.55) * (0.82 + (holder.stamina / 100) * 0.18);
    const targetVx = (dx / d) * speed;
    const targetVz = (dz / d) * speed;
    const k = 1 - Math.exp(-3.4 * dt);
    holder.vx += (targetVx - holder.vx) * k;
    holder.vz += (targetVz - holder.vz) * k;
    holder.x += holder.vx * dt;
    holder.z += holder.vz * dt;
    holder.x = Math.max(-FIELD_X + 1, Math.min(FIELD_X - 1, holder.x));
    holder.z = Math.max(-FIELD_Z + 1, Math.min(FIELD_Z - 1, holder.z));
  }

  private pressure(holder: SimPlayer, dt: number) {
    const { opp, dist } = this.nearestOpponent(holder);
    if (!opp || dist > 2.2 || this.restartTimer > 0) return;
    const press = 0.55 + this.setup(opp.side).tactics.pressing * 0.22;
    let support = 0;
    for (const defender of this.players) {
      if (defender.side !== opp.side || defender.id === opp.id) continue;
      if (Math.hypot(defender.x - holder.x, defender.z - holder.z) < 3.2) support += 1;
    }
    const overload = 1 + Math.min(2, support) * 0.28;
    const fatigue = 0.55 + (opp.stamina / 100) * 0.45;
    // mando e moral pesam no duelo: quem está confiante ganha mais divididas
    const ctx =
      duelMult({ home: opp.side === "home", morale: this.setup(opp.side).morale ?? 70 }) /
      duelMult({ home: holder.side === "home", morale: this.setup(holder.side).morale ?? 70 });
    const chance =
      ((opp.defending * 0.7 + opp.physical * 0.3) /
        (holder.pace * 0.45 + holder.physical * 0.3 + holder.passing * 0.25 + 60)) *
      press *
      overload *
      fatigue *
      ctx *
      dt *
      1.6;
    if (this.rnd() < chance) {
      const slide = this.rnd() < 0.4;
      this.trigger(opp, slide ? "slide" : "tackle", slide ? 1.0 : 0.6);
      opp.tackles++;
      this.trigger(holder, "duel", 0.5);
      if (this.rnd() < 0.22 * foulMult(this.weather)) {
        this.trigger(holder, "protest", 1.4);
        this.stats[opp.side].fouls++;
        holder.foulsWon++;
        const dirH = this.attackDir(holder.side);
        const goalX = dirH * FIELD_X;
        const distGoal = Math.hypot(goalX - holder.x, holder.z);
        const between = this.players.filter(
          (o) =>
            o.side === opp.side &&
            !o.sentOff &&
            o.pos !== "GK" &&
            (o.x - holder.x) * dirH > -2 &&
            Math.hypot(goalX - o.x, o.z) < distGoal,
        ).length;
        const foul: FoulInput = {
          slide,
          tactical: holder.x * dirH < -8 && Math.hypot(holder.vx, holder.vz) > 5,
          goalDenied: distGoal < 16 && between <= 1,
          rapSheet: opp.yellows,
          ref: this.ref,
          rnd: this.rnd,
        };
        this.pushEvent({
          minute: this.minute(),
          type: "foul",
          side: opp.side,
          text: `Falta de ${opp.name} sobre ${holder.name}.`,
        });
        const card = cardForFoul(foul);
        if (card === "red") this.sendOff(opp, "entrada violenta");
        else if (card === "yellow") this.issueYellow(opp);
        // lesão no lance: carrinho e fadiga pesam
        const hurtP = (slide ? 0.05 : 0.015) * (holder.stamina < 40 ? 1.8 : 1);
        if (this.rnd() < hurtP) this.injure(holder, "na dividida");
        // reinício pela zona da falta
        if (this.inBox(holder.x, holder.z, opp.side)) this.setupPenalty(holder.side);
        else if (distGoal < 32) this.setupDirectFK(holder.side, holder.x, holder.z);
        else this.restartTimer = 1.4;
        return;
      }
      this.ball.holder = opp.id;
      this.possession = opp.side;
      this.lastTouch = opp.side;
      this.decisionTimer = 0.4;
      this.trigger(opp, "intercept", 0.5);
      if (this.rnd() < 0.008) this.injure(holder, "na dividida");
    }
  }

  private decide(holder: SimPlayer) {
    const dir = this.attackDir(holder.side);
    const goalX = dir * FIELD_X;
    const distGoal = Math.hypot(goalX - holder.x, holder.z);
    const { dist: pressDist } = this.nearestOpponent(holder);
    const mentality = this.setup(holder.side).tactics.mentality;

    // Take an open chance before dribbling into the keeper and a crowded goalmouth.
    const chance = xgForShot({
      dist: distGoal,
      wide: Math.abs(holder.z),
      bodyPart: "foot",
      pressDist,
      onRun: Math.hypot(holder.vx, holder.vz) > 5,
    });
    const shootUrge =
      distGoal < 30
        ? Math.min(0.72, chance * 2.4 + (distGoal < 9 ? 0.08 : 0)) *
          (0.8 + holder.shooting / 500) *
          (0.9 + mentality * 0.05)
        : 0;

    if (holder.pos !== "GK" && this.rnd() < shootUrge) {
      this.shoot(holder, distGoal);
      return;
    }

    const mates = this.players.filter(
      (p) => p.side === holder.side && p.id !== holder.id && !p.sentOff,
    );
    let best: SimPlayer | null = null;
    let bestScore = -Infinity;
    const defenders = this.players.filter((p) => p.side !== holder.side && !p.sentOff);
    const receiversBuffer = this.#passLaneReceivers.pack(mates);
    const defendersBuffer = this.#passLaneDefenders.pack(defenders);
    let lanes: Float64Array;
    try {
      if (this.#passLaneIntoKernel) {
        const written = this.#passLaneIntoKernel(
          holder.x,
          holder.z,
          receiversBuffer,
          defendersBuffer,
          this.#passLaneOutput,
        );
        if (written !== mates.length * 3) throw new Error("Invalid perception output");
        lanes = this.#passLaneOutput;
      } else lanes = this.passLaneKernel(holder.x, holder.z, receiversBuffer, defendersBuffer);
      for (let index = 0; index < mates.length * 3; index++)
        if (!Number.isFinite(lanes[index])) throw new Error("Invalid perception value");
    } catch {
      this.passLaneKernel = evaluatePassLanesFallback;
      this.#passLaneIntoKernel = evaluatePassLanesIntoFallback;
      // The fallback has proven numerical parity with the selected perception
      // revision. Keep the recorded contract stable across a recoverable trap.
      evaluatePassLanesIntoFallback(
        holder.x,
        holder.z,
        receiversBuffer,
        defendersBuffer,
        this.#passLaneOutput,
      );
      lanes = this.#passLaneOutput;
    }
    for (const [index, m] of mates.entries()) {
      const dist = lanes[index * 3]!;
      if (dist < 4 || dist > 42) continue;
      const forward = (m.x - holder.x) * dir;
      const cover = lanes[index * 3 + 1]!;
      const laneRisk = lanes[index * 3 + 2]!;
      const score =
        forward * (0.7 + mentality * 0.12) + cover * 1.7 - dist * 0.32 - laneRisk + this.rnd() * 8;
      if (score > bestScore) {
        bestScore = score;
        best = m;
      }
    }

    if (!best) return;
    const rawDist = Math.hypot(best.x - holder.x, best.z - holder.z);
    const isBackPass = (best.x - holder.x) * dir < -2;
    if (isBackPass) {
      const pressingSide: Side = holder.side === "home" ? "away" : "home";
      this.pressSurge[pressingSide] = Math.max(this.pressSurge[pressingSide], 1.6);
    }
    const power = Math.min(31, 10 + rawDist * 0.8);
    // passe na frente: mira onde o companheiro estará quando a bola chegar
    const flight = rawDist / power;
    const aimX = best.x + best.vx * flight * 0.8;
    const aimZ = best.z + best.vz * flight * 0.8;

    const success = Math.min(0.96, (holder.passing / 100) * (1 - rawDist / 90) + 0.25);
    const errRoll = this.rnd() * passErrMult(this.weather);
    const err = success > errRoll ? 0 : (this.rnd() - 0.5) * 12;
    const dx = aimX - holder.x;
    const dz = aimZ - holder.z;
    const d = Math.hypot(dx, dz) || 1;
    const wide = Math.abs(holder.z) > FIELD_Z * 0.55 && Math.abs(best.x - dir * FIELD_X) < 30;
    const lofted = wide || rawDist > 22;
    this.trigger(
      holder,
      wide ? "cross" : rawDist > 24 ? "passLong" : "pass",
      rawDist > 24 ? 0.85 : 0.6,
    );
    holder.passes++;
    this.stats[holder.side].passes++;
    this.lastPass[holder.side] = { id: holder.id, time: this.time };
    this.ball.holder = null;
    this.lastTouch = holder.side;
    this.pass = {
      to: best.id,
      from: holder.id,
      until: this.time + 0.45,
      fromX: holder.x,
      dir,
      side: holder.side,
    };
    this.ball.vx = (dx / d) * power + err * 0.18;
    this.ball.vz = (dz / d) * power + err;
    if (lofted) {
      // bola alçada: sobe e cai perto do destino
      const t = Math.max(0.4, d / power);
      this.ball.height = 0.35;
      this.ballVy = 4.905 * t;
      this.ballSpin = wide ? (this.rnd() - 0.5) * 5 : 0;
    } else {
      this.ball.height = 0.12;
      this.ballVy = 0;
      this.ballSpin = 0;
    }
    this.synchronizeBallPhysics();
  }

  private shoot(holder: SimPlayer, distGoal: number) {
    const side = holder.side;
    const dir = this.attackDir(side);
    this.stats[side].shots++;
    holder.shots++;
    const gk = this.players.find((p) => p.side !== side && p.pos === "GK");
    const gkSkill = gk ? gk.defending * 0.7 + gk.physical * 0.3 : 60;
    const { dist: pressD } = this.nearestOpponent(holder);
    const xg = xgForShot({
      dist: distGoal,
      wide: Math.abs(holder.z),
      bodyPart: "foot",
      pressDist: pressD,
      onRun: Math.hypot(holder.vx, holder.vz) > 5,
    });
    this.stats[side].xg += xg;
    holder.xg += xg;

    // 1) decide o desfecho ANTES da trajetória, para que o visual corresponda ao evento
    const probabilities = shotProbabilities({
      xg,
      shooting: holder.shooting - Math.max(0, 55 - holder.stamina) * 0.08,
      goalkeeper: gkSkill,
      distance: distGoal,
    });
    const onTarget = this.rnd() < probabilities.onTarget;
    const outcome: "goal" | "saved" | "off" = !onTarget
      ? "off"
      : this.rnd() < probabilities.goalGivenTarget
        ? "goal"
        : "saved";

    const roll = this.rnd();
    this.trigger(
      holder,
      distGoal > 22
        ? "shotPower"
        : roll < 0.12
          ? "chip"
          : roll < 0.24
            ? "volley"
            : roll < 0.32
              ? "bicycle"
              : roll < 0.6
                ? "shotPlaced"
                : "shot",
      0.8,
    );
    this.ball.holder = null;
    this.lastTouch = side;
    // reação ao chute: adversários próximos congelam por uma fração de segundo
    for (const p of this.players) {
      if (p.side === side || p.pos === "GK") continue;
      if (Math.hypot(p.x - holder.x, p.z - holder.z) < 7) {
        this.reactionUntil.set(p.id, this.time + 0.45 + this.rnd() * 0.2);
      }
    }

    // 2) trajetória física: a bola voa com arco e o desfecho só acontece na meta
    const inside = (this.rnd() - 0.5) * GOAL_Z * 1.5; // dentro das traves
    const outsideZ = Math.sign(this.rnd() - 0.5 || 1) * (GOAL_Z + 1.2 + this.rnd() * GOAL_Z * 1.6);
    const targetZ = outcome === "off" ? outsideZ : inside;
    // altura de chegada: no alvo sempre abaixo do travessão; fora pode ir por cima
    const targetH =
      outcome === "off" && this.rnd() < 0.42 ? 3.0 + this.rnd() * 1.8 : 0.25 + this.rnd() * 1.8;

    const dx = dir * FIELD_X - holder.x;
    const dz = targetZ - holder.z;
    const d = Math.hypot(dx, dz) || 1;
    const power = 24 + (holder.shooting / 100) * 13 + this.rnd() * 6;
    this.ball.vx = (dx / d) * power;
    this.ball.vz = (dz / d) * power;
    this.ball.height = 0.25;
    const flight = Math.max(0.15, d / power);
    // vy resolvido pela balística: sai baixo e chega na altura pretendida
    this.ballVy = (targetH - 0.25) / flight + 4.905 * flight;
    this.ballSpin = (this.rnd() - 0.5) * (distGoal > 20 ? 7 : 3);

    this.pendingShot = {
      side,
      shooter: holder.id,
      outcome,
      fromX: holder.x,
      fromZ: holder.z,
      targetZ,
      xg,
      bigChance: xg > 0.25,
      bodyPart: "foot",
    };
    if (gk && outcome === "saved") {
      const dive = targetZ - gk.z;
      this.trigger(gk, Math.abs(dive) < 1.15 ? "save" : dive > 0 ? "diveRight" : "diveLeft", 1.15);
    }
    this.restartTimer = 0.35;

    if (outcome === "off") {
      // parte das finalizações erradas desvia na defesa e vira escanteio
      if (this.rnd() < 0.22) this.lastTouch = side === "home" ? "away" : "home";
      this.recordShot({
        x: holder.x,
        z: holder.z,
        side,
        result: "off",
        minute: this.minute(),
        name: holder.name,
        xg,
        bigChance: xg > 0.25,
        bodyPart: "foot",
      });
      this.pushEvent({
        minute: this.minute(),
        type: "shot",
        side,
        text: `${holder.name} finaliza para fora.`,
      });
    }
    this.synchronizeBallPhysics();
  }

  private scheduleRestart(side: Side) {
    const gk = this.players.find((p) => p.side === side && p.pos === "GK");
    if (!gk) return;
    this.ball.holder = gk.id;
    this.possession = side;
    this.lastTouch = side;
    this.ball.vx = 0;
    this.ball.vz = 0;
    this.ball.height = 0.12;
    this.ballVy = 0;
    this.ballSpin = 0;
    this.pendingShot = null;
    this.pass = null;
    this.looseTime = 0;
    this.restartTimer = 1.5;
    this.decisionTimer = 1.2;
    this.trigger(gk, this.rnd() < 0.5 ? "goalKick" : "distribute", 1.1);
    this.synchronizeBallPhysics();
  }

  possessionPct(): [number, number] {
    const h = this.stats.home.possessionTicks;
    const a = this.stats.away.possessionTicks;
    const total = h + a || 1;
    return [Math.round((h / total) * 100), Math.round((a / total) * 100)];
  }

  /**
   * Gera contexto visual deterministico para todos os jogadores.
   *
   * Esta funcao nao afeta o estado da simulacao (placar, estatisticas, etc.)
   * e e usada apenas para alimentar o sistema visual com dados realistas.
   *
   * @returns Dados visuais versionados para gravar em replays
   */
  generateVisualContext(): VersionedVisualData {
    const actionContexts: (ActionContext | null)[] = [];
    const contactContexts: (ContactContext | null)[] = [];

    for (const p of this.players) {
      // Gera ActionContext
      const actionCtx = this.generatePlayerActionContext(p);
      actionContexts.push(actionCtx);

      // Gera ContactContext
      const contactCtx = this.generatePlayerContactContext(p);
      contactContexts.push(contactCtx);
    }

    return {
      version: VISUAL_CONTEXT_VERSION,
      actionContexts,
      contactContexts,
      metadata: {
        simTime: this.time,
      },
    };
  }

  /**
   * Gera ActionContext para um jogador.
   * Deterministico: mesmas entradas produzem mesmas saidas.
   */
  private generatePlayerActionContext(p: SimPlayer): ActionContext {
    // Se nao tem acao, retorna contexto vazio
    if (!p.action) {
      return emptyActionContext();
    }

    // Calcula progresso da acao
    const u = p.actionDur > 0 ? Math.min(1, p.actionT / p.actionDur) : 0;
    const phase = getActionPhase(1 - u); // Inverte para ir de anticipation -> recovery

    // Determina pe dominante com base no pid (deterministico)
    const dominantFoot = getDominantFoot(p.pid);

    // Para acoes de chute, determine qual pe usar
    // Regra: se for acao de chute e o jogador estiver se movendo para a direita,
    // usa o pe esquerdo, senao o dominante
    const usedFoot = this.determineUsedFoot(p, dominantFoot);

    // Determina alvo da acao
    const target = this.determineActionTarget(p);

    // Determina ponto de contato
    const contactPoint = this.determineContactPoint(p);

    // Direcao do movimento (radianos)
    const direction = Math.atan2(p.vz, p.vx);

    // Intensidade baseada na acao e stamina
    const intensity = this.calculateActionIntensity(p);

    // Resultado visual (por enquanto sempre "success" para acoes ativas)
    const result: VisualResult = p.actionT > 0 ? "success" : "none";

    // Reacao baseada na fase
    const reaction: ReactionType = this.determineReaction(p, phase);

    return {
      action: p.action,
      actionT: p.actionT,
      actionDur: p.actionDur,
      phase,
      dominantFoot,
      usedFoot,
      target,
      contactPoint,
      direction,
      intensity,
      result,
      reaction,
    };
  }

  /**
   * Determina qual pe usar para a acao.
   */
  private determineUsedFoot(p: SimPlayer, dominantFoot: DominantFoot): DominantFoot {
    // Para goleiros, sempre usa o pe mais proximo da bola
    if (p.pos === "GK") {
      const ballDx = this.ball.x - p.x;
      return ballDx < 0 ? "left" : "right";
    }

    // Para acoes de chute, usa o pe nao-dominante se estiver virando para esse lado
    if (
      p.action &&
      ["shot", "shotPower", "shotPlaced", "pass", "passLong", "cross"].includes(p.action)
    ) {
      // Se o jogador estiver se movendo para a esquerda, usa pe direito, e vice-versa
      if (p.vx < -0.1) {
        return dominantFoot === "left" ? "right" : "left";
      }
      if (p.vx > 0.1) {
        return dominantFoot === "right" ? "left" : "right";
      }
    }

    return dominantFoot;
  }

  /**
   * Determina o alvo da acao.
   */
  private determineActionTarget(p: SimPlayer): { x: number; z: number } | null {
    // Se tem a bola, o alvo depende da acao
    if (p.id === this.ball.holder) {
      // Para chutes, o alvo e o gol
      if (p.action && ["shot", "shotPower", "shotPlaced"].includes(p.action)) {
        const sideDir = p.side === "home" ? 1 : -1;
        return { x: FIELD_X * sideDir, z: 0 };
      }

      // Para passes, o alvo e um jogador do mesmo time
      if (p.action && ["pass", "passLong", "cross"].includes(p.action)) {
        const teammate = this.players.find(
          (t) => t.side === p.side && t.id !== p.id && t.pos !== "GK",
        );
        if (teammate) {
          return { x: teammate.x, z: teammate.z };
        }
      }

      // Para dribles, o alvo e na direcao do movimento
      if (p.vx !== 0 || p.vz !== 0) {
        return { x: p.x + p.vx * 2, z: p.z + p.vz * 2 };
      }
    }

    // Se nao tem alvo especifico, usa a bola
    if (this.ball.holder) {
      const holder = this.players.find((pl) => pl.id === this.ball.holder);
      if (holder) {
        return { x: holder.x, z: holder.z };
      }
    }

    // Ultimo caso: a posicao da bola
    return { x: this.ball.x, z: this.ball.z };
  }

  /**
   * Determina o ponto de contato.
   */
  private determineContactPoint(p: SimPlayer): { x: number; z: number; height: number } | null {
    // Se a acao envolve contato com a bola
    if (p.action && ["trap", "header", "volley", "firstTime"].includes(p.action)) {
      return { x: this.ball.x, z: this.ball.z, height: this.ball.height };
    }

    // Se e uma acao de chute
    if (p.action && ["shot", "shotPower", "shotPlaced", "pass", "cross"].includes(p.action)) {
      // Ponto de contato e slightly a frente do pe
      const footOffset = p.action && p.action.includes("shot") ? 0.3 : 0.15;
      const usedFoot = this.determineUsedFoot(p, getDominantFoot(p.pid));
      const footSign = usedFoot === "left" ? -1 : 1;
      return {
        x: p.x + footSign * footOffset,
        z: p.z,
        height: 0.1,
      };
    }

    // Se e uma acao de defesa
    if (p.action && ["tackle", "slide", "block", "intercept"].includes(p.action)) {
      // Ponto de contato e o adversario ou a bola
      if (this.ball.holder) {
        const holder = this.players.find((pl) => pl.id === this.ball.holder);
        if (holder) {
          return { x: holder.x, z: holder.z, height: 0.5 };
        }
      }
      return { x: this.ball.x, z: this.ball.z, height: 0 };
    }

    return null;
  }

  /**
   * Calcula intensidade da acao.
   */
  private calculateActionIntensity(p: SimPlayer): number {
    // Baseada no tipo de acao
    if (!p.action) return 0;

    // Acoes de chute tem alta intensidade
    if (["shot", "shotPower", "shotPlaced"].includes(p.action)) {
      return 0.8 + (p.shooting / 100) * 0.2;
    }

    // Acoes de defesa
    if (["tackle", "slide", "block"].includes(p.action)) {
      return 0.7 + (p.defending / 100) * 0.2;
    }

    // Acoes de passe
    if (["pass", "passLong", "cross"].includes(p.action)) {
      return 0.6 + (p.passing / 100) * 0.2;
    }

    // Acoes de goleiro
    if (["save", "saveHigh", "diveLeft", "diveRight"].includes(p.action)) {
      return 0.9;
    }

    // Outras acoes
    return 0.5;
  }

  /**
   * Determina reacao baseada na fase.
   */
  private determineReaction(p: SimPlayer, phase: string): ReactionType {
    // Durante a acao
    if (phase === "action") {
      // Se estah se movendo rápido, pode precisar de balance
      const speed = Math.hypot(p.vx, p.vz);
      if (speed > 5) return "balance";
      return "none";
    }

    // No contato
    if (phase === "contact") {
      // Se e uma acao de defesa
      if (p.action && ["tackle", "slide", "block", "intercept"].includes(p.action)) {
        return "push";
      }
      return "none";
    }

    // Follow-through
    if (phase === "followThrough") {
      return "recovery";
    }

    // Recovery
    if (phase === "recovery") {
      return "balance";
    }

    return "none";
  }

  /**
   * Gera ContactContext para um jogador.
   * Deterministico: mesmas entradas produzem mesmas saidas.
   */
  private generatePlayerContactContext(p: SimPlayer): ContactContext {
    // Determina tipo de contato
    const contactType = this.determineContactType(p);

    // Se nao tem contato
    if (contactType === "none") {
      return emptyContactContext();
    }

    // Determina qual pe esta em contato com o chao
    const groundFoot = this.determineGroundFoot(p);

    // Forca do contato (0-1)
    const force = this.calculateContactForce(p, contactType);

    // Ponto do corpo em contato
    const bodyPoint = this.determineBodyPoint(p, contactType);

    // Jogador em contato (se aplicavel)
    const contactPlayerId = this.determineContactPlayer(p);

    // Velocidade relativa
    const relativeVelocity = this.calculateRelativeVelocity(p, contactPlayerId);

    return {
      type: contactType,
      groundFoot,
      force,
      bodyPoint,
      contactPlayerId,
      relativeVelocity,
    };
  }

  /**
   * Determina tipo de contato.
   */
  private determineContactType(p: SimPlayer): ContactType {
    // Se tem a bola
    if (p.id === this.ball.holder) {
      return "ball";
    }

    // Se a bola esta no ar e o jogador esta olhando para ela
    if (this.ball.height > 0.5) {
      const distToBall = Math.hypot(p.x - this.ball.x, p.z - this.ball.z);
      if (distToBall < 3) {
        return "airBall";
      }
      return "none";
    }

    // Se a bola esta no chao e proxima
    if (this.ball.height <= 0.5) {
      const distToBall = Math.hypot(p.x - this.ball.x, p.z - this.ball.z);
      if (distToBall < 1.5) {
        // Se o jogador estiver em acao de contato
        if (p.action && ["trap", "tackle", "intercept"].includes(p.action)) {
          return "groundBall";
        }
        return "ball";
      }
    }

    // Se tem acao de slide/tackle, assume contato com jogador
    if (p.action && ["tackle", "slide"].includes(p.action)) {
      return "player";
    }

    // Contato com o chao
    return "ground";
  }

  /**
   * Determina qual pe esta em contato com o chao.
   */
  private determineGroundFoot(p: SimPlayer): DominantFoot | null {
    // Durante locomocao, alternar os pes com base no tempo
    // Usa o pid como seed para determinismo
    const seed = this.hashString(p.pid);
    const timeFactor = Math.floor(this.time * 10) % 100;
    const combined = (seed + timeFactor) % 100;

    // Se o valor for par, pe direito no chao, senao pe esquerdo
    // (simplificacao: nao estamos Fazendo IK completo aqui)
    if (p.vx !== 0 || p.vz !== 0) {
      // Em movimento: alternar
      return combined % 2 === 0 ? "right" : "left";
    }

    // Parado: ambos os pes no chao
    return null;
  }

  /**
   * Funcao hash simples para strings.
   */
  private hashString(s: string): number {
    let hash = 0;
    for (let i = 0; i < s.length; i++) {
      hash = (hash * 31 + s.charCodeAt(i)) | 0;
    }
    return hash;
  }

  /**
   * Calcula forca do contato.
   */
  private calculateContactForce(p: SimPlayer, contactType: ContactType): number {
    // Contato com a bola
    if (contactType === "ball" || contactType === "groundBall") {
      const speed = Math.hypot(p.vx, p.vz);
      return Math.min(1, speed / 8);
    }

    // Contato com jogador
    if (contactType === "player") {
      return 0.8;
    }

    // Contato com o chao
    if (contactType === "ground") {
      const speed = Math.hypot(p.vx, p.vz);
      return Math.min(1, speed / 5);
    }

    return 0;
  }

  /**
   * Determina ponto do corpo em contato.
   */
  private determineBodyPoint(p: SimPlayer, contactType: ContactType): BodyContactPoint | null {
    if (contactType === "ball" || contactType === "groundBall") {
      if (p.pos === "GK") {
        return (this.hashString(`${this.matchSeed}:${p.pid}`) & 1) === 0 ? "handLeft" : "handRight";
      }
      return this.determineUsedFoot(p, getDominantFoot(p.pid)) === "left"
        ? "footLeft"
        : "footRight";
    }

    if (contactType === "player") {
      if (p.action === "tackle") {
        return "shoulderRight";
      }
      if (p.action === "slide") {
        return "kneeRight";
      }
    }

    if (contactType === "ground") {
      const groundFoot = this.determineGroundFoot(p);
      if (groundFoot) {
        return groundFoot === "left" ? "footLeft" : "footRight";
      }
    }

    return null;
  }

  /**
   * Determina jogador em contato.
   */
  private determineContactPlayer(p: SimPlayer): string | null {
    if (p.pos === "GK" && this.ball.height < 1) {
      // Goleiro em contato com atacante
      const attacker = this.players.find(
        (t) => t.side !== p.side && Math.hypot(t.x - p.x, t.z - p.z) < 2,
      );
      if (attacker) return attacker.id;
    }

    if (p.action && ["tackle", "slide"].includes(p.action)) {
      const opponent = this.players.find(
        (t) => t.side !== p.side && Math.hypot(t.x - p.x, t.z - p.z) < 2,
      );
      if (opponent) return opponent.id;
    }

    return null;
  }

  /**
   * Calcula velocidade relativa.
   */
  private calculateRelativeVelocity(
    p: SimPlayer,
    contactPlayerId: string | null,
  ): { vx: number; vz: number } | null {
    if (!contactPlayerId) return null;

    const other = this.players.find((t) => t.id === contactPlayerId);
    if (!other) return null;

    return {
      vx: p.vx - other.vx,
      vz: p.vz - other.vz,
    };
  }
}
