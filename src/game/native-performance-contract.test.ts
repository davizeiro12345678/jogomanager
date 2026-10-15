import { describe, expect, it } from "vitest";
import {
  assessNativePerformance,
  nativeMeasurementTiming,
  nativeFrameInterval,
} from "./native-performance-contract";

describe("native fixed-quality acceptance", () => {
  const valid = {
    fps: 70,
    p95: 19,
    onePercentLow: 51,
    width: 1280,
    height: 720,
    dpr: 1,
    quality: "alta",
    gpuRenderer: "ANGLE NVIDIA RTX 4060",
    warmupMs: 60000,
    measurementMs: 300000,
    complete: true,
    interruptions: 0,
    coveredMs: 300000,
    contractChanged: false,
    adaptive: false,
  };
  it("accepts only a complete fixed-quality physical GPU run", () => {
    expect(assessNativePerformance(valid).passes).toBe(true);
    for (const change of [
      { width: 640 },
      { coveredMs: 10000 },
      { contractChanged: true },
      { adaptive: true },
      { quality: "baixa" },
      { gpuRenderer: "SwiftShader" },
      { gpuRenderer: null },
      { interruptions: 1 },
      { complete: false },
      { warmupMs: 0 },
      { fps: NaN },
      { fps: 44 },
      { p95: 29 },
    ]) {
      expect(assessNativePerformance({ ...valid, ...change }).passes).toBe(false);
    }
  });
  it("separates the approved 45 FPS gate from the optional 69 FPS campaign", () => {
    const normal = assessNativePerformance({ ...valid, fps: 45, p95: 28, onePercentLow: 32 });
    expect(normal.passes).toBe(true);
    expect(normal.stretch.passes).toBe(false);
    expect(assessNativePerformance(valid).stretch.passes).toBe(true);
    expect(assessNativePerformance({ ...valid, gpuRenderer: "ANGLE Intel Iris Xe" }).passes).toBe(
      true,
    );
    expect(
      assessNativePerformance({ ...valid, warmupMs: 5000, measurementMs: 60000, coveredMs: 60000 })
        .passes,
    ).toBe(false);
  });
  it("bounds query timing and preserves the historical quick diagnostic", () => {
    expect(nativeMeasurementTiming("")).toEqual({ warmupMs: 5000, measurementMs: 60000 });
    expect(nativeMeasurementTiming("?warmup=60&duration=300")).toEqual({
      warmupMs: 60000,
      measurementMs: 300000,
    });
    expect(nativeMeasurementTiming("?warmup=Infinity&duration=900000")).toEqual(
      nativeMeasurementTiming(""),
    );
  });
  it("retains a visible stall through the end boundary instead of dropping it", () => {
    expect(nativeFrameInterval(59000, 61000, 60000, 300000)).toBe(1000);
    expect(nativeFrameInterval(70000, 500000, 60000, 300000)).toBe(290000);
    expect(nativeFrameInterval(361000, 500000, 60000, 300000)).toBe(0);
    expect(nativeFrameInterval(61000, 59000, 60000, 300000)).toBe(0);
  });
});
