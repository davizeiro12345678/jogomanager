import type { Replay, ReplayFrame } from "./replay";
import type { VersionedVisualData } from "./visual-context";
import { ACTION_DICTIONARY } from "./live-transport.ts";

type VisualContext =
  VersionedVisualData["actionContexts"][number] | VersionedVisualData["contactContexts"][number];
export interface ReplayV3 extends Omit<Replay, "frames"> {
  codec: 3;
  frameCount: number;
  playerCapacity: number;
  timeDeltas: Uint32Array;
  motion: Float32Array;
  actions: Uint8Array;
  timing: Float32Array;
  timingPresent: Uint8Array;
  actionDictionary: typeof ACTION_DICTIONARY;
  scoreboard: Uint16Array;
  possessions: Uint8Array;
  visualVersions: Uint8Array;
  contexts: VisualContext[];
  contextIndices: Uint32Array;
  visualMetadata: Array<VersionedVisualData["metadata"] | undefined>;
  rosterFrames: Array<{ at: number; meta: Replay["meta"] }>;
}

export function encodeReplayV3(replay: Replay): ReplayV3 {
  const count = Math.max(
      replay.meta.length,
      ...(replay.rosterFrames ?? []).map((change) => change.meta.length),
    ),
    frames = replay.frames.length,
    stride = count * 4 + 3;
  if (count > 64 || frames > 100_000) throw new Error("Replay exceeds codec limits");
  const motion = new Float32Array(frames * stride),
    actions = new Uint8Array(frames * count);
  const timing = new Float32Array(frames * count * 2),
    timingPresent = new Uint8Array(frames);
  const timeDeltas = new Uint32Array(frames),
    scoreboard = new Uint16Array(frames * 2);
  const possessions = new Uint8Array(frames),
    visualVersions = new Uint8Array(frames);
  const contextIndices = new Uint32Array(frames * count * 2);
  const contexts: VisualContext[] = [null];
  const keys = new Map<string, number>([["null", 0]]);
  const visualMetadata: ReplayV3["visualMetadata"] = [];
  let previous = 0;
  const intern = (context: VisualContext) => {
    const key = JSON.stringify(context ?? null);
    let index = keys.get(key);
    if (index === undefined) {
      index = contexts.length;
      keys.set(key, index);
      contexts.push(structuredClone(context));
    }
    return index;
  };
  replay.frames.forEach((frame, index) => {
    const time = Math.round(frame.t * 1000);
    if (!Number.isFinite(time) || time < previous || time - previous > 0xffffffff)
      throw new Error("Invalid replay timestamp");
    timeDeltas[index] = time - previous;
    previous = time;
    let active = replay.meta.length;
    for (const change of replay.rosterFrames ?? []) {
      if (change.at > index) break;
      active = change.meta.length;
    }
    if (frame.p.length !== active * 4 || frame.a.length !== active)
      throw new Error("Replay roster requires frame metadata");
    if (frame.timing) {
      if (frame.timing.length !== active * 2 || !frame.timing.every(Number.isFinite))
        throw new Error("Invalid replay action timing");
      timing.set(frame.timing, index * count * 2);
      timingPresent[index] = 1;
    }
    motion.set(frame.b, index * stride);
    motion.set(frame.p, index * stride + 3);
    frame.a.forEach((action, player) => {
      const code = ACTION_DICTIONARY.indexOf(action);
      if (code < 0) throw new Error("Unknown replay action");
      actions[index * count + player] = code;
    });
    scoreboard[index * 2] = frame.hg;
    scoreboard[index * 2 + 1] = frame.ag;
    possessions[index] = frame.poss === "home" ? 0 : 1;
    visualVersions[index] = frame.v?.version ?? 0;
    visualMetadata.push(frame.v?.metadata ? structuredClone(frame.v.metadata) : undefined);
    for (let player = 0; player < count; player++) {
      contextIndices[(index * count + player) * 2] = intern(
        frame.v?.actionContexts[player] ?? null,
      );
      contextIndices[(index * count + player) * 2 + 1] = intern(
        frame.v?.contactContexts[player] ?? null,
      );
    }
  });
  const { frames: _frames, ...metadata } = replay;
  return {
    ...metadata,
    codec: 3,
    frameCount: frames,
    playerCapacity: count,
    timeDeltas,
    motion,
    actions,
    timing,
    timingPresent,
    actionDictionary: [...ACTION_DICTIONARY],
    scoreboard,
    possessions,
    visualVersions,
    contexts,
    contextIndices,
    visualMetadata,
    rosterFrames: replay.rosterFrames ?? [],
  };
}

export function decodeReplay(stored: Replay | ReplayV3): Replay {
  if (!("codec" in stored)) return stored;
  if (stored.codec !== 3) throw new Error("Unsupported replay codec");
  const validRoster = (meta: Replay["meta"]) =>
    Array.isArray(meta) &&
    meta.length <= 64 &&
    meta.every(
      (player) =>
        typeof player?.id === "string" &&
        player.id.length > 0 &&
        (player.side === "home" || player.side === "away"),
    ) &&
    new Set(meta.map((player) => player.id)).size === meta.length;
  if (!validRoster(stored.meta) || !Array.isArray(stored.rosterFrames))
    throw new Error("Corrupt replay roster");
  if (
    !Array.isArray(stored.actionDictionary) ||
    stored.actionDictionary.length > 256 ||
    stored.actionDictionary.some((action) => !ACTION_DICTIONARY.includes(action))
  )
    throw new Error("Corrupt replay action dictionary");
  let priorRevision = -1;
  for (const change of stored.rosterFrames) {
    if (
      !Number.isInteger(change.at) ||
      change.at < 0 ||
      change.at >= stored.frameCount ||
      change.at <= priorRevision ||
      !validRoster(change.meta)
    )
      throw new Error("Corrupt replay roster revision");
    priorRevision = change.at;
  }
  const count = stored.playerCapacity,
    frames = stored.frameCount,
    stride = count * 4 + 3;
  if (
    !(stored.motion instanceof Float32Array) ||
    !(stored.timeDeltas instanceof Uint32Array) ||
    !(stored.actions instanceof Uint8Array) ||
    !(stored.timing instanceof Float32Array) ||
    !(stored.timingPresent instanceof Uint8Array) ||
    !(stored.scoreboard instanceof Uint16Array) ||
    !(stored.possessions instanceof Uint8Array) ||
    !(stored.contextIndices instanceof Uint32Array) ||
    !(stored.visualVersions instanceof Uint8Array) ||
    !Array.isArray(stored.contexts) ||
    !Array.isArray(stored.visualMetadata) ||
    stored.visualMetadata.length !== frames ||
    !stored.possessions.every((value) => value === 0 || value === 1) ||
    !stored.timingPresent.every((value) => value === 0 || value === 1) ||
    !Number.isInteger(count) ||
    count < stored.meta.length ||
    count > 64 ||
    frames < 0 ||
    frames > 100_000 ||
    !Number.isInteger(frames) ||
    stored.motion.length !== frames * stride ||
    stored.timeDeltas.length !== frames ||
    stored.actions.length !== frames * count ||
    stored.contextIndices.length !== frames * count * 2 ||
    stored.scoreboard.length !== frames * 2 ||
    stored.possessions.length !== frames ||
    stored.visualVersions.length !== frames ||
    stored.timing.length !== frames * count * 2 ||
    stored.timingPresent.length !== frames ||
    !stored.timing.every(Number.isFinite) ||
    !stored.motion.every(Number.isFinite)
  )
    throw new Error("Corrupt replay arrays");
  let time = 0;
  const decoded: ReplayFrame[] = [];
  for (let index = 0; index < frames; index++) {
    time += stored.timeDeltas[index]!;
    const offset = index * stride;
    let active = stored.meta.length;
    for (const change of stored.rosterFrames) {
      if (change.at > index) break;
      active = change.meta.length;
    }
    if (active > count) throw new Error("Corrupt replay roster");
    const a = Array.from(stored.actions.subarray(index * count, index * count + active), (code) => {
      if (code >= stored.actionDictionary.length) throw new Error("Corrupt replay action");
      return stored.actionDictionary[code]!;
    });
    const frame: ReplayFrame = {
      t: time / 1000,
      b: [stored.motion[offset]!, stored.motion[offset + 1]!, stored.motion[offset + 2]!],
      p: Array.from(stored.motion.subarray(offset + 3, offset + 3 + active * 4)),
      a,
      hg: stored.scoreboard[index * 2]!,
      ag: stored.scoreboard[index * 2 + 1]!,
      poss: stored.possessions[index] === 0 ? "home" : "away",
    };
    if (stored.timingPresent[index])
      frame.timing = Array.from(
        stored.timing.subarray(index * count * 2, index * count * 2 + active * 2),
      );
    const version = stored.visualVersions[index]!;
    if (version) {
      const get = (player: number, column: number) => {
        const key = stored.contextIndices[(index * count + player) * 2 + column]!;
        if (key >= stored.contexts.length) throw new Error("Corrupt replay context");
        return structuredClone(stored.contexts[key]);
      };
      frame.v = {
        version: version as VersionedVisualData["version"],
        actionContexts: Array.from({ length: active }, (_, player) =>
          get(player, 0),
        ) as VersionedVisualData["actionContexts"],
        contactContexts: Array.from({ length: active }, (_, player) =>
          get(player, 1),
        ) as VersionedVisualData["contactContexts"],
      };
      const metadata = stored.visualMetadata[index];
      if (metadata !== undefined) frame.v.metadata = structuredClone(metadata);
    }
    decoded.push(frame);
  }
  const {
    codec: _codec,
    frameCount: _count,
    playerCapacity: _capacity,
    timing: _timing,
    timingPresent: _present,
    timeDeltas: _times,
    motion: _motion,
    actions: _actions,
    actionDictionary: _dict,
    scoreboard: _score,
    possessions: _poss,
    visualVersions: _versions,
    contexts: _contexts,
    contextIndices: _indices,
    visualMetadata: _metadata,
    ...header
  } = stored;
  return { ...header, frames: decoded };
}
