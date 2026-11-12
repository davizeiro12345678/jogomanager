/**
 * Client-side acknowledgement latency telemetry. All values are aggregate
 * timings; no player IDs, ticket material, IPs, seeds or chat are retained.
 * Measurements are local until an explicitly approved metrics export.
 */
export class AuthorityLatencyMetrics {
  private readonly sentAt = new Map<number, number>();
  private readonly samples: number[] = [];
  private acknowledged = 0;
  private rejected = 0;
  private expired = 0;

  constructor(
    private readonly maxSamples = 256,
    private readonly maxPending = 128,
    private readonly timeoutMs = 30_000,
  ) {
    if (
      !Number.isSafeInteger(maxSamples) ||
      maxSamples < 1 ||
      maxSamples > 4096 ||
      !Number.isSafeInteger(maxPending) ||
      maxPending < 1 ||
      maxPending > 1024 ||
      !Number.isSafeInteger(timeoutMs) ||
      timeoutMs < 1000 ||
      timeoutMs > 300_000
    )
      throw new RangeError("invalid latency measurement bounds");
  }

  recordSent(sequence: number, now: number): boolean {
    if (!Number.isSafeInteger(sequence) || sequence < 1 || !Number.isFinite(now) || now < 0)
      return false;
    this.expire(now);
    if (this.sentAt.has(sequence)) return false;
    if (this.sentAt.size >= this.maxPending) {
      const oldest = this.sentAt.keys().next().value;
      if (oldest !== undefined) this.sentAt.delete(oldest);
      this.expired += 1;
    }
    this.sentAt.set(sequence, now);
    return true;
  }

  recordAcknowledged(sequence: number, now: number, rejected = false): boolean {
    const sent = this.sentAt.get(sequence);
    if (sent === undefined || !Number.isFinite(now) || now < sent) return false;
    this.sentAt.delete(sequence);
    if (now - sent > this.timeoutMs) {
      this.expired += 1;
      return false;
    }
    this.samples.push(now - sent);
    if (this.samples.length > this.maxSamples) this.samples.shift();
    if (rejected) this.rejected += 1;
    else this.acknowledged += 1;
    return true;
  }

  expire(now: number): void {
    if (!Number.isFinite(now) || now < 0) return;
    for (const [sequence, sent] of this.sentAt) {
      if (now >= sent && now - sent > this.timeoutMs) {
        this.sentAt.delete(sequence);
        this.expired += 1;
      }
    }
  }

  summary(): {
    samples: number;
    accepted: number;
    rejected: number;
    expired: number;
    pending: number;
    p50Ms: number | null;
    p95Ms: number | null;
    p99Ms: number | null;
    maxMs: number | null;
  } {
    const sorted = [...this.samples].sort((a, b) => a - b);
    const percentile = (p: number) =>
      sorted.length > 0 ? sorted[Math.ceil(sorted.length * p) - 1]! : null;
    return {
      samples: sorted.length,
      accepted: this.acknowledged,
      rejected: this.rejected,
      expired: this.expired,
      pending: this.sentAt.size,
      p50Ms: percentile(0.5),
      p95Ms: percentile(0.95),
      p99Ms: percentile(0.99),
      maxMs: sorted.at(-1) ?? null,
    };
  }
}
