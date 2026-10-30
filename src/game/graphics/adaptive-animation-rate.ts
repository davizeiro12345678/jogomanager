import type { LodLevel } from "@/game/player-model";

/**
 * Distant full-body poses cost more than the positional interpolation that
 * keeps live players on the pitch. Their joint pose can be evaluated less
 * frequently while the authoritative match simulation remains at full rate.
 * LOD zero never skips an animation frame.
 */
export function animationPoseInterval(
  lod: LodLevel,
  quality: "alta" | "media" | "baixa",
  framePressure = 0,
): number {
  if (lod === 0) return 0;
  const overloaded = framePressure >= 2;
  if (lod === 1) return 1 / (overloaded ? 20 : quality === "baixa" ? 24 : quality === "media" ? 30 : 36);
  return 1 / (overloaded ? 10 : quality === "baixa" ? 12 : 16);
}
