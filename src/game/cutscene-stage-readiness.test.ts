import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  armCutsceneStageReadinessFallback,
  AUTO_CUTSCENE_3D_READINESS_TIMEOUT_MS,
  type CutsceneStageReadiness,
} from "./cutscene-stage-readiness";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function readiness(overrides: Partial<CutsceneStageReadiness> = {}): CutsceneStageReadiness {
  return {
    autoPlay: true,
    mode: "3d",
    stageReady: false,
    paused: false,
    hidden: false,
    loadFailed: false,
    onFallback: vi.fn(),
    ...overrides,
  };
}

describe("autoplay prematch cutscene stage readiness", () => {
  it("falls back after the bounded WebGL readiness deadline, exactly once", () => {
    const s = readiness();
    const control = armCutsceneStageReadinessFallback(s);
    expect(control).not.toBeNull();

    vi.advanceTimersByTime(AUTO_CUTSCENE_3D_READINESS_TIMEOUT_MS - 1);
    expect(s.onFallback).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(s.onFallback).toHaveBeenCalledExactlyOnceWith("timeout");
    vi.advanceTimersByTime(60_000);
    expect(s.onFallback).toHaveBeenCalledTimes(1);
    control?.cancel();
  });

  it("cancels cleanly when the 3D scene becomes ready or unmounts", () => {
    const s = readiness();
    const control = armCutsceneStageReadinessFallback(s);
    control?.cancel();
    vi.advanceTimersByTime(AUTO_CUTSCENE_3D_READINESS_TIMEOUT_MS + 1);
    expect(s.onFallback).not.toHaveBeenCalled();

    const ready = readiness({ stageReady: true });
    expect(armCutsceneStageReadinessFallback(ready)).toBeNull();
    vi.advanceTimersByTime(60_000);
    expect(ready.onFallback).not.toHaveBeenCalled();
  });

  it("switches immediately on a reported 3D load failure", () => {
    const s = readiness({ loadFailed: true });
    expect(armCutsceneStageReadinessFallback(s)).toBeNull();
    expect(s.onFallback).toHaveBeenCalledExactlyOnceWith("load-error");
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([
    { autoPlay: false },
    { mode: "2d" as const },
    { stageReady: true },
    { paused: true },
    { hidden: true },
  ])("never overrides an inactive or user-controlled cinematic: %j", (override) => {
    const s = readiness(override);
    expect(armCutsceneStageReadinessFallback(s)).toBeNull();
    vi.advanceTimersByTime(60_000);
    expect(s.onFallback).not.toHaveBeenCalled();
  });
});
