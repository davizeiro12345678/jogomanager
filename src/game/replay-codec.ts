import { actionCode, actionFromCode } from "./live-match-buffer";
import type { PlayerAction } from "./animation";
import type { Replay, ReplayFrame, ReplayPlayerMeta } from "./replay";
import type { TeamSetup } from "./sim";
import type { VersionedVisualData } from "./visual-context";

export const REPLAY_FORMAT_V2 = 2;
export const REPLAY_FORMAT_V3 = 3;
export const REPLAY_V3_MIN_REDUCTION = 0.2;
const QUANTIZE = 100;

export type StoredReplayV3 = {
  version: typeof REPLAY_FORMAT_V3;
  id: string;
  createdAt: number;
  title: string;
  home: TeamSetup;
  away: TeamSetup;
  meta: ReplayPlayerMeta[];
  score: [number, number];
  frames: {
    timesMs: Uint32Array;
    ball: Int16Array;
    positions: Int16Array;
    actions: Uint8Array;
    score: Uint16Array;
    possession: Uint8Array;
    visual?: (VersionedVisualData | null)[];
  };
};

export type StoredReplayV2 = Replay & { version: typeof REPLAY_FORMAT_V2 };
export type StoredReplay = StoredReplayV2 | StoredReplayV3;

function integer(value: number) {
  return Math.max(-32_768, Math.min(32_767, Math.round(value * QUANTIZE)));
}

function numeric(values: Int16Array | Uint8Array | Uint16Array | Uint32Array, index: number) {
  return values[index] ?? 0;
}

export function encodeReplay(replay: Replay): StoredReplayV3 {
  const frames = replay.frames;
  const playerCount = replay.meta.length;
  const timesMs = new Uint32Array(frames.length);
  const ball = new Int16Array(frames.length * 3);
  const positions = new Int16Array(frames.length * playerCount * 4);
  const actions = new Uint8Array(frames.length * playerCount);
  const score = new Uint16Array(frames.length * 2);
  const possession = new Uint8Array(frames.length);
  let previousTimeMs = 0;
  const hasVisual = frames.some((frame) => frame.v !== undefined);
  const visual = hasVisual ? frames.map((frame) => frame.v ?? null) : undefined;

  frames.forEach((frame, frameIndex) => {
    const timeMs = Math.max(previousTimeMs, Math.round(frame.t * 1_000));
    timesMs[frameIndex] = timeMs - previousTimeMs;
    previousTimeMs = timeMs;
    for (let axis = 0; axis < 3; axis += 1) ball[frameIndex * 3 + axis] = integer(frame.b[axis]! / 1);
    score[frameIndex * 2] = Math.max(0, Math.min(65_535, frame.hg));
    score[frameIndex * 2 + 1] = Math.max(0, Math.min(65_535, frame.ag));
    possession[frameIndex] = frame.poss === "away" ? 1 : 0;
    for (let playerIndex = 0; playerIndex < playerCount; playerIndex += 1) {
      const source = playerIndex * 4;
      const target = (frameIndex * playerCount + playerIndex) * 4;
      positions[target] = integer(frame.p[source] ?? 0 / 1);
      positions[target + 1] = integer(frame.p[source + 1] ?? 0 / 1);
      positions[target + 2] = integer(frame.p[source + 2] ?? 0 / 1);
      positions[target + 3] = integer(frame.p[source + 3] ?? 0 / 1);
      actions[frameIndex * playerCount + playerIndex] = actionCode(frame.a[playerIndex] ?? null);
    }
  });

  return {
    version: REPLAY_FORMAT_V3,
    id: replay.id,
    createdAt: replay.createdAt,
    title: replay.title,
    home: replay.home,
    away: replay.away,
    meta: replay.meta,
    score: replay.score,
    frames: {
      timesMs,
      ball,
      positions,
      actions,
      score,
      possession,
      ...(visual ? { visual } : {}),
    },
  };
}

function decodeV3(raw: StoredReplayV3): Replay {
  const frames: ReplayFrame[] = [];
  const playerCount = raw.meta.length;
  const times = raw.frames.timesMs;
  const ball = raw.frames.ball;
  const positions = raw.frames.positions;
  const actions = raw.frames.actions;
  const score = raw.frames.score;
  const possession = raw.frames.possession;
  let timeMs = 0;
  for (let frameIndex = 0; frameIndex < times.length; frameIndex += 1) {
    timeMs += numeric(times, frameIndex);
    const p: number[] = [];
    const a: (PlayerAction | null)[] = [];
    for (let playerIndex = 0; playerIndex < playerCount; playerIndex += 1) {
      const offset = (frameIndex * playerCount + playerIndex) * 4;
      p.push(
        numeric(positions, offset) / QUANTIZE,
        numeric(positions, offset + 1) / QUANTIZE,
        numeric(positions, offset + 2) / QUANTIZE,
        numeric(positions, offset + 3) / QUANTIZE,
      );
      a.push(actionFromCode(numeric(actions, frameIndex * playerCount + playerIndex)));
    }
    frames.push({
      t: timeMs / 1_000,
      b: [
        numeric(ball, frameIndex * 3) / QUANTIZE,
        numeric(ball, frameIndex * 3 + 1) / QUANTIZE,
        numeric(ball, frameIndex * 3 + 2) / QUANTIZE,
      ],
      p,
      a,
      hg: numeric(score, frameIndex * 2),
      ag: numeric(score, frameIndex * 2 + 1),
      poss: numeric(possession, frameIndex) === 1 ? "away" : "home",
      ...(raw.frames.visual?.[frameIndex] ? { v: raw.frames.visual[frameIndex]! } : {}),
    });
  }
  return {
    id: raw.id,
    createdAt: raw.createdAt,
    title: raw.title,
    home: raw.home,
    away: raw.away,
    meta: raw.meta,
    frames,
    score: raw.score,
  };
}

export function decodeReplay(raw: unknown): Replay {
  if (!raw || typeof raw !== "object") throw new TypeError("replay inválido");
  const candidate = raw as { version?: unknown };
  if (candidate.version === REPLAY_FORMAT_V3) return decodeV3(raw as StoredReplayV3);
  if (candidate.version === REPLAY_FORMAT_V2) {
    const { version: _version, ...legacy } = raw as Replay & { version: number };
    return legacy;
  }
  return raw as Replay;
}

export function estimateReplayBytes(replay: Replay, stored: StoredReplayV3) {
  const text = new TextEncoder();
  const v2Bytes = text.encode(JSON.stringify(replay)).byteLength;
  const arrays = [
    stored.frames.timesMs,
    stored.frames.ball,
    stored.frames.positions,
    stored.frames.actions,
    stored.frames.score,
    stored.frames.possession,
  ];
  const envelope = {
    version: stored.version,
    id: stored.id,
    createdAt: stored.createdAt,
    title: stored.title,
    home: stored.home,
    away: stored.away,
    meta: stored.meta,
    score: stored.score,
    visual: stored.frames.visual,
  };
  const v3Bytes = arrays.reduce((sum, value) => sum + value.byteLength, 0) + text.encode(JSON.stringify(envelope)).byteLength;
  return {
    frameCount: replay.frames.length,
    v2Bytes,
    v3Bytes,
    reductionRatio: v2Bytes ? 1 - v3Bytes / v2Bytes : 0,
  };
}

export function encodeStoredReplay(replay: Replay): StoredReplay {
  const compact = encodeReplay(replay);
  const report = estimateReplayBytes(replay, compact);
  return report.reductionRatio >= REPLAY_V3_MIN_REDUCTION
    ? compact
    : { version: REPLAY_FORMAT_V2, ...replay };
}
