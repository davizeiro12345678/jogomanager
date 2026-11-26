import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FpsMeter, fpsReport } from "./fps-meter";

describe("FpsMeter", () => {
  let clock: number;
  let hidden: boolean;
  let nextId: number;
  let documentStub: EventTarget;
  let callbacks: Map<number, FrameRequestCallback>;
  let meter: FpsMeter;

  beforeEach(() => {
    clock = 0;
    hidden = false;
    nextId = 0;
    callbacks = new Map();
    documentStub = new EventTarget();
    Object.defineProperty(documentStub, "hidden", { get: () => hidden });
    vi.stubGlobal("document", documentStub);
    vi.stubGlobal("performance", { now: () => clock });
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      const id = ++nextId;
      callbacks.set(id, callback);
      return id;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => callbacks.delete(id));
    meter = new FpsMeter();
  });

  afterEach(() => {
    meter.stop();
    vi.unstubAllGlobals();
  });

  function frame(ms = 10) {
    clock += ms;
    const pending = [...callbacks];
    callbacks.clear();
    pending.forEach(([, callback]) => callback(clock));
  }

  function frames(count: number, ms = 10) {
    for (let index = 0; index < count; index += 1) frame(ms);
  }

  function visibility(value: boolean) {
    hidden = value;
    documentStub.dispatchEvent(new Event("visibilitychange"));
  }

  it("retains an active stall over 250ms after warmup", () => {
    meter.start();
    frames(200);
    expect(meter.sample().frames).toBe(0);
    frames(100);
    frame(1000);
    expect(meter.sample()).toMatchObject({
      frames: 101,
      windowMs: 2000,
      avg: 51,
      low01: 1,
      maxFrameMs: 1000,
      framesOver250Ms: 1,
    });
    expect(fpsReport(meter.sample(), { Preset: "alta" })).toContain("FPS médio preciso: 50.500");
    expect(fpsReport(meter.sample(), {})).toContain("Quadros >250 ms: 1");
  });

  it("excludes a hidden gap even when the browser delivers no hidden RAF", () => {
    meter.start();
    frames(300);
    const baseline = meter.sample();
    visibility(true);
    clock += 60_000;
    visibility(false);
    frame();
    frames(200);
    expect(meter.sample()).toEqual(baseline);
    frames(100);
    expect(meter.sample()).toMatchObject({ frames: 200, windowMs: 2000, avg: 100, maxFrameMs: 10 });
  });

  it("does not include hidden callbacks or an unannounced visible resume interval", () => {
    meter.start();
    frames(300);
    visibility(true);
    frame(20_000);
    // The event is delivered normally, but even a pending RAF must be excluded.
    visibility(false);
    frame(20_000);
    frames(300);
    expect(meter.sample().maxFrameMs).toBe(10);
    expect(meter.sample().framesOver250Ms).toBe(0);
  });

  it("stops scheduling and excludes stopped time on restart", () => {
    const listener = vi.fn();
    const unsubscribe = meter.subscribe(listener);
    meter.start();
    meter.start();
    expect(callbacks.size).toBe(1);
    frames(300);
    expect(listener).toHaveBeenCalledTimes(1);
    meter.stop();
    meter.stop();
    expect(callbacks.size).toBe(0);
    clock += 90_000;
    meter.start();
    frames(300);
    expect(meter.sample()).toMatchObject({ frames: 200, windowMs: 2000, maxFrameMs: 10 });
    unsubscribe();
    frames(100);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("resets active statistics and warms up before a new campaign", () => {
    meter.start();
    frames(300);
    frame(500);
    meter.reset();
    expect(meter.sample()).toMatchObject({ frames: 0, avg: 0, low1: 0, low01: 0, seconds: 0 });
    frame();
    frames(200);
    expect(meter.sample().frames).toBe(0);
    frames(100);
    expect(meter.sample()).toMatchObject({ frames: 100, maxFrameMs: 10, avg: 100 });
  });

  it("keeps legacy report samples compatible", () => {
    const report = fpsReport({ now: 60, avg: 59, worst: 52, low1: 47, seconds: 10 }, {});
    expect(report).toContain("FPS médio: 59");
    expect(report).not.toContain("undefined");
    expect(report).not.toContain("NaN");
  });

  it("cannot classify an unloaded stadium using an idle browser's RAF", () => {
    meter.start("rendered", { key: "match:a", phase: "match", quality: "media" });
    expect(callbacks.size).toBe(0);
    frames(1000);
    expect(meter.sample()).toMatchObject({ frames: 0, seconds: 0, source: "rendered" });
    meter.recordRenderedFrame(clock);
    for (let index = 0; index < 400; index += 1) {
      clock += 20;
      meter.recordRenderedFrame(clock);
    }
    expect(meter.sample()).toMatchObject({ frames: 300, windowMs: 6000, avg: 50 });
    expect(fpsReport(meter.sample(), {})).toContain("Fase medida: match");
    expect(fpsReport(meter.sample(), {})).toContain("Preset medido: media");
    meter.stop();
    const stopped = meter.sample();
    clock += 20_000;
    meter.recordRenderedFrame(clock);
    expect(meter.sample()).toEqual(stopped);
  });

  it("resets renderer frames instead of relabeling old preset/camera/scenario data", () => {
    const initial = {
      key: "seed:a/alta/tactical",
      phase: "match",
      quality: "alta",
      camera: "tactical",
    };
    meter.start("rendered", initial);
    meter.recordRenderedFrame(clock, initial);
    for (let index = 0; index < 400; index += 1) {
      clock += 20;
      meter.recordRenderedFrame(clock, initial);
    }
    expect(meter.sample().frames).toBe(300);
    const changed = {
      key: "seed:b/media/broadcast",
      phase: "match",
      quality: "media",
      camera: "broadcast",
    };
    const listener = vi.fn();
    const unsubscribe = meter.subscribe(listener);
    clock += 20;
    meter.recordRenderedFrame(clock, changed);
    expect(listener).toHaveBeenCalledOnce();
    expect(listener.mock.calls[0]![0]).toMatchObject({
      frames: 0,
      quality: "media",
      camera: "broadcast",
      measurementKey: changed.key,
    });
    expect(meter.sample()).toMatchObject({ frames: 0, seconds: 0, low1: 0 });
    unsubscribe();
  });

  it("does not mix RAF statistics into a restarted renderer campaign", () => {
    meter.start();
    frames(300);
    expect(meter.sample().frames).toBe(100);
    expect(fpsReport(meter.sample(), {})).toContain("Origem: requestAnimationFrame");
    meter.stop();
    meter.start("rendered", { key: "match:b", phase: "match", quality: "alta" });
    expect(meter.sample()).toMatchObject({ frames: 0, source: "rendered", quality: "alta" });
  });
});
