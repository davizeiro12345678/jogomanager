/**
 * Stable GPU shadow budget for the three stadium graphics presets.
 * Changes only at discrete pressure levels. No GPU feature is inferred from
 * CPU frequency, user agent, or an untrusted remote metric.
 */
export type StadiumShadowQuality = "baixa" | "media" | "alta";

export function shadowMapSizeFor(
  quality: StadiumShadowQuality,
  pressure: number,
): 512 | 1024 | 2048 {
  if (!Number.isFinite(pressure) || pressure < 0) return 512;
  if (quality === "alta") {
    if (pressure < 3) return 2048;
    if (pressure < 6) return 1024;
    return 512;
  }
  if (quality === "media" && pressure < 4) return 1024;
  return 512;
}
