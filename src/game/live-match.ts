import type { Player, Tactics } from "./types";
import {
  MatchSim,
  type MatchStats,
  type PlayerRating,
  type Scorer,
  type ShotRecord,
  type Side,
  type SimPlayer,
  type SimView,
  type TeamSetup,
} from "./sim";

export interface LiveSnapshot {
  seq: number;
  sentAt: number;
  time: number;
  players: SimPlayer[];
  ball: SimView["ball"];
  possession: Side;
  stats: Record<Side, MatchStats>;
  events: MatchSim["events"];
  eventSeq: number;
  finished: boolean;
  subsUsed: Record<Side, number>;
}

const eventCache = new WeakMap<MatchSim, { seq: number; events: MatchSim["events"] }>();

export interface LiveResult extends LiveSnapshot {
  ratings: PlayerRating[];
  scorers: Scorer[];
  shotMap: ShotRecord[];
}

export type LiveWorkerRequest =
  | { id: number; type: "startLive"; home: TeamSetup; away: TeamSetup; seed: string }
  | { id: number; type: "pauseLive"; paused: boolean }
  | { id: number; type: "speedLive"; speed: number }
  | { id: number; type: "tacticsLive"; side: Side; tactics: Tactics }
  | { id: number; type: "substituteLive"; side: Side; outPid: string; incoming: Player }
  | { id: number; type: "skipLive" }
  | { id: number; type: "stopLive" }
  | { id: number; type: "simulate"; home: TeamSetup; away: TeamSetup; seed: string }
  | {
      id: number;
      type: "advance";
      career: import("./types").CareerState;
      result: { hg: number; ag: number };
      performances: import("./career").MatchPerformance[];
    };

export type LiveWorkerResponse =
  | { id: number; ok: true; type: "ready" | "command"; result?: boolean }
  | { id: number; ok: true; type: "snapshot"; snapshot: LiveSnapshot }
  | { id: number; ok: true; type: "finished"; result: LiveResult }
  | { id: number; ok: true; type?: undefined; result: unknown }
  | { id: number; ok: false; error: string };

export interface MatchRuntime extends SimView {
  events: MatchSim["events"];
  shotMap: ShotRecord[];
  scorers: Scorer[];
  subsUsed: Record<Side, number>;
  finished: boolean;
  eventSeq?: number;
  playerRatings(): PlayerRating[];
  manOfTheMatch(): PlayerRating | null;
  possessionPct(): [number, number];
}

export function snapshotMatch(sim: MatchSim, seq: number): LiveSnapshot {
  const cachedEvents = eventCache.get(sim);
  const events = cachedEvents?.seq === sim.lastEventId
    ? cachedEvents.events
    : sim.events.map((event) => ({ ...event }));
  if (cachedEvents?.seq !== sim.lastEventId) eventCache.set(sim, { seq: sim.lastEventId, events });
  return {
    seq,
    sentAt: performance.now(),
    time: sim.time,
    players: sim.players.map((player) => ({ ...player })),
    ball: { ...sim.ball },
    possession: sim.possession,
    stats: { home: { ...sim.stats.home }, away: { ...sim.stats.away } },
    events,
    eventSeq: sim.lastEventId,
    finished: sim.finished,
    subsUsed: { ...sim.subsUsed },
  };
}

export function resultMatch(sim: MatchSim, seq: number): LiveResult {
  return {
    ...snapshotMatch(sim, seq),
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
  players: SimPlayer[] = [];
  ball = { x: 0, z: 0, vx: 0, vz: 0, holder: null as string | null, height: 0.12 };
  possession: Side = "home";
  stats: Record<Side, MatchStats>;
  events: MatchSim["events"] = [];
  shotMap: ShotRecord[] = [];
  scorers: Scorer[] = [];
  subsUsed: Record<Side, number> = { home: 0, away: 0 };
  finished = false;
  eventSeq = 0;
  private ratings: PlayerRating[] = [];
  private previous = new Map<string, { x: number; z: number }>();
  private targets = new Map<string, SimPlayer>();
  private previousBall = { x: 0, z: 0, height: 0.12 };
  private targetBall = { x: 0, z: 0, height: 0.12 };
  private receivedAt = 0;
  private intervalMs = 100;

  constructor(public home: TeamSetup, public away: TeamSetup) {
    this.stats = {
      home: { goals: 0, shots: 0, onTarget: 0, possessionTicks: 0, fouls: 0, passes: 0, passesOk: 0, corners: 0, yellow: 0, red: 0 },
      away: { goals: 0, shots: 0, onTarget: 0, possessionTicks: 0, fouls: 0, passes: 0, passesOk: 0, corners: 0, yellow: 0, red: 0 },
    };
  }

  apply(next: LiveSnapshot | LiveResult) {
    const now = performance.now();
    if (this.receivedAt) this.intervalMs = Math.max(50, Math.min(250, now - this.receivedAt));
    this.receivedAt = now;
    this.previous.clear();
    for (const player of this.players) this.previous.set(player.id, { x: player.x, z: player.z });
    this.previousBall = { x: this.ball.x, z: this.ball.z, height: this.ball.height };
    this.targets.clear();
    for (const player of next.players) this.targets.set(player.id, player);
    if (!this.players.length || this.players.length !== next.players.length) {
      this.players = next.players.map((player) => ({ ...player }));
    } else {
      for (let index = 0; index < next.players.length; index += 1) {
        const target = next.players[index];
        const current = this.players[index];
        if (!target || !current || current.id !== target.id) {
          this.players = next.players.map((player) => ({ ...player }));
          break;
        }
        Object.assign(current, target, { x: current.x, z: current.z });
      }
    }
    this.targetBall = { x: next.ball.x, z: next.ball.z, height: next.ball.height };
    Object.assign(this.ball, next.ball, this.previousBall);
    this.time = next.time;
    this.possession = next.possession;
    this.stats = cloneStats(next.stats);
    if (next.eventSeq !== this.eventSeq) this.events = next.events.map((event) => ({ ...event }));
    this.eventSeq = next.eventSeq;
    this.finished = next.finished;
    this.subsUsed = { ...next.subsUsed };
    if ("ratings" in next) {
      this.ratings = next.ratings.map((rating) => ({ ...rating }));
      this.scorers = next.scorers.map((item) => ({ ...item }));
      this.shotMap = next.shotMap.map((item) => ({ ...item }));
    }
  }

  renderTick(now = performance.now()) {
    const alpha = Math.max(0, Math.min(1, (now - this.receivedAt) / this.intervalMs));
    for (const player of this.players) {
      const from = this.previous.get(player.id);
      const to = this.targets.get(player.id);
      if (!to) continue;
      player.x = (from?.x ?? to.x) + (to.x - (from?.x ?? to.x)) * alpha;
      player.z = (from?.z ?? to.z) + (to.z - (from?.z ?? to.z)) * alpha;
    }
    this.ball.x = this.previousBall.x + (this.targetBall.x - this.previousBall.x) * alpha;
    this.ball.z = this.previousBall.z + (this.targetBall.z - this.previousBall.z) * alpha;
    this.ball.height = this.previousBall.height + (this.targetBall.height - this.previousBall.height) * alpha;
  }

  minute() { return Math.min(90, Math.floor(this.time / 60)); }
  possessionPct(): [number, number] {
    const home = this.stats.home.possessionTicks;
    const away = this.stats.away.possessionTicks;
    const total = home + away || 1;
    return [Math.round((home / total) * 100), Math.round((away / total) * 100)];
  }
  playerRatings() { return this.ratings.map((rating) => ({ ...rating })); }
  manOfTheMatch() {
    return this.ratings.length ? this.ratings.reduce((best, rating) => rating.rating > best.rating ? rating : best) : null;
  }
}
