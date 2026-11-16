import { z } from "zod";
import { parseMatchSnapshotV1, type MatchSnapshotV1 } from "./match-protocol";

const SafeTime = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const SpectatorCheckpointSchema = z
  .object({
    version: z.literal(1),
    roomId: z.string().uuid(),
    delayMs: z.number().int().min(10_000).max(300_000),
    capacity: z.number().int().min(1).max(4096),
    pending: z
      .array(z.object({ releaseAt: SafeTime, snapshot: z.unknown() }).strict())
      .max(4096),
    lastAccepted: z.unknown().nullable(),
    lastAcceptedAt: z.number().int().min(-1).max(Number.MAX_SAFE_INTEGER),
    lastReleased: z.unknown().nullable(),
  })
  .strict();

/** Private checkpoint: never send this buffer to a spectator client. */
export interface DelayedSpectatorCheckpointV1 {
  version: 1;
  roomId: string;
  delayMs: number;
  capacity: number;
  pending: { releaseAt: number; snapshot: MatchSnapshotV1 }[];
  lastAccepted: MatchSnapshotV1 | null;
  lastAcceptedAt: number;
  lastReleased: MatchSnapshotV1 | null;
}

/**
 * Server-owned spectator delay. The upstream room must authorize spectator
 * access, rate-limit joins and supply only public authoritative snapshots.
 * Never expose seat tickets, private seed, checkpoints or command history.
 */
export class DelayedSpectatorFeed {
  private readonly pending: { releaseAt: number; snapshot: MatchSnapshotV1 }[] = [];
  private lastAccepted: MatchSnapshotV1 | null = null;
  private lastAcceptedAt = -1;
  private lastReleased: MatchSnapshotV1 | null = null;

  constructor(
    private readonly roomId: string,
    private readonly delayMs = 30_000,
    private readonly capacity = 512,
  ) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(roomId))
      throw new Error("invalid spectator room identifier");
    if (!Number.isSafeInteger(delayMs) || delayMs < 10_000 || delayMs > 300_000)
      throw new RangeError("spectator delay must be between 10 seconds and 5 minutes");
    if (!Number.isSafeInteger(capacity) || capacity < 1 || capacity > 4096)
      throw new RangeError("invalid spectator buffer size");
  }

  /**
   * Called only from the trusted room's monotonically advancing clock.
   * Queue arrival timestamps are assigned by the server, never by players.
   */
  push(input: unknown, now: number): boolean {
    if (!Number.isSafeInteger(now) || now < 0) return false;
    let parsed: MatchSnapshotV1;
    try {
      parsed = parseMatchSnapshotV1(input, this.lastAccepted ?? undefined);
    } catch {
      return false;
    }
    if (parsed.roomId !== this.roomId) return false;
    if (this.lastAccepted) {
      if (parsed.revision <= this.lastAccepted.revision) return false;
      if (this.lastAccepted.phase === "finalized") return false;
    }
    if (now < this.lastAcceptedAt) return false;
    if (now > Number.MAX_SAFE_INTEGER - this.delayMs) return false;

    this.lastAccepted = structuredClone(parsed);
    this.lastAcceptedAt = now;
    this.pending.push({ releaseAt: now + this.delayMs, snapshot: structuredClone(parsed) });
    // Bounded memory: skip old presentation-only frames rather than weaken
    // the minimum delay or backpressure the authoritative simulation.
    if (this.pending.length > this.capacity) this.pending.shift();
    return true;
  }

  /**
   * Returns at most one latest eligible snapshot to avoid unbounded catch-up
   * bursts. Never returns a frame before the configured anti-sniping delay.
   */
  poll(now: number): MatchSnapshotV1 | null {
    if (!Number.isSafeInteger(now) || now < 0) return null;
    let released: MatchSnapshotV1 | null = null;
    while (this.pending.length > 0 && this.pending[0]!.releaseAt <= now)
      released = this.pending.shift()!.snapshot;
    if (released) this.lastReleased = released;
    return released ? structuredClone(released) : null;
  }

  /** The last public, already delayed frame, not the live score. */
  replayLastReleased(): MatchSnapshotV1 | null {
    return this.lastReleased ? structuredClone(this.lastReleased) : null;
  }

  /** Persist server-side delay deadlines so a Durable Object eviction never
   * releases a future snapshot early or resets the anti-sniping window. */
  checkpoint(): DelayedSpectatorCheckpointV1 {
    return structuredClone({
      version: 1,
      roomId: this.roomId,
      delayMs: this.delayMs,
      capacity: this.capacity,
      pending: this.pending,
      lastAccepted: this.lastAccepted,
      lastAcceptedAt: this.lastAcceptedAt,
      lastReleased: this.lastReleased,
    });
  }

  /** Revalidate a private checkpoint against the trusted room settings.
   * Invalid, cross-room or prematurely scheduled frames fail closed. */
  static restoreCheckpoint(
    roomId: string,
    input: unknown,
    delayMs = 30_000,
    capacity = 512,
  ): DelayedSpectatorFeed {
    const feed = new DelayedSpectatorFeed(roomId, delayMs, capacity);
    const saved = SpectatorCheckpointSchema.parse(input);
    if (saved.roomId !== roomId || saved.delayMs !== delayMs || saved.capacity !== capacity)
      throw new Error("spectator checkpoint settings mismatch");
    if (saved.pending.length > capacity)
      throw new Error("spectator checkpoint exceeds configured capacity");

    const released =
      saved.lastReleased === null ? null : parseMatchSnapshotV1(saved.lastReleased);
    if (released && released.roomId !== roomId)
      throw new Error("spectator released frame belongs to another room");
    if (released?.phase === "finalized" && saved.pending.length)
      throw new Error("finalized spectator stream cannot queue new frames");

    let previous: MatchSnapshotV1 | null = released;
    let previousDeadline = -1;
    const pending: DelayedSpectatorCheckpointV1["pending"] = [];
    for (const item of saved.pending) {
      const snapshot = parseMatchSnapshotV1(item.snapshot, previous ?? undefined);
      if (
        snapshot.roomId !== roomId ||
        (previous && snapshot.revision <= previous.revision) ||
        item.releaseAt < delayMs ||
        item.releaseAt < previousDeadline
      )
        throw new Error("invalid spectator pending frame");
      pending.push({ releaseAt: item.releaseAt, snapshot });
      previous = snapshot;
      previousDeadline = item.releaseAt;
    }

    const accepted =
      saved.lastAccepted === null ? null : parseMatchSnapshotV1(saved.lastAccepted);
    if (accepted === null) {
      if (pending.length || released || saved.lastAcceptedAt !== -1)
        throw new Error("incomplete spectator checkpoint");
    } else {
      if (accepted.roomId !== roomId || saved.lastAcceptedAt < 0)
        throw new Error("invalid spectator accepted frame");
      if (released && accepted.revision < released.revision)
        throw new Error("spectator checkpoint revision regression");
      const newest = pending.at(-1);
      if (newest) {
        if (
          newest.releaseAt !== saved.lastAcceptedAt + delayMs ||
          JSON.stringify(newest.snapshot) !== JSON.stringify(accepted)
        )
          throw new Error("spectator checkpoint does not match latest accepted frame");
      } else if (!released || JSON.stringify(released) !== JSON.stringify(accepted)) {
        throw new Error("spectator checkpoint missing delayed frame");
      }
    }
    feed.pending.push(...structuredClone(pending));
    feed.lastAccepted = accepted ? structuredClone(accepted) : null;
    feed.lastAcceptedAt = saved.lastAcceptedAt;
    feed.lastReleased = released ? structuredClone(released) : null;
    return feed;
  }

  size(): number {
    return this.pending.length;
  }

  clear(): void {
    this.pending.length = 0;
    this.lastAccepted = null;
    this.lastAcceptedAt = -1;
    this.lastReleased = null;
  }
}
