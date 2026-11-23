import type { FpsSample } from "./fps-meter";

export type MatchGraphicsQuality = "baixa" | "media" | "alta";
export type MatchQualityTrend = { slow: number; healthy: number };

const RESET: MatchQualityTrend = { slow: 0, healthy: 0 };

/**
 * Evaluate gameplay FPS only: isolated shader warmups and a single bad 1% low
 * must not permanently demote an otherwise smooth 60-FPS mobile match.
 * Four consecutive poor seconds reduce one tier; eight healthy seconds
 * restore one tier. Cinematic/paused frames reset pressure counters.
 */
export function evaluateMatchQuality(
  current: MatchGraphicsQuality,
  sample: Pick<FpsSample, "now" | "avg">,
  trend: MatchQualityTrend,
  active: boolean,
): { quality: MatchGraphicsQuality; trend: MatchQualityTrend } {
  if (
    !active ||
    !Number.isFinite(sample.now) ||
    !Number.isFinite(sample.avg) ||
    sample.now <= 0
  ) {
    return { quality: current, trend: { ...RESET } };
  }

  const slow = sample.now < 42 && sample.avg < 50 ? trend.slow + 1 : 0;
  const healthy = sample.now >= 56 && sample.avg >= 55 ? trend.healthy + 1 : 0;
  if (slow >= 4 && current !== "baixa") {
    return { quality: current === "alta" ? "media" : "baixa", trend: { ...RESET } };
  }
  if (healthy >= 8 && current !== "alta") {
    return { quality: current === "baixa" ? "media" : "alta", trend: { ...RESET } };
  }
  return { quality: current, trend: { slow, healthy } };
}
