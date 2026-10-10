import type { Player, Tactics } from "./types";
import {
  MatchSim,
  emptyStats,
  type MatchStats,
  type PlayerRating,
  type Scorer,
  type ShotRecord,
  type Side,
  type SimPlayer,
  type SimView,
  type TeamSetup,
  type TeamTalkKind,
  type MatchCheckpoint,
} from "./sim";
import type { WindVector } from "./ball-climate";
import type { VisualBallState } from "./visual-ball";
import type { MatchPhase, ShootoutKick, WeatherKind } from "./sim-rules";
import type { MatchExecutionContract } from "./match-execution-contract";
import type { PackedLiveSnapshot } from "./live-transport";
import {
  applyLivePlayerBuffer,
  createLivePlayerBuffer,
  createLivePlayerMetadata,
  createSnapshotBufferPool,
  isLiveSnapshotPacket,
  livePlayerBufferFromPacket,
  type LivePlayerMeta,
  type LiveSnapshotPacket,
  type SnapshotBufferPool,
} from "./live-match-buffer";

export interface LiveSnapshot {
  execution?: MatchExecutionContract;
  recovery?: { checkpointSeq: number; ticks: Array<[number, number]> };
  seq: number;
  sentAt: number;
  time: number;
  /** relógio formatado: 45+2', 90+3', 105', PEN */
  clock: string;
  phase: MatchPhase;
  shootout: ShootoutKick[];
  weather: WeatherKind;
  wind: WindVector;
  refName: string;
  players: SimPlayer[];
  ball: SimView["ball"];
  /** Pose opcional de apresentação calculada pelo Rapier no Worker. */
  visualBall?: VisualBallState;
  possession: Side;
  stats: Record<Side, MatchStats>;
  /**
   * O histórico só cruza a fronteira do Worker quando muda. A visualização
   * mantém o último histórico recebido entre snapshots de posição.
   */
  events?: MatchSim["events"];
  eventSeq: number;
  finished: boolean;
  subsUsed: Record<Side, number>;
}

const eventCache = new WeakMap<MatchSim, { seq: number; events: MatchSim["events"] }>();
const legacyPacketEvents = new WeakMap<MatchSim, { seq: number; events: MatchSim["events"] }>();

export interface LiveResult extends LiveSnapshot {
  ratings: PlayerRating[];
  scorers: Scorer[];
  shotMap: ShotRecord[];
}

export type LiveWorkerRequest =
  | {
      id: number;
      type: "startLive";
      home: TeamSetup;
      away: TeamSetup;
      seed: string;
      knockout?: boolean | undefined;
      weather?: WeatherKind | undefined;
      compact?: boolean;
    }
  | { id: number; type: "pauseLive"; paused: boolean }
  | { id: number; type: "speedLive"; speed: number }
  | { id: number; type: "tacticsLive"; side: Side; tactics: Tactics; expiresAt: number }
  | { id: number; type: "talkLive"; side: Side; kind: TeamTalkKind; expiresAt: number }
  | {
      id: number;
      type: "substituteLive";
      side: Side;
      outPid: string;
      incoming: Player;
      expiresAt: number;
    }
  | { id: number; type: "skipLive" }
  | { id: number; type: "stopLive" }
  | { id: number; type: "recycleLive"; session: number; slot: number; buffer: ArrayBuffer }
  | { id: number; type: "resyncLive" }
  | {
      id: number;
      type: "simulate";
      home: TeamSetup;
      away: TeamSetup;
      seed: string;
      knockout?: boolean | undefined;
      weather?: WeatherKind | undefined;
    }
  | {
      id: number;
      type: "autoSeason";
      career: import("./types").CareerState;
      maxWeeks: number;
      evaluatedAt: number;
    }
  | {
      id: number;
      type: "advance";
      evaluatedAt: number;
      career: import("./types").CareerState;
      result: { hg: number; ag: number };
      performances: import("./career").MatchPerformance[];
    };

export type LiveWorkerResponse =
  | { id: number; ok: true; type: "recovery"; checkpoint: MatchCheckpoint; checkpointSeq: number }
  | { id: number; ok: true; type: "ready" | "command"; result?: boolean }
  | { id: number; ok: true; type: "snapshot"; snapshot: LiveSnapshot }
  | { id: number; ok: true; type: "packedSnapshot"; snapshot: PackedLiveSnapshot }
  | { id: number; ok: true; type: "finished"; result: LiveResult }
  | { id: number; ok: true; type?: undefined; result: unknown }
  | {
      id: number;
      ok: false;
      error: string;
      code?: "invalid-command" | "queue-full" | "command-failed";
    };

export interface MatchRuntime extends SimView {
  events: MatchSim["events"];
  shotMap: ShotRecord[];
  scorers: Scorer[];
  subsUsed: Record<Side, number>;
  finished: boolean;
  eventSeq?: number;
  /** relógio formatado e fase (presentes na view ao vivo) */
  clock?: string;
  phase?: MatchPhase;
  playerRatings(): PlayerRating[];
  manOfTheMatch(): PlayerRating | null;
  possessionPct(): [number, number];
}

export function snapshotMatch(
  sim: MatchSim,
  seq: number,
  visualBall?: VisualBallState,
  includeEvents = true,
): LiveSnapshot {
  // Most snapshots only move players and the ball. Do not clone the historical
  // feed merely to discard it on the way to the structured-clone boundary.
  const events = includeEvents
    ? (() => {
        const cachedEvents = eventCache.get(sim);
        const copied =
          cachedEvents?.seq === sim.lastEventId
            ? cachedEvents.events
            : sim.events.map((event) => ({ ...event }));
        if (cachedEvents?.seq !== sim.lastEventId)
          eventCache.set(sim, { seq: sim.lastEventId, events: copied });
        return copied;
      })()
    : undefined;
  return {
    seq,
    execution: sim.executionContract(),
    sentAt: performance.now(),
    time: sim.time,
    clock: sim.clock(),
    phase: sim.phase,
    shootout: sim.shootout.map((kick) => ({ ...kick })),
    weather: sim.weather,
    wind: { ...sim.wind },
    refName: sim.ref.name,
    players: sim.players.map((player) => ({ ...player })),
    ball: { ...sim.ball },
    ...(visualBall ? { visualBall: { ...visualBall } } : {}),
    possession: sim.possession,
    stats: { home: { ...sim.stats.home }, away: { ...sim.stats.away } },
    ...(events ? { events } : {}),
    eventSeq: sim.lastEventId,
    finished: sim.finished,
    subsUsed: { ...sim.subsUsed },
  };
}

export function resultMatch(sim: MatchSim, seq: number, visualBall?: VisualBallState): LiveResult {
  return {
    ...snapshotMatch(sim, seq, visualBall),
    ratings: sim.playerRatings(),
    scorers: sim.scorers.map((item) => ({ ...item })),
    shotMap: sim.shotMap.map((item) => ({ ...item })),
  };
}

/** Compatibility adapter for the three-buffer protocol used by earlier clients. */
export function snapshotMatchPacket(
  sim: MatchSim,
  seq: number,
  options: {
    pool?: SnapshotBufferPool;
    rosterVersion?: number;
    includeMetadata?: boolean;
    visualBall?: VisualBallState;
  } = {},
): LiveSnapshotPacket {
  const pool = options.pool ?? createSnapshotBufferPool(3);
  const buffer = createLivePlayerBuffer(sim.players, pool.acquire(sim.players.length));
  const previous = legacyPacketEvents.get(sim);
  const added = previous
    ? sim.events.filter((event) => !previous.events.includes(event))
    : sim.events;
  legacyPacketEvents.set(sim, { seq: sim.lastEventId, events: sim.events.slice() });
  const {
    players: _players,
    events: _events,
    ...envelope
  } = snapshotMatch(sim, seq, options.visualBall, false);
  return {
    ...envelope,
    type: "snapshot",
    rosterVersion: options.rosterVersion ?? 1,
    players: {
      positions: buffer.positions.buffer as ArrayBuffer,
      velocities: buffer.velocities.buffer as ArrayBuffer,
      states: buffer.states.buffer as ArrayBuffer,
    },
    ...(options.includeMetadata ? { metadata: createLivePlayerMetadata(sim.players) } : {}),
    ...((previous?.seq ?? 0) !== sim.lastEventId || added.length
      ? { eventDelta: { fromSeq: previous?.seq ?? 0, toSeq: sim.lastEventId, added } }
      : {}),
    bufferStarvation: pool.starvationCount(),
  };
}

export class WorkerMatchView implements MatchRuntime {
  time = 0;
  clock = "0'";
  phase: MatchPhase = "first";
  shootout: ShootoutKick[] = [];
  weather: WeatherKind = "clear";
  wind: WindVector = { x: 0, z: 0, strength01: 0 };
  refName = "";
  players: SimPlayer[] = [];
  ball = { x: 0, z: 0, vx: 0, vz: 0, holder: null as string | null, height: 0.12 };
  visualBall?: VisualBallState;
  possession: Side = "home";
  stats: Record<Side, MatchStats>;
  events: MatchSim["events"] = [];
  shotMap: ShotRecord[] = [];
  scorers: Scorer[] = [];
  subsUsed: Record<Side, number> = { home: 0, away: 0 };
  finished = false;
  eventSeq = 0;
  private ratings: PlayerRating[] = [];
  // x/z at receipt and x/z at target, reused until the roster size changes.
  private positions = new Float64Array(0);
  private previousBall = { x: 0, z: 0, height: 0.12 };
  private targetBall = { x: 0, z: 0, height: 0.12 };
  private previousVisualBall: VisualBallState | null = null;
  private targetVisualBall: VisualBallState | null = null;
  private receivedAt = 0;
  private intervalMs = 100;
  private legacyMetadata: readonly LivePlayerMeta[] = [];
  private legacyPlayers: SimPlayer[] = [];
  private legacyBuffers: LiveSnapshotPacket["players"][] = [];
  private execution: MatchExecutionContract | undefined;
  private hasEventSnapshot = false;

  executionContract(): MatchExecutionContract | undefined {
    return this.execution && { ...this.execution };
  }

  constructor(
    public home: TeamSetup,
    public away: TeamSetup,
  ) {
    this.stats = { home: emptyStats(), away: emptyStats() };
  }

  apply(next: LiveSnapshot | LiveResult | LiveSnapshotPacket): ArrayBuffer[] {
    if (isLiveSnapshotPacket(next)) {
      this.legacyMetadata = next.metadata ?? this.legacyMetadata;
      if (!this.legacyMetadata.length)
        throw new RangeError("snapshot packet has no roster metadata");
      this.legacyPlayers = applyLivePlayerBuffer(
        this.legacyPlayers,
        this.legacyMetadata,
        livePlayerBufferFromPacket(next),
      );
      const { players: _buffers, metadata: _metadata, eventDelta, ...envelope } = next;
      const events =
        eventDelta && eventDelta.fromSeq === this.eventSeq
          ? [...this.events, ...eventDelta.added].slice(-80)
          : this.events;
      this.apply({ ...envelope, players: this.legacyPlayers, events });
      this.legacyBuffers.push(next.players);
      const recyclable = this.legacyBuffers.length > 2 ? this.legacyBuffers.shift() : undefined;
      return recyclable ? [recyclable.positions, recyclable.velocities, recyclable.states] : [];
    }
    const now = performance.now();
    if (this.receivedAt) this.intervalMs = Math.max(50, Math.min(250, now - this.receivedAt));
    this.receivedAt = now;
    const rosterChanged =
      this.players.length !== next.players.length ||
      this.players.some((player, index) => player.id !== next.players[index]?.id);
    if (this.positions.length !== next.players.length * 4)
      this.positions = new Float64Array(next.players.length * 4);
    for (let index = 0; index < next.players.length; index += 1) {
      const target = next.players[index]!;
      // Identity lookup is needed only on substitution/reordering, not 10 times
      // a second during ordinary play. New athletes begin at their target.
      const current = rosterChanged
        ? this.players.find((player) => player.id === target.id)
        : this.players[index];
      const offset = index * 4;
      this.positions[offset] = current?.x ?? target.x;
      this.positions[offset + 1] = current?.z ?? target.z;
      this.positions[offset + 2] = target.x;
      this.positions[offset + 3] = target.z;
    }
    this.previousBall.x = this.ball.x;
    this.previousBall.z = this.ball.z;
    this.previousBall.height = this.ball.height;
    if (rosterChanged) {
      this.players = next.players.map((player) => ({ ...player }));
    } else {
      for (let index = 0; index < next.players.length; index += 1) {
        const target = next.players[index];
        const current = this.players[index];
        if (!target || !current) continue;
        const x = current.x;
        const z = current.z;
        Object.assign(current, target);
        current.x = x;
        current.z = z;
      }
    }
    this.targetBall.x = next.ball.x;
    this.targetBall.z = next.ball.z;
    this.targetBall.height = next.ball.height;
    Object.assign(this.ball, next.ball, this.previousBall);
    if (next.visualBall) {
      // Three stable poses instead of three temporary objects per delivery.
      this.previousVisualBall ??= { ...next.visualBall };
      Object.assign(this.previousVisualBall, this.visualBall ?? next.visualBall);
      this.targetVisualBall ??= { ...next.visualBall };
      Object.assign(this.targetVisualBall, next.visualBall);
      // Mantém referências que uma cena R3F já recebeu apontando para a pose
      // atual. A cena também lê SimView por frame, mas esta estabilidade evita
      // uma câmera ou prop ficar preso no snapshot anterior.
      this.visualBall ??= { ...next.visualBall };
      Object.assign(this.visualBall, next.visualBall);
      this.visualBall.x = this.previousVisualBall.x;
      this.visualBall.z = this.previousVisualBall.z;
      this.visualBall.height = this.previousVisualBall.height;
    } else {
      delete this.visualBall;
      this.previousVisualBall = null;
      this.targetVisualBall = null;
    }
    this.time = next.time;
    if (next.execution) this.execution = { ...next.execution };
    this.clock = next.clock;
    this.phase = next.phase;
    this.shootout = next.shootout.map((kick) => ({ ...kick }));
    this.weather = next.weather;
    Object.assign(this.wind, next.wind);
    this.refName = next.refName;
    this.possession = next.possession;
    Object.assign(this.stats.home, next.stats.home);
    Object.assign(this.stats.away, next.stats.away);
    if (next.events && (!this.hasEventSnapshot || next.eventSeq !== this.eventSeq)) {
      this.events = next.events.map((event) => ({ ...event }));
      this.eventSeq = next.eventSeq;
      this.hasEventSnapshot = true;
    }
    this.finished = next.finished;
    Object.assign(this.subsUsed, next.subsUsed);
    if ("ratings" in next) {
      this.ratings = next.ratings.map((rating) => ({ ...rating }));
      this.scorers = next.scorers.map((item) => ({ ...item }));
      this.shotMap = next.shotMap.map((item) => ({ ...item }));
    }
    return [];
  }

  renderTick(now = performance.now()) {
    const alpha = Math.max(0, Math.min(1, (now - this.receivedAt) / this.intervalMs));
    for (let index = 0; index < this.players.length; index += 1) {
      const player = this.players[index]!;
      const offset = index * 4;
      const x = this.positions[offset]!;
      const z = this.positions[offset + 1]!;
      player.x = x + (this.positions[offset + 2]! - x) * alpha;
      player.z = z + (this.positions[offset + 3]! - z) * alpha;
    }
    this.ball.x = this.previousBall.x + (this.targetBall.x - this.previousBall.x) * alpha;
    this.ball.z = this.previousBall.z + (this.targetBall.z - this.previousBall.z) * alpha;
    this.ball.height =
      this.previousBall.height + (this.targetBall.height - this.previousBall.height) * alpha;
    if (this.visualBall && this.previousVisualBall && this.targetVisualBall) {
      this.visualBall.x =
        this.previousVisualBall.x + (this.targetVisualBall.x - this.previousVisualBall.x) * alpha;
      this.visualBall.z =
        this.previousVisualBall.z + (this.targetVisualBall.z - this.previousVisualBall.z) * alpha;
      this.visualBall.height =
        this.previousVisualBall.height +
        (this.targetVisualBall.height - this.previousVisualBall.height) * alpha;
      this.visualBall.vx =
        this.previousVisualBall.vx +
        (this.targetVisualBall.vx - this.previousVisualBall.vx) * alpha;
      this.visualBall.vy =
        this.previousVisualBall.vy +
        (this.targetVisualBall.vy - this.previousVisualBall.vy) * alpha;
      this.visualBall.vz =
        this.previousVisualBall.vz +
        (this.targetVisualBall.vz - this.previousVisualBall.vz) * alpha;
      this.visualBall.spin =
        this.previousVisualBall.spin +
        (this.targetVisualBall.spin - this.previousVisualBall.spin) * alpha;
    }
  }

  minute() {
    return Math.min(120, Math.floor(this.time / 60));
  }
  possessionPct(): [number, number] {
    const home = this.stats.home.possessionTicks;
    const away = this.stats.away.possessionTicks;
    const total = home + away || 1;
    return [Math.round((home / total) * 100), Math.round((away / total) * 100)];
  }
  playerRatings() {
    return this.ratings.map((rating) => ({ ...rating }));
  }
  manOfTheMatch() {
    return this.ratings.length
      ? this.ratings.reduce((best, rating) => (rating.rating > best.rating ? rating : best))
      : null;
  }
}
