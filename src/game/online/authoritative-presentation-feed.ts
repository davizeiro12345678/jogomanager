import {
  MATCH_PROTOCOL_VERSION,
  parseMatchReceiptV1,
  parseMatchSnapshotV1,
  type MatchReceiptV1,
  type MatchSeat,
  type MatchSnapshotV1,
} from "./match-protocol";

/**
 * Browser-side boundary for trusted server-authored WebSocket messages.
 *
 * This does NOT authenticate a server, verify a receipt signature, or create
 * a socket. Its caller must first establish an HTTPS/WSS connection to the
 * configured authority. Never feed a browser/client-owned Realtime message
 * to this reducer and call the result an official score.
 */
export type AuthorityFeedEvent =
  | { kind: "ready"; seat: MatchSeat; snapshot: MatchSnapshotV1 }
  | { kind: "snapshot"; snapshot: MatchSnapshotV1 }
  | { kind: "final"; receipt: MatchReceiptV1 }
  | { kind: "ack" | "nack"; sequence: number; reason?: string }
  | { kind: "pong" }
  | { kind: "ignored"; reason: "malformed" | "foreign_room" | "stale" | "conflict" };

const MAX_FRAME_BYTES = 64 * 1024;
const encoder = new TextEncoder();

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function parseSeat(value: unknown): MatchSeat | null {
  return value === "home" || value === "away" ? value : null;
}

function parseSequence(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
    ? value
    : null;
}

export class AuthoritativePresentationFeed {
  private current: MatchSnapshotV1 | null = null;
  private result: MatchReceiptV1 | null = null;
  private seat: MatchSeat | null = null;
  private lastSequence = 0;

  constructor(private readonly roomId: string) {
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(roomId))
      throw new Error("invalid authoritative presentation room");
  }

  snapshot(): MatchSnapshotV1 | null {
    return this.current ? structuredClone(this.current) : null;
  }

  receipt(): MatchReceiptV1 | null {
    return this.result ? structuredClone(this.result) : null;
  }

  confirmedSeat(): MatchSeat | null {
    return this.seat;
  }

  /**
   * A reconnect never clears the last accepted revision or final receipt.
   * Stale, conflicting, cross-room and maliciously oversized frames cannot
   * roll back an official scoreboard.
   */
  accept(raw: unknown): AuthorityFeedEvent {
    if (typeof raw !== "string" || raw.length > MAX_FRAME_BYTES)
      return { kind: "ignored", reason: "malformed" };
    if (encoder.encode(raw).byteLength > MAX_FRAME_BYTES)
      return { kind: "ignored", reason: "malformed" };
    let input: unknown;
    try {
      input = JSON.parse(raw) as unknown;
    } catch {
      return { kind: "ignored", reason: "malformed" };
    }
    if (!object(input) || input["version"] !== MATCH_PROTOCOL_VERSION)
      return { kind: "ignored", reason: "malformed" };

    if (input["type"] === "ready" || input["type"] === "snapshot") {
      const ready = input["type"] === "ready";
      if (!exactKeys(input, ready ? ["type", "version", "seat", "snapshot"] : ["type", "version", "snapshot"]))
        return { kind: "ignored", reason: "malformed" };
      const seat = ready ? parseSeat(input["seat"]) : null;
      if (ready && !seat) return { kind: "ignored", reason: "malformed" };
      if (ready && this.seat && this.seat !== seat)
        return { kind: "ignored", reason: "conflict" };
      let snapshot: MatchSnapshotV1;
      try {
        snapshot = parseMatchSnapshotV1(input["snapshot"], this.current ?? undefined);
      } catch {
        return { kind: "ignored", reason: "malformed" };
      }
      if (snapshot.roomId !== this.roomId)
        return { kind: "ignored", reason: "foreign_room" };
      if (this.result) return { kind: "ignored", reason: "stale" };
      if (this.current) {
        if (
          snapshot.revision < this.current.revision ||
          snapshot.tick < this.current.tick
        )
          return { kind: "ignored", reason: "stale" };
        if (snapshot.revision === this.current.revision) {
          return JSON.stringify(snapshot) === JSON.stringify(this.current)
            ? { kind: "ignored", reason: "stale" }
            : { kind: "ignored", reason: "conflict" };
        }
      }
      this.current = structuredClone(snapshot);
      if (ready) {
        this.seat = seat;
        return { kind: "ready", seat: seat!, snapshot: structuredClone(snapshot) };
      }
      return { kind: "snapshot", snapshot: structuredClone(snapshot) };
    }

    if (input["type"] === "final") {
      if (!exactKeys(input, ["type", "version", "receipt"]))
        return { kind: "ignored", reason: "malformed" };
      let receipt: MatchReceiptV1;
      try {
        receipt = parseMatchReceiptV1(input["receipt"]);
      } catch {
        return { kind: "ignored", reason: "malformed" };
      }
      if (receipt.roomId !== this.roomId)
        return { kind: "ignored", reason: "foreign_room" };
      if (this.result) {
        return JSON.stringify(this.result) === JSON.stringify(receipt)
          ? { kind: "ignored", reason: "stale" }
          : { kind: "ignored", reason: "conflict" };
      }
      this.result = structuredClone(receipt);
      return { kind: "final", receipt: structuredClone(receipt) };
    }

    if (input["type"] === "ack" || input["type"] === "nack") {
      if (!exactKeys(input, ["type", "version", "sequence", "reason"]))
        return { kind: "ignored", reason: "malformed" };
      const sequence = parseSequence(input["sequence"]);
      if (sequence === null || sequence < this.lastSequence)
        return { kind: "ignored", reason: "stale" };
      if (input["reason"] !== undefined &&
          (typeof input["reason"] !== "string" || input["reason"].length > 80))
        return { kind: "ignored", reason: "malformed" };
      this.lastSequence = sequence;
      return {
        kind: input["type"],
        sequence,
        ...(typeof input["reason"] === "string" ? { reason: input["reason"] } : {}),
      };
    }
    if (input["type"] === "pong" && exactKeys(input, ["type", "version"]))
      return { kind: "pong" };
    return { kind: "ignored", reason: "malformed" };
  }
}
