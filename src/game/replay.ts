/**
 * Gravação e reprodução de partidas.
 *
 * Durante a partida amostramos o estado (bola + jogadores) a ~4 Hz. O arquivo
 * resultante é pequeno o suficiente para caber no aparelho e permite rever o
 * jogo em 3D depois, além de exportar um vídeo.
 */
import { get, set } from "idb-keyval";

import type { PlayerAction } from "./animation";
import { emptyStats } from "./sim";
import type { MatchStats, Side, SimPlayer, SimView, TeamSetup } from "./sim";

const KEY = "manager3d.replays.v1";
const MAX_REPLAYS = 20;
/** amostras por segundo de jogo simulado */
const HZ = 4;

export interface ReplayPlayerMeta {
  id: string;
  side: Side;
  name: string;
  number: number;
  pos: string;
  pid: string;
}

export interface ReplayFrame {
  /** tempo de jogo em segundos */
  t: number;
  /** bola: x, z, altura */
  b: [number, number, number];
  /** por jogador: x, z, vx, vz */
  p: number[];
  /** ação em curso por jogador (null = nenhuma) */
  a: (PlayerAction | null)[];
  hg: number;
  ag: number;
  poss: Side;
}

export interface Replay {
  id: string;
  createdAt: number;
  title: string;
  home: TeamSetup;
  away: TeamSetup;
  meta: ReplayPlayerMeta[];
  frames: ReplayFrame[];
  score: [number, number];
}

/* ---------------------------------------------------------------- *
 * Gravação
 * ---------------------------------------------------------------- */

export class ReplayRecorder {
  private frames: ReplayFrame[] = [];
  private meta: ReplayPlayerMeta[] = [];
  private nextAt = 0;

  constructor(private sim: SimView) {
    this.meta = sim.players.map((p) => ({
      id: p.id,
      side: p.side,
      name: p.name,
      number: p.number,
      pos: p.pos,
      pid: p.pid,
    }));
  }

  /** Chamar a cada quadro; grava só quando passa o intervalo de amostragem. */
  sample() {
    const sim = this.sim;
    if (sim.time < this.nextAt) return;
    this.nextAt = sim.time + 1 / HZ;
    const p: number[] = [];
    const a: (PlayerAction | null)[] = [];
    for (const pl of sim.players) {
      p.push(round(pl.x), round(pl.z), round(pl.vx), round(pl.vz));
      a.push(pl.action);
    }
    this.frames.push({
      t: sim.time,
      b: [round(sim.ball.x), round(sim.ball.z), round(sim.ball.height)],
      p,
      a,
      hg: sim.stats.home.goals,
      ag: sim.stats.away.goals,
      poss: sim.possession,
    });
  }

  build(title: string): Replay {
    const sim = this.sim;
    return {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: Date.now(),
      title,
      home: sim.home,
      away: sim.away,
      meta: this.meta,
      frames: this.frames,
      score: [sim.stats.home.goals, sim.stats.away.goals],
    };
  }
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}

/* ---------------------------------------------------------------- *
 * Reprodução
 * ---------------------------------------------------------------- */

/** Simulação "falsa" que apenas lê os quadros gravados e interpola entre eles. */
export class ReplaySim implements SimView {
  time = 0;
  players: SimPlayer[];
  ball = { x: 0, z: 0, vx: 0, vz: 0, holder: null as string | null, height: 0 };
  possession: Side = "home";
  stats: Record<Side, MatchStats> = {
    home: emptyStats(),
    away: emptyStats(),
  };
  home: TeamSetup;
  away: TeamSetup;
  finished = false;
  speed = 1;

  private i = 0;

  constructor(private replay: Replay) {
    this.home = replay.home;
    this.away = replay.away;
    this.players = replay.meta.map((m) => makePlayer(m));
    this.apply(0, 0);
  }

  get duration() {
    const f = this.replay.frames;
    return f.length ? f[f.length - 1]!.t : 0;
  }

  minute() {
    return Math.min(90, Math.floor(this.time / 60));
  }

  /** Avança o tempo de reprodução. */
  step(dt: number) {
    const dur = this.duration;
    if (dur <= 0) return;
    this.time = Math.min(dur, this.time + dt * this.speed);
    this.finished = this.time >= dur;
    this.sync();
  }

  seek(t: number) {
    this.time = Math.max(0, Math.min(this.duration, t));
    this.finished = false;
    this.i = 0;
    this.sync();
  }

  private sync() {
    const f = this.replay.frames;
    while (this.i < f.length - 2 && f[this.i + 1]!.t <= this.time) this.i++;
    while (this.i > 0 && f[this.i]!.t > this.time) this.i--;
    const a = f[this.i];
    const b = f[Math.min(f.length - 1, this.i + 1)];
    if (!a || !b) return;
    const span = b.t - a.t;
    const k = span > 0 ? Math.max(0, Math.min(1, (this.time - a.t) / span)) : 0;
    this.apply(this.i, k);
  }

  private apply(index: number, k: number) {
    const f = this.replay.frames;
    const a = f[index];
    if (!a) return;
    const b = f[Math.min(f.length - 1, index + 1)] ?? a;
    this.ball.x = lerp(a.b[0], b.b[0], k);
    this.ball.z = lerp(a.b[1], b.b[1], k);
    this.ball.height = lerp(a.b[2], b.b[2], k);
    this.ball.vx = (b.b[0] - a.b[0]) * 4;
    this.ball.vz = (b.b[1] - a.b[1]) * 4;
    this.possession = a.poss;
    this.stats.home.goals = a.hg;
    this.stats.away.goals = a.ag;
    for (let n = 0; n < this.players.length; n++) {
      const p = this.players[n]!;
      const o = n * 4;
      p.x = lerp(a.p[o] ?? 0, b.p[o] ?? 0, k);
      p.z = lerp(a.p[o + 1] ?? 0, b.p[o + 1] ?? 0, k);
      p.vx = a.p[o + 2] ?? 0;
      p.vz = a.p[o + 3] ?? 0;
      p.action = a.a[n] ?? null;
      p.actionT = p.action ? 0.3 : 0;
      p.actionDur = p.action ? 0.6 : 0;
    }
  }
}

function lerp(a: number, b: number, k: number) {
  return a + (b - a) * k;
}

function makePlayer(m: ReplayPlayerMeta): SimPlayer {
  return {
    id: m.id,
    side: m.side,
    name: m.name,
    number: m.number,
    pos: m.pos,
    x: 0,
    z: 0,
    vx: 0,
    vz: 0,
    slotX: 0,
    slotZ: 0,
    pace: 70,
    shooting: 70,
    passing: 70,
    defending: 70,
    physical: 70,
    stamina: 100,
    action: null,
    actionT: 0,
    actionDur: 0,
    pid: m.pid,
    goals: 0,
    assists: 0,
    shots: 0,
    passes: 0,
    tackles: 0,
    saves: 0,
    onSince: 0,
    minutes: 0,
  };
}

/* ---------------------------------------------------------------- *
 * Armazenamento
 * ---------------------------------------------------------------- */

export async function listReplays(): Promise<Replay[]> {
  if (typeof window === "undefined") return [];
  try {
    return (await get<Replay[]>(KEY)) ?? [];
  } catch {
    return [];
  }
}

export async function saveReplay(replay: Replay) {
  if (typeof window === "undefined") return;
  try {
    const list = await listReplays();
    await set(KEY, [replay, ...list].slice(0, MAX_REPLAYS));
  } catch {
    /* sem espaço: a partida segue normalmente */
  }
}

export async function deleteReplay(id: string) {
  if (typeof window === "undefined") return;
  try {
    const list = await listReplays();
    await set(
      KEY,
      list.filter((r) => r.id !== id),
    );
  } catch {
    /* ignore */
  }
}

/* ---------------------------------------------------------------- *
 * Exportação de vídeo
 * ---------------------------------------------------------------- */

export function canExportVideo() {
  return (
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    typeof HTMLCanvasElement.prototype.captureStream === "function"
  );
}

/** Grava o que está sendo desenhado no canvas e devolve um arquivo .webm. */
export function recordCanvas(canvas: HTMLCanvasElement, fps = 30) {
  const stream = canvas.captureStream(fps);
  const mime = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((m) =>
    MediaRecorder.isTypeSupported(m),
  );
  const rec = new MediaRecorder(
    stream,
    mime ? { mimeType: mime, videoBitsPerSecond: 6_000_000 } : undefined,
  );
  const chunks: BlobPart[] = [];
  rec.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  rec.start(250);
  return {
    stop: () =>
      new Promise<Blob>((resolve) => {
        rec.onstop = () => resolve(new Blob(chunks, { type: "video/webm" }));
        rec.stop();
      }),
  };
}
