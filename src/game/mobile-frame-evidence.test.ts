import { describe, expect, it } from "vitest";
import { MobileFrameMetrics as FrameMetrics } from "../../scripts/mobile-frame-metrics";

describe("mobile frame evidence", () => {
  it("counts observed endpoints in complete rolling windows, including a long stall", () => {
    for (const series of [
      Array(10).fill(1000),
      [6000, 20, 20, 500, 1000, 6000],
      Array(360).fill(1000 / 60),
    ]) {
      const metrics = new FrameMetrics();
      series.forEach((ms) => metrics.add(ms));
      let time = 0;
      const endpoints = series.map((ms) => (time += ms));
      const windows = endpoints
        .filter((end) => end >= 5000)
        .map((end) => endpoints.filter((t) => t > end - 5000 && t <= end).length / 5);
      expect(metrics.summary().minFiveSecondFps).toBe(Math.min(...windows));
    }
  });
  it("detects a sustained five-second slowdown hidden by a fast overall mean", () => {
    const metrics = new FrameMetrics();
    for (let i = 0; i < 600; i++) metrics.add(10);
    for (let i = 0; i < 250; i++) metrics.add(20);
    metrics.add(40);
    const summary = metrics.summary();
    expect(summary.fps).toBeGreaterThan(60);
    expect(summary.minFiveSecondFps).toBeLessThan(58);
    expect(summary.over33Ms).toBe(1);
    expect(summary.over33Percent).toBeCloseTo(100 / 851);
    metrics.reset();
    expect(metrics.summary().minFiveSecondFps).toBeNull();
    for (let i = 0; i < 360; i++) metrics.add(1000 / 60);
    expect(metrics.summary().minFiveSecondFps).toBeGreaterThanOrEqual(59.8);
  });
});
