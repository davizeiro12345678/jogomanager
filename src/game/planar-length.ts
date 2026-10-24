/** Scaled pitch-plane length, without the variadic conversion/dispatch path.
 * Normalize before squaring so extreme finite values do not overflow/underflow.
 * Keep division, summation and multiplication order; exceptional values retain
 * the native hypot behavior (including Infinity combined with NaN). */
export function planarLength(x: number, z: number): number {
  const ax = Math.abs(x);
  const az = Math.abs(z);
  const scale = Math.max(ax, az);
  if (scale === 0 || !Number.isFinite(scale)) return Math.hypot(x, z);
  const nx = ax / scale;
  const nz = az / scale;
  return Math.sqrt(nx * nx + nz * nz) * scale;
}
