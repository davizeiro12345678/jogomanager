/** Native GPU measurement protocol; CPU performance belongs to CodSpeed. */
export function nativeMeasurementTiming(search: string) {
  const params = new URLSearchParams(search);
  const bounded = (key: string, fallback: number, min: number, max: number) => {
    const raw = params.get(key);
    const value = raw === null ? fallback : Number(raw);
    return Number.isFinite(value) && value >= min && value <= max ? value : fallback;
  };
  return {
    warmupMs: bounded("warmup", 5, 5, 120) * 1000,
    measurementMs: bounded("duration", 60, 30, 300) * 1000,
  };
}

/** Include a visible stall crossing the final boundary; wall time alone is not coverage. */
export function nativeFrameInterval(
  previous: number,
  current: number,
  warmupMs: number,
  measurementMs: number,
) {
  if (![previous, current, warmupMs, measurementMs].every(Number.isFinite) || current <= previous)
    return 0;
  return Math.max(0, Math.min(current, warmupMs + measurementMs) - Math.max(previous, warmupMs));
}

export function assessNativePerformance(sample: {
  fps: number;
  p95: number;
  onePercentLow: number;
  width: number;
  height: number;
  dpr: number;
  quality: string | undefined;
  gpuRenderer: string | null;
  warmupMs: number;
  measurementMs: number;
  complete: boolean;
  interruptions: number;
  coveredMs: number;
  contractChanged: boolean;
  adaptive: boolean | undefined;
}) {
  const reasons: string[] = [];
  if (!sample.complete) reasons.push("measurement-incomplete");
  if (sample.interruptions) reasons.push("visibility-interrupted");
  if (!Number.isFinite(sample.coveredMs) || sample.coveredMs < sample.measurementMs - 1)
    reasons.push("measurement-coverage-incomplete");
  if (sample.contractChanged || sample.adaptive !== false) reasons.push("quality-contract-changed");
  if (sample.warmupMs < 60000 || sample.measurementMs < 300000) reasons.push("short-protocol");
  if (
    sample.width !== 1280 ||
    sample.height !== 720 ||
    sample.dpr !== 1 ||
    sample.quality !== "alta"
  )
    reasons.push("quality-contract-mismatch");
  if (
    !sample.gpuRenderer ||
    /swiftshader|llvmpipe|softpipe|lavapipe|software|basic render/i.test(sample.gpuRenderer)
  )
    reasons.push("native-gpu-unverified");
  if (!Number.isFinite(sample.fps) || sample.fps < 45) reasons.push("mean-fps-below-45");
  if (!Number.isFinite(sample.p95) || sample.p95 <= 0 || sample.p95 > 28)
    reasons.push("p95-above-28ms");
  const stretchReasons = [...reasons];
  if (sample.warmupMs < 60000 || sample.measurementMs < 300000)
    stretchReasons.push("extended-protocol-incomplete");
  if (!Number.isFinite(sample.fps) || sample.fps < 69) stretchReasons.push("mean-fps-below-69");
  if (!Number.isFinite(sample.p95) || sample.p95 <= 0 || sample.p95 > 20)
    stretchReasons.push("p95-above-20ms");
  if (!Number.isFinite(sample.onePercentLow) || sample.onePercentLow < 50)
    stretchReasons.push("one-percent-low-below-50");
  return {
    target: { quality: "alta", width: 1280, height: 720, dpr: 1, fps: 45, p95Ms: 28 },
    passes: reasons.length === 0,
    reasons,
    stretch: { targetFps: 69, passes: stretchReasons.length === 0, reasons: stretchReasons },
    scope: "single run; three equivalent runs and both GPUs required for campaign acceptance",
  };
}
