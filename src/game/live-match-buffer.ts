import type { PlayerAction } from "./animation";
import type { LiveSnapshot } from "./live-match";
import type { Side, SimPlayer } from "./sim";

export const MATCH_PLAYER_COUNT = 22;
export const PLAYER_STATE_STRIDE = 28;

const STATE = {
  slotX: 0,
  slotZ: 1,
  pace: 2,
  shooting: 3,
  passing: 4,
  defending: 5,
  physical: 6,
  stamina: 7,
  actionT: 8,
  actionDur: 9,
  action: 10,
  goals: 11,
  assists: 12,
  shots: 13,
  passes: 14,
  tackles: 15,
  saves: 16,
  onSince: 17,
  minutes: 18,
  yellows: 19,
  sentOff: 20,
  injuryWeeks: 21,
  interceptions: 22,
  offsides: 23,
  foulsWon: 24,
  pensScored: 25,
  pensMissed: 26,
  xg: 27,
} as const;

const ACTION_NAMES: readonly PlayerAction[] = [
  "shot",
  "shotPower",
  "shotPlaced",
  "bicycle",
  "headClear",
  "duel",
  "decelerate",
  "turn",
  "backpedal",
  "chip",
  "volley",
  "header",
  "firstTime",
  "pass",
  "passLong",
  "cross",
  "trap",
  "tackle",
  "slide",
  "block",
  "intercept",
  "save",
  "saveHigh",
  "diveLeft",
  "diveRight",
  "catch",
  "distribute",
  "goalKick",
  "throwIn",
  "corner",
  "freeKick",
  "penalty",
  "celebrate",
  "celebrateRun",
  "kneeSlide",
  "hug",
  "dejected",
  "protest",
  "feint",
  "cut",
  "stepover",
  "elastico",
];

export type LivePlayerMeta = Pick<
  SimPlayer,
  "id" | "side" | "name" | "number" | "pos" | "heightCm" | "weightKg" | "pid"
>;

export type LivePlayerBuffer = {
  positions: Float32Array;
  velocities: Float32Array;
  states: Float32Array;
};

export type LivePlayerBufferPacket = {
  positions: ArrayBuffer;
  velocities: ArrayBuffer;
  states: ArrayBuffer;
};

export type LiveEventDelta = {
  fromSeq: number;
  toSeq: number;
  added: readonly NonNullable<LiveSnapshot["events"]>[number][];
};

export type LiveSnapshotPacket = Omit<LiveSnapshot, "players" | "events"> & {
  type: "snapshot";
  rosterVersion: number;
  metadata?: readonly LivePlayerMeta[];
  players: LivePlayerBufferPacket;
  eventDelta?: LiveEventDelta;
  bufferStarvation?: number;
};

export type RecycledSnapshotBuffers = LivePlayerBufferPacket;
export type SnapshotBufferPool = ReturnType<typeof createSnapshotBufferPool>;

export function actionCode(action: PlayerAction | null): number {
  return action ? ACTION_NAMES.indexOf(action) + 1 : 0;
}

export function actionFromCode(code: number): PlayerAction | null {
  return code > 0 && Number.isInteger(code) ? (ACTION_NAMES[code - 1] ?? null) : null;
}

export function createLivePlayerMetadata(players: readonly SimPlayer[]): LivePlayerMeta[] {
  return players.map(({ id, side, name, number, pos, heightCm, weightKg, pid }) => ({
    id,
    side,
    name,
    number,
    pos,
    ...(heightCm === undefined ? {} : { heightCm }),
    ...(weightKg === undefined ? {} : { weightKg }),
    pid,
  }));
}

function allocatePlayerBuffer(length: number): LivePlayerBuffer {
  return {
    positions: new Float32Array(length * 2),
    velocities: new Float32Array(length * 2),
    states: new Float32Array(length * PLAYER_STATE_STRIDE),
  };
}

export function createLivePlayerBuffer(
  players: readonly SimPlayer[],
  target = allocatePlayerBuffer(players.length),
): LivePlayerBuffer {
  validateLivePlayerBuffer(target, players.length);
  players.forEach((player, index) => {
    target.positions[index * 2] = player.x;
    target.positions[index * 2 + 1] = player.z;
    target.velocities[index * 2] = player.vx;
    target.velocities[index * 2 + 1] = player.vz;
    const offset = index * PLAYER_STATE_STRIDE;
    target.states[offset + STATE.slotX] = player.slotX;
    target.states[offset + STATE.slotZ] = player.slotZ;
    target.states[offset + STATE.pace] = player.pace;
    target.states[offset + STATE.shooting] = player.shooting;
    target.states[offset + STATE.passing] = player.passing;
    target.states[offset + STATE.defending] = player.defending;
    target.states[offset + STATE.physical] = player.physical;
    target.states[offset + STATE.stamina] = player.stamina;
    target.states[offset + STATE.actionT] = player.actionT;
    target.states[offset + STATE.actionDur] = player.actionDur;
    target.states[offset + STATE.action] = actionCode(player.action);
    target.states[offset + STATE.goals] = player.goals;
    target.states[offset + STATE.assists] = player.assists;
    target.states[offset + STATE.shots] = player.shots;
    target.states[offset + STATE.passes] = player.passes;
    target.states[offset + STATE.tackles] = player.tackles;
    target.states[offset + STATE.saves] = player.saves;
    target.states[offset + STATE.onSince] = player.onSince;
    target.states[offset + STATE.minutes] = player.minutes;
    target.states[offset + STATE.yellows] = player.yellows;
    target.states[offset + STATE.sentOff] = player.sentOff ? 1 : 0;
    target.states[offset + STATE.injuryWeeks] = player.injuryWeeks;
    target.states[offset + STATE.interceptions] = player.interceptions;
    target.states[offset + STATE.offsides] = player.offsides;
    target.states[offset + STATE.foulsWon] = player.foulsWon;
    target.states[offset + STATE.pensScored] = player.pensScored;
    target.states[offset + STATE.pensMissed] = player.pensMissed;
    target.states[offset + STATE.xg] = player.xg;
  });
  return target;
}

export function validateLivePlayerBuffer(buffer: LivePlayerBuffer, length: number) {
  if (buffer.positions.length !== length * 2) throw new RangeError("positions buffer length");
  if (buffer.velocities.length !== length * 2) throw new RangeError("velocities buffer length");
  if (buffer.states.length !== length * PLAYER_STATE_STRIDE)
    throw new RangeError("states buffer length");
}

function playerFromMeta(meta: LivePlayerMeta): SimPlayer {
  return {
    ...meta,
    x: 0,
    z: 0,
    vx: 0,
    vz: 0,
    slotX: 0,
    slotZ: 0,
    pace: 0,
    shooting: 0,
    passing: 0,
    defending: 0,
    physical: 0,
    stamina: 0,
    action: null,
    actionT: 0,
    actionDur: 0,
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
}

export function ensureLivePlayers(
  existing: SimPlayer[],
  metadata: readonly LivePlayerMeta[],
): SimPlayer[] {
  if (
    existing.length === metadata.length &&
    metadata.every((meta, index) => existing[index]?.id === meta.id)
  ) {
    return existing;
  }
  return metadata.map(playerFromMeta);
}

export function applyLivePlayerBuffer(
  target: SimPlayer[],
  metadata: readonly LivePlayerMeta[],
  buffer: LivePlayerBuffer,
): SimPlayer[] {
  validateLivePlayerBuffer(buffer, metadata.length);
  const players = ensureLivePlayers(target, metadata);
  players.forEach((player, index) => {
    const position = index * 2;
    const offset = index * PLAYER_STATE_STRIDE;
    player.x = buffer.positions[position]!;
    player.z = buffer.positions[position + 1]!;
    player.vx = buffer.velocities[position]!;
    player.vz = buffer.velocities[position + 1]!;
    player.slotX = buffer.states[offset + STATE.slotX]!;
    player.slotZ = buffer.states[offset + STATE.slotZ]!;
    player.pace = buffer.states[offset + STATE.pace]!;
    player.shooting = buffer.states[offset + STATE.shooting]!;
    player.passing = buffer.states[offset + STATE.passing]!;
    player.defending = buffer.states[offset + STATE.defending]!;
    player.physical = buffer.states[offset + STATE.physical]!;
    player.stamina = buffer.states[offset + STATE.stamina]!;
    player.actionT = buffer.states[offset + STATE.actionT]!;
    player.actionDur = buffer.states[offset + STATE.actionDur]!;
    player.action = actionFromCode(buffer.states[offset + STATE.action]!);
    player.goals = buffer.states[offset + STATE.goals]!;
    player.assists = buffer.states[offset + STATE.assists]!;
    player.shots = buffer.states[offset + STATE.shots]!;
    player.passes = buffer.states[offset + STATE.passes]!;
    player.tackles = buffer.states[offset + STATE.tackles]!;
    player.saves = buffer.states[offset + STATE.saves]!;
    player.onSince = buffer.states[offset + STATE.onSince]!;
    player.minutes = buffer.states[offset + STATE.minutes]!;
    player.yellows = buffer.states[offset + STATE.yellows]!;
    player.sentOff = buffer.states[offset + STATE.sentOff]! >= 0.5;
    player.injuryWeeks = buffer.states[offset + STATE.injuryWeeks]!;
    player.interceptions = buffer.states[offset + STATE.interceptions]!;
    player.offsides = buffer.states[offset + STATE.offsides]!;
    player.foulsWon = buffer.states[offset + STATE.foulsWon]!;
    player.pensScored = buffer.states[offset + STATE.pensScored]!;
    player.pensMissed = buffer.states[offset + STATE.pensMissed]!;
    player.xg = buffer.states[offset + STATE.xg]!;
  });
  return players;
}

export function transferablesForSnapshot(
  packet: Pick<LiveSnapshotPacket, "players">,
): ArrayBuffer[] {
  return [packet.players.positions, packet.players.velocities, packet.players.states];
}

export function recycleSnapshot(
  packet: Pick<LiveSnapshotPacket, "players">,
): RecycledSnapshotBuffers {
  return {
    positions: packet.players.positions,
    velocities: packet.players.velocities,
    states: packet.players.states,
  };
}

export function createSnapshotBufferPool(maxSlots = 3) {
  const free: LivePlayerBuffer[] = [];
  let allocated = 0;
  let starvation = 0;
  return {
    acquire(length: number): LivePlayerBuffer {
      const index = free.findIndex(
        (candidate) =>
          candidate.positions.length === length * 2 &&
          candidate.velocities.length === length * 2 &&
          candidate.states.length === length * PLAYER_STATE_STRIDE,
      );
      if (index >= 0) return free.splice(index, 1)[0]!;
      if (allocated >= maxSlots) starvation += 1;
      else allocated += 1;
      return allocatePlayerBuffer(length);
    },
    release(buffer: LivePlayerBuffer) {
      if (free.length >= maxSlots) return;
      if (free.includes(buffer)) return;
      free.push(buffer);
    },
    available: () => free.length,
    starvationCount: () => starvation,
  };
}

export function isLiveSnapshotPacket(value: unknown): value is LiveSnapshotPacket {
  if (!value || typeof value !== "object") return false;
  const packet = value as Partial<LiveSnapshotPacket>;
  return (
    packet.type === "snapshot" &&
    typeof packet.rosterVersion === "number" &&
    !!packet.players &&
    !Array.isArray(packet.players) &&
    packet.players.positions instanceof ArrayBuffer &&
    packet.players.velocities instanceof ArrayBuffer &&
    packet.players.states instanceof ArrayBuffer
  );
}

export function livePlayerBufferFromPacket(packet: LiveSnapshotPacket): LivePlayerBuffer {
  const length = packet.metadata?.length ?? MATCH_PLAYER_COUNT;
  const buffer: LivePlayerBuffer = {
    positions: new Float32Array(packet.players.positions),
    velocities: new Float32Array(packet.players.velocities),
    states: new Float32Array(packet.players.states),
  };
  validateLivePlayerBuffer(buffer, length);
  return buffer;
}

export function sideFromMeta(meta: LivePlayerMeta): Side {
  return meta.side;
}
