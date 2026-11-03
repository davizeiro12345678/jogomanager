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
import { MatchVisualContextComputer } from "./sim-visual-context";
import type { PlayerAction } from "./animation";
import { calculatePlayerRatings } from "./sim-ratings";
import { makeRng } from "./rng";
import { physiqueFor } from "./player-physique";
import { matchAttributes } from "./match-readiness";

import {
  BOX_DEPTH,
  BOX_HALF,
  PENALTY_DIST,
  clockText,
  type MatchPhase,
  passErrMult,
  type RefProfile,
  refFor,
  type ShootoutKick,
  shootoutWinner,
  solvePenalty,
  staminaDrainMult,
  type WeatherKind,
  xgForShot,
} from "./sim-rules";
import { pitchCondition, windFor, type WindVector } from "./ball-climate";
import { athleteContact, athleteRemainder, restoreAthleteRemainder } from "./athlete-dynamics";
import { HIGH_FIDELITY_PHYSICS_STEP } from "./physics-quality";
import type { Player, MatchEventLog } from "./types";
import { type VersionedVisualData } from "./visual-context";
import type { CanonicalBallPhysicsState } from "./visual-ball";
import type {
  BallPhysicsAuthority,
  RapierBallHolder,
  RapierBallState,
} from "./rapier-ball-authority";

// Medidas do campo vivem em sim-rules.ts; reexportadas aqui por compatibilidade.
import { FIELD_X, FIELD_Z, GOAL_Z } from "./sim-rules";
export { FIELD_X, FIELD_Z, GOAL_Z };
import { emptyStats } from "./sim-contracts";

import * as setPieces from "./sim-set-pieces";
import * as discipline from "./sim-discipline";
import * as teamAi from "./sim-team-ai";
import * as ballDuels from "./sim-ball-duels";
import { bodyContactShare, quadraticDragDeceleration, settlesOnTurf } from "./match-physics-extras";
import type {
  Side,
  TeamTalkKind,
  SimPlayer,
  ShotRecord,
  PlayerRating,
  TeamSetup,
  MatchStats,
  Scorer,
  MatchCheckpoint,
} from "./sim-contracts";
export * from "./sim-contracts";

const CHECKPOINT_EXTERNAL = new Set(["rnd", "passLaneKernel", "ballPhysics"]);

function clampFinite(value: number, lower: number, upper: number, fallback: number): number {
  if (!Number.isFinite(value)) value = fallback;
  return value <= lower ? lower : value >= upper ? upper : value;
}

export class MatchSim {
  readonly #visualContextComputer = new MatchVisualContextComputer();
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
  /** @internal */ lastPass: Record<Side, { id: string; time: number } | null> = {
    home: null,
    away: null,
  };
  /** jogadores em "freeze" curto após um chute próximo */
  /** @internal */ reactionUntil = new Map<string, number>();
  private mentalityCache: Record<Side, number> | null = null;
  /** Reused every tick to avoid allocating/sorting temporary chase arrays. */
  /** @internal */ chaseIds = new Set<string>();
  finished = false;
  lastEventId = 0;
  /** @internal */ decisionTimer = 0;
  /** @internal */ rnd: ReturnType<typeof makeRng>;
  /** @internal */ restartTimer = 0;
  /** tempo com a bola solta, usado para destravar a jogada */
  /** @internal */ looseTime = 0;
  /** Pressão coletiva curta disparada por erro técnico ou passe para trás. */
  /** @internal */ pressSurge: Record<Side, number> = { home: 0, away: 0 };
  /** último lado que tocou na bola — define lateral, escanteio e tiro de meta */
  /** @internal */ lastTouch: Side = "home";
  /** velocidade vertical da bola (m/s) — a altura passa a ser física de verdade */
  /** @internal */ ballVy = 0;
  /** curva lateral (efeito Magnus) aplicada enquanto a bola voa */
  /** @internal */ ballSpin = 0;
  /**
   * Autoridade física opcional da bola, injetada apenas pela partida ao vivo.
   * A simulação ainda decide posse, regras e eventos; o Rapier integra a
   * trajetória entre essas decisões.
   */
  private ballPhysics: BallPhysicsAuthority | null = null;
  /** finalização em voo: só vira gol/defesa quando a bola chega lá */
  /** @internal */ pendingShot: {
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
  /** @internal */ pass: {
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
  /** @internal */ readonly matchSeed: string;
  /** qual integrador moveu a bola no último tick (trave só reflete no compat) */
  /** @internal */ lastAuthoritative = false;
  /** papo de intervalo do usuário: um por lado e por partida */
  private talkUsed: Record<Side, boolean> = { home: false, away: false };
  /** empurrão da torcida: uma vez por partida */
  private crowdPushDone = false;
  /** acréscimos sorteados do 1º, 2º tempo e 2º tempo da prorrogação */
  private added1 = 0;
  private added2 = 0;
  private addedET = 0;
  /** dívida de acréscimo acumulada por gols, subs, lesões e expulsões */
  /** @internal */ stoppageDebt = 0;
  /** relógio congelado durante intervalo e pausa da prorrogação */
  private freezeT = 0;
  /** até quando (this.time) não há impedimento (isenção pós-bola parada) */
  /** @internal */ exemptUntil = 0;
  /** bola parada armada: cobra após a barreira se posicionar */
  /** @internal */ setPiece: {
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
  /** @internal */ aiTweakMin: Record<Side, number> = { home: 0, away: 0 };
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
    return calculatePlayerRatings(this.players, this.subsOut, this.minute(), this.stats);
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

  /** @internal */ setup(side: Side) {
    return side === "home" ? this.home : this.away;
  }

  /** @internal */ attackDir(side: Side) {
    return side === "home" ? 1 : -1;
  }

  /** @internal */ mentalityShift(side: Side) {
    if (this.mentalityCache) return this.mentalityCache[side];
    const h = (this.home.tactics.mentality - 2) * 6 * 1;
    const a = (this.away.tactics.mentality - 2) * 6 * -1;
    this.mentalityCache = { home: h, away: a };
    return this.mentalityCache[side];
  }

  /** @internal */ pushEvent(e: MatchEventLog) {
    this.events.push(e);
    this.lastEventId++;
    if (this.events.length > 80) this.events.shift();
  }

  /** @internal */ recordShot(shot: ShotRecord) {
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
      this.halfTimeRead("home");
      this.halfTimeRead("away");
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

  /** @internal */ halfTimeRead(side: Side) {
    teamAi.halfTimeRead(this, side);
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

  /** @internal */ issueYellow(p: SimPlayer) {
    discipline.issueYellow(this, p);
  }

  /** @internal */ sendOff(p: SimPlayer, why: string) {
    discipline.sendOff(this, p, why);
  }

  /** @internal */ injure(p: SimPlayer, cause: string) {
    discipline.injure(this, p, cause);
  }

  /* ---------------- IA do treinador ---------------- */

  /** @internal */ aiManage(side: Side) {
    teamAi.aiManage(this, side);
  }

  /* ---------------- bolas paradas ---------------- */

  /** @internal */ inBox(x: number, z: number, defending: Side): boolean {
    const gx = defending === "home" ? -FIELD_X : FIELD_X;
    return Math.abs(x - gx) < BOX_DEPTH && Math.abs(z) < BOX_HALF;
  }

  /** melhor cobrador em campo (não expulso, não goleiro) */
  /** @internal */ bestTaker(side: Side, attr: "shooting" | "passing"): SimPlayer | null {
    let best: SimPlayer | null = null;
    for (const p of this.players) {
      if (p.side !== side || p.sentOff || p.pos === "GK") continue;
      if (!best || p[attr] > best[attr]) best = p;
    }
    return best;
  }

  setupPenalty(side: Side) {
    setPieces.setupPenalty(this, side);
  }

  takePenalty() {
    setPieces.takePenalty(this);
  }

  setupDirectFK(side: Side, fx: number, fz: number) {
    setPieces.setupDirectFK(this, side, fx, fz);
  }

  takeDirectFK() {
    setPieces.takeDirectFK(this);
  }

  setupCorner(side: Side) {
    setPieces.setupCorner(this, side);
  }

  takeCorner() {
    setPieces.takeCorner(this);
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

  /** @internal */ nearestOpponent(p: SimPlayer) {
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

  /** @internal */ chasers(): Set<string> {
    return teamAi.chasers(this);
  }

  /** @internal */ moveOffBall(dt: number) {
    teamAi.moveOffBall(this, dt);
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
        const share = bodyContactShare(a.physical, a.weightKg, b.physical, b.weightKg);
        const aWeight = share * (a.id === this.ball.holder ? 0.25 : 1);
        const bWeight = (1 - share) * (b.id === this.ball.holder ? 0.25 : 1);
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
    // Goal posts are solid: push bodies out radially so no athlete renders through them.
    const POST_CLEAR = 0.46; // body radius at the hips + post radius
    const NET_CLEAR = 0.38; // body radius beside the side netting
    for (const p of list) {
      p.x = Math.max(-FIELD_X - 1, Math.min(FIELD_X + 1, p.x));
      p.z = Math.max(-FIELD_Z - 1, Math.min(FIELD_Z + 1, p.z));
      // Side netting behind the goal line is a wall: nobody walks through it.
      const behind = p.x > FIELD_X + 0.05 || p.x < -FIELD_X - 0.05;
      const sideGap = Math.abs(p.z) - GOAL_Z;
      if (behind && sideGap > -NET_CLEAR && sideGap < NET_CLEAR) {
        const outside = sideGap >= 0;
        p.z = Math.sign(p.z || 1) * (GOAL_Z + (outside ? NET_CLEAR : -NET_CLEAR));
      }
      const px = p.x < 0 ? -FIELD_X : FIELD_X;
      const pz = p.z < 0 ? -GOAL_Z : GOAL_Z;
      const dx = p.x - px;
      const dz = p.z - pz;
      if (dx > POST_CLEAR || dx < -POST_CLEAR || dz > POST_CLEAR || dz < -POST_CLEAR) continue;
      const d = Math.hypot(dx, dz);
      if (d >= POST_CLEAR) continue;
      // Exactly on the post: step back onto the pitch side.
      const nx = d < 1e-4 ? -Math.sign(px) : dx / d;
      const nz = d < 1e-4 ? 0 : dz / d;
      p.x = px + nx * POST_CLEAR;
      p.z = pz + nz * POST_CLEAR;
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
      const planar = Math.hypot(this.ball.vx, this.ball.vz);
      if (airborne && planar > 0.01) {
        const k = Math.max(0, 1 - (quadraticDragDeceleration(planar) * dt) / planar);
        this.ball.vx *= k;
        this.ball.vz *= k;
      } else if (settlesOnTurf(planar, this.ball.height) && this.ballVy <= 0) {
        this.ball.vx = 0;
        this.ball.vz = 0;
      }

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

  /** @internal */ controlBall(p: SimPlayer, ballSpeed: number, h: number) {
    ballDuels.controlBall(this, p, ballSpeed, h);
  }

  /** @internal */ tryBlock(dt: number): boolean {
    return ballDuels.tryBlock(this, dt);
  }

  /** @internal */ resolveShot(
    previous = { x: this.ball.x, z: this.ball.z, height: this.ball.height },
  ): boolean {
    return ballDuels.resolveShot(this, previous);
  }

  /** @internal */ woodworkOrRelease(
    s: NonNullable<MatchSim["pendingShot"]>,
    shooter: SimPlayer | null,
    crossingZ: number,
    crossingH: number,
    dir: number,
  ): boolean {
    return ballDuels.woodworkOrRelease(this, s, shooter, crossingZ, crossingH, dir);
  }

  /** Registra o gol, celebrações e reinício. */
  /** @internal */ scoreGoal(
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
  /** @internal */ restartFor(side: Side, kind: "throwIn" | "corner") {
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

  /** @internal */ dribble(holder: SimPlayer, dt: number) {
    ballDuels.dribble(this, holder, dt);
  }

  /** @internal */ pressure(holder: SimPlayer, dt: number) {
    ballDuels.pressure(this, holder, dt);
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

  /** @internal */ shoot(holder: SimPlayer, distGoal: number) {
    ballDuels.shoot(this, holder, distGoal);
  }

  /** @internal */ scheduleRestart(side: Side) {
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

  /** Pure presentation context; never mutates the canonical match state. */
  generateVisualContext(): VersionedVisualData {
    return this.#visualContextComputer.compute(this.players, this.ball, this.time, this.matchSeed);
  }
}
