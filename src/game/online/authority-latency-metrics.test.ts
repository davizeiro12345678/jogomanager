import { describe, expect, it } from "vitest";
import { AuthorityLatencyMetrics } from "./authority-latency-metrics";

describe("privacy-preserving match command latency", () => {
  it("measures exact p50/p95/p99 on acknowledged and rejected commands", () => {
    const metrics = new AuthorityLatencyMetrics();
    for (const [sequence, delay] of [
      [1, 50],
      [2, 100],
      [3, 150],
    ] as const) {
      expect(metrics.recordSent(sequence, 10_000)).toBe(true);
      expect(metrics.recordAcknowledged(sequence, 10_000 + delay, sequence === 3)).toBe(true);
    }
    expect(metrics.summary()).toEqual({
      samples: 3,
      accepted: 2,
      rejected: 1,
      expired: 0,
      pending: 0,
      p50Ms: 100,
      p95Ms: 150,
      p99Ms: 150,
      maxMs: 150,
    });
  });

  it("deduplicates a command and never counts a replayed ACK twice", () => {
    const metrics = new AuthorityLatencyMetrics();
    expect(metrics.recordSent(1, 1_000)).toBe(true);
    expect(metrics.recordSent(1, 1_001)).toBe(false);
    expect(metrics.recordAcknowledged(1, 1_070)).toBe(true);
    expect(metrics.recordAcknowledged(1, 1_071)).toBe(false);
    expect(metrics.summary().samples).toBe(1);
  });

  it("keeps bounded memory during disconnected or hostile connections", () => {
    const metrics = new AuthorityLatencyMetrics(2, 2, 1_000);
    metrics.recordSent(1, 0);
    metrics.recordSent(2, 100);
    metrics.recordSent(3, 200);
    expect(metrics.summary().expired).toBe(1);
    expect(metrics.summary().pending).toBe(2);
    metrics.expire(2_001);
    expect(metrics.summary().expired).toBe(3);
    expect(metrics.summary().pending).toBe(0);
    expect(metrics.recordAcknowledged(1, 2_002)).toBe(false);
  });

  it("rejects reversed or malformed timestamps without inventing speed", () => {
    const metrics = new AuthorityLatencyMetrics();
    expect(metrics.recordSent(0, 200)).toBe(false);
    expect(metrics.recordSent(1, Number.NaN)).toBe(false);
    expect(metrics.recordSent(1, 200)).toBe(true);
    expect(metrics.recordAcknowledged(1, 199)).toBe(false);
    expect(metrics.recordAcknowledged(1, 250)).toBe(true);
    expect(metrics.summary().p50Ms).toBe(50);
  });
});
