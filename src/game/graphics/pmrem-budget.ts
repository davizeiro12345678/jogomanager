/**
 * Static stadium IBL is captured once per environment revision.
 * Keep cube allocations on power-of-two sizes and avoid heavyweight 384px
 * captures which the pinned Three r186 PMREM fragment path must prefilter.
 * This reduces work without claiming the unpublished compute-PMREM speedup.
 */
export function stadiumEnvironmentResolution(
  quality: "alta" | "media" | "baixa",
  textureScale: number,
): 64 | 128 | 256 {
  const scale = Number.isFinite(textureScale) ? Math.max(0.25, Math.min(1.5, textureScale)) : 1;
  const logical = (quality === "alta" ? 256 : quality === "media" ? 128 : 64) * scale;
  if (logical < 96) return 64;
  if (logical < 192) return 128;
  return 256;
}
