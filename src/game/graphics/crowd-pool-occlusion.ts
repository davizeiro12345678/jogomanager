import * as THREE from "three";

/**
 * Nearest visible seat depth for the entire LOD draw pool. A single indirect
 * command can be discarded only when the WHOLE pool is behind the
 * conservative max-depth image. This is intentionally much more cautious
 * than individual occlusion tests; it never falsely removes half a tier.
 */
export function nearestCrowdPoolDepth(
  seats: Int32Array,
  visibleCount: number,
  matrices: Float32Array,
  viewProjection: THREE.Matrix4,
): number {
  if (visibleCount < 1) return 0;
  const p = viewProjection.elements;
  let closest = 1;
  for (let i = 0; i < visibleCount; i++) {
    const seat = seats[i]!;
    if (seat < 0 || (seat + 1) * 16 > matrices.length) return 0;
    const n = seat * 16;
    const x = matrices[n + 12]!;
    const y = matrices[n + 13]!;
    const z = matrices[n + 14]!;
    const w = p[3]! * x + p[7]! * y + p[11]! * z + p[15]!;
    if (!Number.isFinite(w) || w <= 0) return 0;
    const d = (p[2]! * x + p[6]! * y + p[10]! * z + p[14]!) / w;
    if (!Number.isFinite(d) || d < 0 || d > 1) return 0;
    closest = Math.min(closest, d);
  }
  // 5% of the device depth range is a deliberately conservative margin for
  // full spectator bodies, camera jitter and the previous-frame history.
  return Math.max(0, closest - 0.05);
}
