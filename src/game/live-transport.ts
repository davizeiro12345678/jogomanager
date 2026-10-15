import type { PlayerAction } from "./animation";
import type { LiveSnapshot } from "./live-match";
import type { SimPlayer } from "./sim";

// Append only: codes are part of the transport and future replay dictionary.
export const ACTION_DICTIONARY: readonly (PlayerAction | null)[] = [
  null,
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
const actionCodes = new Map(ACTION_DICTIONARY.map((action, code) => [action, code]));
export const PLAYER_FRAME_FIELDS = [
  "x",
  "z",
  "vx",
  "vz",
  "slotX",
  "slotZ",
  "pace",
  "shooting",
  "passing",
  "defending",
  "physical",
  "stamina",
  "actionT",
  "actionDur",
  "goals",
  "assists",
  "shots",
  "passes",
  "tackles",
  "saves",
  "onSince",
  "minutes",
  "yellows",
  "injuryWeeks",
  "interceptions",
  "offsides",
  "foulsWon",
  "pensScored",
  "pensMissed",
  "xg",
] as const satisfies readonly (keyof SimPlayer)[];
const stride = PLAYER_FRAME_FIELDS.length + 2;
type PlayerMeta = Omit<SimPlayer, (typeof PLAYER_FRAME_FIELDS)[number] | "action" | "sentOff">;
const PLAYER_META_FIELDS = [
  "id",
  "side",
  "name",
  "number",
  "pos",
  "heightCm",
  "weightKg",
  "pid",
] as const satisfies readonly (keyof PlayerMeta)[];
// Adding a metadata field to SimPlayer must also update this transport contract.
const metadataContractComplete: Exclude<
  keyof PlayerMeta,
  (typeof PLAYER_META_FIELDS)[number]
> extends never
  ? true
  : never = true;
void metadataContractComplete;

function metadataFor(player: SimPlayer): PlayerMeta {
  return {
    id: player.id,
    side: player.side,
    name: player.name,
    number: player.number,
    pos: player.pos,
    pid: player.pid,
    ...(player.heightCm === undefined ? {} : { heightCm: player.heightCm }),
    ...(player.weightKg === undefined ? {} : { weightKg: player.weightKg }),
  };
}
export interface PackedLiveSnapshot extends Omit<LiveSnapshot, "players" | "events"> {
  transport: 1;
  session: number;
  slot: number;
  rosterRevision: number;
  roster?: PlayerMeta[];
  count: number;
  frame: Float32Array<ArrayBuffer>;
  eventBase: number;
  eventReset: boolean;
  eventDelta: NonNullable<LiveSnapshot["events"]>;
}
type Slot = { buffer: ArrayBuffer | null; bytes: number };

/** Three copies owned by the transport, never by MatchSim. */
export class LiveSnapshotEncoder {
  private slots: Slot[] = Array.from({ length: 3 }, () => ({
    buffer: new ArrayBuffer(0),
    bytes: 0,
  }));
  private roster: PlayerMeta[] = [];
  private forceRoster = true;
  private rosterRevision = 0;
  private eventSeq = 0;
  private forceReset = true;
  readonly session: number;
  constructor(session: number) {
    this.session = session;
  }
  hasAvailableBuffer(): boolean {
    return this.slots.some((slot) => slot.buffer !== null);
  }
  resync() {
    this.forceRoster = true;
    this.forceReset = true;
  }
  recycle(session: number, slot: number, buffer: ArrayBuffer): boolean {
    const entry = this.slots[slot];
    if (
      session !== this.session ||
      !entry ||
      entry.buffer !== null ||
      buffer.byteLength !== entry.bytes
    )
      return false;
    entry.buffer = buffer;
    return true;
  }
  encode(snapshot: LiveSnapshot): PackedLiveSnapshot | null {
    const slot = this.slots.findIndex((entry) => entry.buffer !== null);
    if (slot < 0) return null;
    const entry = this.slots[slot]!;
    const bytes = snapshot.players.length * stride * Float32Array.BYTES_PER_ELEMENT;
    if (entry.buffer!.byteLength !== bytes) entry.buffer = new ArrayBuffer(bytes);
    const frame = new Float32Array(entry.buffer!);
    // Only eight primitive metadata fields need comparison. No cloned player
    // objects, deleted frame properties or JSON strings in an unchanged frame.
    let rosterChanged = this.forceRoster || this.roster.length !== snapshot.players.length;
    if (!rosterChanged) {
      for (let index = 0; index < snapshot.players.length && !rosterChanged; index++) {
        const player = snapshot.players[index]!,
          cached = this.roster[index]!;
        for (const field of PLAYER_META_FIELDS) {
          if (!Object.is(player[field], cached[field])) {
            rosterChanged = true;
            break;
          }
        }
      }
    }
    if (rosterChanged) {
      this.roster = snapshot.players.map(metadataFor);
      this.forceRoster = false;
      this.rosterRevision++;
    }
    snapshot.players.forEach((player, index) => {
      const offset = index * stride;
      PLAYER_FRAME_FIELDS.forEach((field, column) => {
        frame[offset + column] = player[field];
      });
      frame[offset + stride - 2] = actionCodes.get(player.action) ?? 0;
      frame[offset + stride - 1] = player.sentOff ? 1 : 0;
    });
    const events = snapshot.events ?? [];
    const missing = snapshot.eventSeq - this.eventSeq;
    const reset = this.forceReset || missing < 0 || missing > events.length;
    const delta = reset ? events : missing > 0 ? events.slice(-missing) : [];
    const { players: _players, events: _events, ...header } = snapshot;
    const packed: PackedLiveSnapshot = {
      ...header,
      transport: 1,
      session: this.session,
      slot,
      rosterRevision: this.rosterRevision,
      ...(rosterChanged ? { roster: this.roster } : {}),
      count: snapshot.players.length,
      frame,
      eventBase: this.eventSeq,
      eventReset: reset,
      eventDelta: delta,
    };
    this.eventSeq = snapshot.eventSeq;
    this.forceReset = false;
    entry.bytes = bytes;
    entry.buffer = null;
    return packed;
  }
}

/** Decoded storage stays client-owned after the received buffer is recycled. */
export class LiveSnapshotDecoder {
  private session: number | null = null;
  private revision = 0;
  private sequence = -1;
  private players: SimPlayer[] = [];
  private events: NonNullable<LiveSnapshot["events"]> = [];
  private eventSeq = 0;
  decode(packet: PackedLiveSnapshot): LiveSnapshot | null {
    if (
      packet.transport !== 1 ||
      !Number.isInteger(packet.session) ||
      packet.session < 0 ||
      !Number.isInteger(packet.rosterRevision) ||
      packet.rosterRevision < 1 ||
      !Number.isInteger(packet.eventBase) ||
      packet.eventBase < 0 ||
      !(packet.frame instanceof Float32Array) ||
      packet.count < 0 ||
      packet.count > 64 ||
      !Number.isInteger(packet.count) ||
      !Number.isInteger(packet.seq) ||
      !Number.isInteger(packet.eventSeq) ||
      packet.eventSeq < 0 ||
      !Array.isArray(packet.eventDelta) ||
      packet.eventDelta.length > 80 ||
      packet.frame.length !== packet.count * stride ||
      !packet.frame.every(Number.isFinite)
    )
      throw new Error("Invalid live frame");
    // Validate all codes before changing cached metadata or player state.
    for (let index = 0; index < packet.count; index++) {
      const code = packet.frame[index * stride + stride - 2]!;
      const sentOff = packet.frame[index * stride + stride - 1]!;
      if (
        !Number.isInteger(code) ||
        code < 0 ||
        code >= ACTION_DICTIONARY.length ||
        (sentOff !== 0 && sentOff !== 1)
      )
        throw new Error("Invalid live action code");
    }
    if (!packet.eventReset && packet.eventSeq - packet.eventBase !== packet.eventDelta.length)
      throw new Error("Invalid live event cursor delta");
    if (this.session !== null && packet.session < this.session) return null;
    const newSession = packet.session !== this.session;
    if (newSession) {
      if (!packet.roster || !packet.eventReset) throw new Error("Missing session metadata");
    }
    if (!newSession && packet.seq <= this.sequence) return null;
    if (packet.roster) {
      if (
        packet.roster.length !== packet.count ||
        new Set(packet.roster.map((p) => p.id)).size !== packet.count
      )
        throw new Error("Invalid live roster");
    }
    const players = packet.roster
      ? packet.roster.map((meta) => ({ ...meta }) as SimPlayer)
      : this.players;
    const revision = packet.roster ? packet.rosterRevision : this.revision;
    if (revision !== packet.rosterRevision || players.length !== packet.count)
      throw new Error("Live roster revision gap");
    if (!packet.eventReset && packet.eventBase !== (newSession ? 0 : this.eventSeq))
      throw new Error("Live event cursor gap");
    // Commit session and metadata only after the entire envelope validates.
    // A malformed packet from a newer worker must not poison a valid session.
    this.session = packet.session;
    this.players = players;
    this.revision = revision;
    this.players.forEach((player, index) => {
      const offset = index * stride;
      PLAYER_FRAME_FIELDS.forEach((field, column) => {
        player[field] = packet.frame[offset + column]!;
      });
      const code = packet.frame[offset + stride - 2]!;
      player.action = ACTION_DICTIONARY[code]!;
      player.sentOff = packet.frame[offset + stride - 1] === 1;
    });
    this.events = packet.eventReset
      ? packet.eventDelta.map((e) => ({ ...e }))
      : [...this.events, ...packet.eventDelta.map((e) => ({ ...e }))].slice(-80);
    this.eventSeq = packet.eventSeq;
    this.sequence = packet.seq;
    const {
      transport: _transport,
      session: _session,
      slot: _slot,
      rosterRevision: _revision,
      roster: _roster,
      count: _count,
      frame: _frame,
      eventBase: _base,
      eventReset: _reset,
      eventDelta: _delta,
      ...header
    } = packet;
    return { ...header, players: this.players, events: this.events };
  }
}
