import { describe, expect, it } from "vitest";

import { FrameMetrics } from "./frame-metrics";

describe("FrameMetrics", () => {
  it("keeps exact percentiles after repeated reports, rollover, shrink and reset", () => {
    const metrics = new FrameMetrics(113);
    const reference: number[] = [];
    for (let index = 0; index < 500; index += 1) {
      const value = 1 + ((index * 73) % 359) / 3;
      reference.push(value);
      if (reference.length > 113) reference.shift();
      metrics.add(value);
      if (index % 17) continue;
      const sorted = reference.slice().sort((a, b) => a - b);
      const summary = metrics.summary();
      expect(summary.meanMs).toBeCloseTo(
        reference.reduce((sum, ms) => sum + ms, 0) / reference.length,
        10,
      );
      expect(summary.p95).toBe(sorted[Math.ceil(sorted.length * 0.95) - 1]);
      expect(metrics.summary()).toEqual(summary);
    }
    metrics.reset();
    expect(metrics.summary().p95).toBe(0);
    metrics.add(12);
    expect(metrics.summary()).toMatchObject({ frames: 1, p95: 12, maxMs: 12 });
  });
  it("computes 1% low from the slowest tail rather than reciprocal p99", () => {
    const metrics = new FrameMetrics();
    for (let i = 0; i < 198; i++) metrics.add(10);
    metrics.add(100);
    metrics.add(300);
    expect(metrics.summary().onePercentLow).toBe(5);
    expect(metrics.summary().pointOnePercentLow).toBeCloseTo(1000 / 300, 10);
    expect(metrics.summary().p99).toBe(10);
  });
  it("retains only the newest bounded samples without changing its summary", () => {
    const metrics = new FrameMetrics(3);
    [10, 20, 30, 40].forEach((sample) => metrics.add(sample));

    expect(metrics.summary()).toMatchObject({
      frames: 3,
      meanMs: 30,
      p50: 30,
      p95: 40,
      p99: 40,
      maxMs: 40,
      stalls: 0,
    });
  });

  it("rejects unusable samples and resets all retained data", () => {
    const metrics = new FrameMetrics(2);
    metrics.add(Number.NaN);
    metrics.add(0);
    metrics.add(-4);
    metrics.add(55);
    expect(metrics.summary().stalls).toBe(1);
    metrics.reset();
    expect(metrics.summary().frames).toBe(0);
    expect(metrics.summary().pointOnePercentLow).toBe(0);
  });

  it("exports all requested stall thresholds with the legacy >50ms alias", () => {
    const metrics = new FrameMetrics();
    [10, 1000 / 30, 40, 50, 51, 100, 101, 250, 251, 500].forEach((ms) => metrics.add(ms));
    expect(metrics.summary()).toMatchObject({
      framesOver33Ms: 8,
      framesOver50Ms: 6,
      framesOver100Ms: 4,
      framesOver250Ms: 2,
      stalls: 6,
    });
  });

  it("declares overwritten samples and exports chronological retained evidence", () => {
    const metrics = new FrameMetrics(3);
    [10, 20, 300, 400].forEach((ms) => metrics.add(ms));
    metrics.add(Number.NaN);
    expect(metrics.summary().coverage).toEqual({
      capacity: 3,
      observedFrames: 4,
      retainedFrames: 3,
      droppedFrames: 1,
      invalidSamples: 1,
      observedMs: 730,
      retainedMs: 720,
      completeDistribution: false,
    });
    const raw = metrics.rawFrameMs();
    expect(raw).toEqual([20, 300, 400]);
    raw[0] = 999;
    expect(metrics.rawFrameMs()).toEqual([20, 300, 400]);
    metrics.reset();
    expect(metrics.rawFrameMs()).toEqual([]);
    expect(metrics.summary().coverage).toMatchObject({
      observedFrames: 0,
      droppedFrames: 0,
      invalidSamples: 0,
      observedMs: 0,
      retainedMs: 0,
    });
  });
});
