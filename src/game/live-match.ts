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
} from "./sim";
import type { WindVector } from "./ball-climate";
import type { VisualBallState } from "./visual-ball";
import type { MatchPhase, ShootoutKick, WeatherKind } from "./sim-rules";
import type { WorkerErrorPayload } from "./worker-error";
import {
  applyLivePlayerBuffer,
  createLivePlayerBuffer,
  createLivePlayerMetadata,
  createSnapshotBufferPool,
  isLiveSnapshotPacket,
  livePlayerBufferFromPacket,
  recycleSnapshot,
  type LivePlayerMeta,
  type LiveSnapshotPacket,
  type SnapshotBufferPool,
} from "./live-match-buffer";

export interface LiveSnapshot {
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
  /** Histórico completo quando eventSeq muda; vazio em snapshots sem eventos novos. */
  events: MatchSim["events"];
  eventSeq: number;
  finished: boolean;
  subsUsed: Record<Side, number>;
}

const eventCache = new WeakMap<MatchSim, { seq: number; events: MatchSim["events"] }>();
const packetEventCache = new WeakMap<MatchSim, { seq: number; events: MatchSim["events"] }>();

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
    }
  | { id: number; type: "pauseLive"; paused: boolean }
  | { id: number; type: "speedLive"; speed: number }
  | { id: number; type: "tacticsLive"; side: Side; tactics: Tactics }
  | { id: number; type: "talkLive"; side: Side; kind: TeamTalkKind }
  | { id: number; type: "substituteLive"; side: Side; outPid: string; incoming: Player }
  | { id: number; type: "skipLive" }
  | { id: number; type: "stopLive" }
  | {
      id: number;
      type: "recycle";
      positions: ArrayBuffer;
      velocities: ArrayBuffer;
      states: ArrayBuffer;
    }
  | {
      id: number;
      type: "simulate";
      home: TeamSetup;
      away: TeamSetup;
      seed: string;
      knockout?: boolean | undefined;
      weather?: WeatherKind | undefined;
    }
  | { id: number; type: "autoSeason"; career: import("./types").CareerState; maxWeeks: number }
  | {
      id: number;
      type: "advance";
      career: import("./types").CareerState;
      result: { hg: number; ag: number };
      performances: import("./career").MatchPerformance[];
    };

export type LiveWorkerResponse =
  | { id: number; ok: true; type: "ready" | "command"; result?: boolean }
  | { id: number; ok: true; type: "snapshot"; snapshot: LiveSnapshot | LiveSnapshotPacket }
  | { id: number; ok: true; type: "finished"; result: LiveResult }
  | { id: number; ok: true; type?: undefined; result: unknown }
  | { id: number; ok: false; type: "worker-error"; error: WorkerErrorPayload }
  | { id: number; ok: false; error: string };

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
  let events: MatchSim["events"] = [];
  if (includeEvents) {
    const cachedEvents = eventCache.get(sim);
    events =
      cachedEvents?.seq === sim.lastEventId
        ? cachedEvents.events
        : sim.events.map((event) => ({ ...event }));
    if (cachedEvents?.seq !== sim.lastEventId)
      eventCache.set(sim, { seq: sim.lastEventId, events });
  }
  return {
    seq,
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
    events,
    eventSeq: sim.lastEventId,
    finished: sim.finished,
    subsUsed: { ...sim.subsUsed },
  };
}

/**
 * Compact live transport. The simulation remains the single owner of truth;
 * this function only projects its current state into three transferable typed
 * arrays and a small scalar/HUD envelope.
 */
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
  const playerBuffer = createLivePlayerBuffer(sim.players, pool.acquire(sim.players.length));
  const previousEvents = packetEventCache.get(sim);
  const added = previousEvents
    ? sim.events.filter((event) => !previousEvents.events.includes(event))
    : sim.events;
  const fromSeq = previousEvents?.seq ?? 0;
  packetEventCache.set(sim, { seq: sim.lastEventId, events: sim.events.slice() });
  const metadata = createLivePlayerMetadata(sim.players);
  return {
    type: "snapshot",
    seq,
    sentAt: performance.now(),
    time: sim.time,
    clock: sim.clock(),
    phase: sim.phase,
    shootout: sim.shootout.map((kick) => ({ ...kick })),
    weather: sim.weather,
    wind: { ...sim.wind },
    refName: sim.ref.name,
    players: {
      positions: playerBuffer.positions.buffer as ArrayBuffer,
      velocities: playerBuffer.velocities.buffer as ArrayBuffer,
      states: playerBuffer.states.buffer as ArrayBuffer,
    },
    ...(options.includeMetadata ? { metadata } : {}),
    ...(options.visualBall ? { visualBall: { ...options.visualBall } } : {}),
    ball: { ...sim.ball },
    possession: sim.possession,
    stats: { home: { ...sim.stats.home }, away: { ...sim.stats.away } },
    eventSeq: sim.lastEventId,
    ...(fromSeq !== sim.lastEventId || added.length
      ? { eventDelta: { fromSeq, toSeq: sim.lastEventId, added } }
      : {}),
    finished: sim.finished,
    subsUsed: { ...sim.subsUsed },
    rosterVersion: options.rosterVersion ?? 1,
    bufferStarvation: pool.starvationCount(),
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

function cloneStats(stats: Record<Side, MatchStats>): Record<Side, MatchStats> {
  return { home: { ...stats.home }, away: { ...stats.away } };
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
  eventSeq = -1;
  private ratings: PlayerRating[] = [];
  private previousPositions = new Float64Array();
  private targetPositions = new Float64Array();
  private previousIds: string[] = [];
  private playerMetadata: LivePlayerMeta[] = [];
  private retainedPacketBuffers: LiveSnapshotPacket["players"][] = [];
  private previousBall = { x: 0, z: 0, height: 0.12 };
  private targetBall = { x: 0, z: 0, height: 0.12 };
  private previousVisualBall: VisualBallState | null = null;
  private targetVisualBall: VisualBallState | null = null;
  private receivedAt = 0;
  private intervalMs = 100;

  constructor(
    public home: TeamSetup,
    public away: TeamSetup,
  ) {
    this.stats = { home: emptyStats(), away: emptyStats() };
  }

  apply(next: LiveSnapshot | LiveResult | LiveSnapshotPacket): ArrayBuffer[] {
    const now = performance.now();
    if (this.receivedAt) this.intervalMs = Math.max(50, Math.min(250, now - this.receivedAt));
    this.receivedAt = now;
    const packet = isLiveSnapshotPacket(next) ? next : null;
    const nextCount = packet
      ? (packet.metadata?.length ?? this.playerMetadata.length)
      : (next as LiveSnapshot | LiveResult).players.length;
    const positionCapacity = Math.max(this.players.length, nextCount);
    if (this.previousPositions.length < positionCapacity * 2) {
      this.previousPositions = new Float64Array(positionCapacity * 2);
      this.targetPositions = new Float64Array(positionCapacity * 2);
      this.previousIds = new Array<string>(positionCapacity);
    }
    for (let index = 0; index < this.players.length; index += 1) {
      const player = this.players[index]!;
      const offset = index * 2;
      this.previousPositions[offset] = player.x;
      this.previousPositions[offset + 1] = player.z;
      this.previousIds[index] = player.id;
    }
    this.previousBall = { x: this.ball.x, z: this.ball.z, height: this.ball.height };
    const previousVisualBall = this.visualBall ? { ...this.visualBall } : null;
    let nextPlayers: readonly SimPlayer[];
    let rosterChanged = false;
    if (packet) {
      const metadata = packet.metadata ?? this.playerMetadata;
      if (!metadata.length) throw new RangeError("snapshot packet has no roster metadata");
      this.playerMetadata = metadata.map((item) => ({ ...item }));
      const buffer = livePlayerBufferFromPacket(packet);
      const existingIds = this.players.map((player) => player.id).join("|");
      const metadataIds = metadata.map((player) => player.id).join("|");
      rosterChanged = existingIds !== metadataIds;
      this.players = applyLivePlayerBuffer(this.players, metadata, buffer);
      nextPlayers = this.players;
      this.retainedPacketBuffers.push(packet.players);
    } else {
      const objectSnapshot = next as LiveSnapshot | LiveResult;
      nextPlayers = objectSnapshot.players;
      if (!this.players.length || this.players.length !== nextPlayers.length) {
        this.players = nextPlayers.map((player) => ({ ...player }));
        rosterChanged = true;
      } else {
        for (let index = 0; index < nextPlayers.length; index += 1) {
          const target = nextPlayers[index];
          const current = this.players[index];
          if (!target || !current || current.id !== target.id) {
            this.players = nextPlayers.map((player) => ({ ...player }));
            rosterChanged = true;
            break;
          }
          Object.assign(current, target, { x: current.x, z: current.z });
        }
      }
    }
    nextPlayers.forEach((player, index) => {
      const offset = index * 2;
      this.targetPositions[offset] = player.x;
      this.targetPositions[offset + 1] = player.z;
      const samePlayer = this.previousIds[index] === player.id;
      if (!rosterChanged && samePlayer) {
        player.x = this.previousPositions[offset]!;
        player.z = this.previousPositions[offset + 1]!;
      }
    });
    this.targetBall = { x: next.ball.x, z: next.ball.z, height: next.ball.height };
    Object.assign(this.ball, next.ball, this.previousBall);
    if (next.visualBall) {
      this.previousVisualBall = previousVisualBall ?? { ...next.visualBall };
      this.targetVisualBall = { ...next.visualBall };
      const nextVisualBall: VisualBallState = {
        ...next.visualBall,
        x: this.previousVisualBall.x,
        z: this.previousVisualBall.z,
        height: this.previousVisualBall.height,
      };
      // Mantém referências que uma cena R3F já recebeu apontando para a pose
      // atual. A cena também lê SimView por frame, mas esta estabilidade evita
      // uma câmera ou prop ficar preso no snapshot anterior.
      if (this.visualBall) Object.assign(this.visualBall, nextVisualBall);
      else this.visualBall = nextVisualBall;
    } else {
      delete this.visualBall;
      this.previousVisualBall = null;
      this.targetVisualBall = null;
    }
    this.time = next.time;
    this.clock = next.clock;
    this.phase = next.phase;
    this.shootout = next.shootout.map((kick) => ({ ...kick }));
    this.weather = next.weather;
    this.wind = { ...next.wind };
    this.refName = next.refName;
    this.possession = next.possession;
    this.stats = cloneStats(next.stats);
    if (packet) {
      const delta = packet.eventDelta;
      if (delta && delta.fromSeq === this.eventSeq) {
        this.events = [
          ...this.events,
          ...delta.added.map((event) => ({ ...event })),
        ].slice(-80);
      }
    } else if (next.eventSeq !== this.eventSeq) {
      const objectSnapshot = next as LiveSnapshot | LiveResult;
      this.events = objectSnapshot.events.map((event) => ({ ...event }));
    }
    this.eventSeq = next.eventSeq;
    this.finished = next.finished;
    this.subsUsed = { ...next.subsUsed };
    if ("ratings" in next) {
      this.ratings = next.ratings.map((rating) => ({ ...rating }));
      this.scorers = next.scorers.map((item) => ({ ...item }));
      this.shotMap = next.shotMap.map((item) => ({ ...item }));
    }
    if (this.retainedPacketBuffers.length > 2) {
      const recycled = recycleSnapshot({ players: this.retainedPacketBuffers.shift()! });
      return [recycled.positions, recycled.velocities, recycled.states];
    }
    return [];
  }

  renderTick(now = performance.now()) {
    const alpha = Math.max(0, Math.min(1, (now - this.receivedAt) / this.intervalMs));
    for (let index = 0; index < this.players.length; index += 1) {
      const player = this.players[index]!;
      const offset = index * 2;
      const targetX = this.targetPositions[offset]!;
      const targetZ = this.targetPositions[offset + 1]!;
      const samePlayer = this.previousIds[index] === player.id;
      const fromX = samePlayer ? this.previousPositions[offset]! : targetX;
      const fromZ = samePlayer ? this.previousPositions[offset + 1]! : targetZ;
      player.x = fromX + (targetX - fromX) * alpha;
      player.z = fromZ + (targetZ - fromZ) * alpha;
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
