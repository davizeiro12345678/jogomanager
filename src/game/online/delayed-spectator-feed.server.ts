import {
  parseMatchSnapshotV1,
  type MatchSnapshotV1,
} from "./match-protocol";

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
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(roomId)
    )
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
