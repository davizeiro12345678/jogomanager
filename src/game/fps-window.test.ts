import { describe, expect, it } from "vitest";

import { FpsWindow } from "./fps-window";

describe("FpsWindow", () => {
  it.each([30, 60, 144])("retains a real 30-second window at %i Hz", (hz) => {
    const metrics = new FpsWindow();
    for (let index = 0; index < hz * 65; index += 1) metrics.add(1000 / hz);
    expect(metrics.summary().frames).toBe(hz * 30);
    expect(metrics.summary().windowMs).toBeCloseTo(30_000, 6);
    expect(metrics.summary().fps).toBeCloseTo(hz, 8);
    expect(metrics.summary().low1).toBeCloseTo(hz, 8);
  });

  it("uses total elapsed frame time instead of averaging per-second rates", () => {
    const metrics = new FpsWindow();
    for (let index = 0; index < 100; index += 1) metrics.add(10);
    metrics.add(2000);
    expect(metrics.summary()).toMatchObject({
      frames: 101,
      windowMs: 3000,
      now: 0.5,
      worst: 0.5,
      framesOver250Ms: 1,
      maxFrameMs: 2000,
    });
    expect(metrics.summary().fps).toBeCloseTo(101 / 3, 10);
    expect(metrics.summary().fps).not.toBeCloseTo((100 + 0.5) / 2);
  });

  it("keeps visible stalls and computes distinct 1% and 0.1% tails", () => {
    const metrics = new FpsWindow();
    for (let index = 0; index < 1998; index += 1) metrics.add(10);
    metrics.add(100);
    metrics.add(400);
    const sample = metrics.summary();
    expect(sample.p50FrameMs).toBe(10);
    expect(sample.p95FrameMs).toBe(10);
    expect(sample.p99FrameMs).toBe(10);
    expect(sample.low1).toBeCloseTo(1000 / 34, 10);
    expect(sample.low01).toBe(4);
    expect(sample.framesOver33Ms).toBe(2);
    expect(sample.framesOver50Ms).toBe(2);
    expect(sample.framesOver100Ms).toBe(1);
    expect(sample.framesOver250Ms).toBe(1);
  });

  it("does not shorten a frame straddling the window boundary", () => {
    const metrics = new FpsWindow();
    metrics.add(35_000);
    metrics.add(10);
    expect(metrics.summary()).toMatchObject({ frames: 2, windowMs: 35_010, maxFrameMs: 35_000 });
    for (let index = 0; index < 2999; index += 1) metrics.add(10);
    expect(metrics.summary()).toMatchObject({ frames: 3000, windowMs: 30_000, maxFrameMs: 10 });
  });

  it("expires slow frames by elapsed time when refresh rates change", () => {
    const metrics = new FpsWindow();
    for (let index = 0; index < 30 * 30; index += 1) metrics.add(1000 / 30);
    for (let index = 0; index < 144 * 30; index += 1) metrics.add(1000 / 144);
    expect(metrics.summary().frames).toBe(4320);
    expect(metrics.summary().fps).toBeCloseTo(144, 8);
    expect(metrics.summary().maxFrameMs).toBe(1000 / 144);
  });

  it("bounds memory, ignores invalid input and resets wrapped storage", () => {
    const metrics = new FpsWindow(30_000, 3);
    [10, 20, 30, 40, 50].forEach((ms) => metrics.add(ms));
    [0, -1, Number.NaN, Number.POSITIVE_INFINITY].forEach((ms) => metrics.add(ms));
    expect(metrics.summary()).toMatchObject({ frames: 3, windowMs: 120, maxFrameMs: 50 });
    expect(metrics.summary().fps).toBe(25);
    metrics.reset();
    expect(metrics.summary()).toMatchObject({ frames: 0, fps: 0, low01: 0, p99FrameMs: 0 });
    metrics.add(10);
    expect(metrics.summary()).toMatchObject({ frames: 1, windowMs: 10, fps: 100 });
    expect(metrics.summary()).toEqual(metrics.summary());
  });

  it("expires per-second history with the same active frame window", () => {
    const metrics = new FpsWindow();
    metrics.add(1000);
    for (let index = 0; index < 100 * 31; index += 1) metrics.add(10);
    expect(metrics.summary()).toMatchObject({ now: 100, worst: 100, framesOver250Ms: 0 });
  });
});
