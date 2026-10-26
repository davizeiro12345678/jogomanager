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

type SchedulingDocument = {
  visibilityState?: unknown;
  hasFocus?: unknown;
};

/**
 * Visibility alone cannot prove that an OS scheduled an animation normally.
 * Record the browser's focus signal beside every native sample, but never use
 * it to hide slow intervals from the distribution.
 */
export function nativePageSchedulingState(documentLike: SchedulingDocument) {
  const visibility =
    documentLike.visibilityState === "visible" || documentLike.visibilityState === "hidden"
      ? documentLike.visibilityState
      : "unknown";
  let hasFocus: boolean | null = null;
  if (typeof documentLike.hasFocus === "function") {
    try {
      const value = documentLike.hasFocus();
      hasFocus = typeof value === "boolean" ? value : null;
    } catch {
      // Privacy wrappers and embedded browser hosts can reject this optional read.
    }
  }
  return { visibility, hasFocus };
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
  if (!sample.gpuRenderer || /swiftshader|llvmpipe|software|basic render/i.test(sample.gpuRenderer))
    reasons.push("native-gpu-unverified");
  if (!Number.isFinite(sample.fps) || sample.fps < 69) reasons.push("mean-fps-below-69");
  if (!Number.isFinite(sample.p95) || sample.p95 <= 0 || sample.p95 > 20)
    reasons.push("p95-above-20ms");
  if (!Number.isFinite(sample.onePercentLow) || sample.onePercentLow < 50)
    reasons.push("one-percent-low-below-50");
  return {
    passes: reasons.length === 0,
    reasons,
    scope: "single run; three equivalent runs and both GPUs required for campaign acceptance",
  };
}
