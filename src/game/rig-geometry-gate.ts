export interface GeometryFlowMeasurement {
  typescriptMs: number;
  rustMs: number;
  firstImageTypescriptMs: number;
  firstImageRustMs: number;
}
export function evaluateGeometryReleaseGate(measurements: readonly GeometryFlowMeasurement[]) {
  if (
    measurements.length < 3 ||
    measurements.some(
      (m) =>
        ![m.typescriptMs, m.rustMs, m.firstImageTypescriptMs, m.firstImageRustMs].every(
          (v) => Number.isFinite(v) && v > 0,
        ),
    )
  )
    return { enabled: false, medianGain: null, reason: "incomplete-full-flow-evidence" };
  const gains = measurements.map((m) => 1 - m.rustMs / m.typescriptMs).sort((a, b) => a - b);
  const mid = Math.floor(gains.length / 2);
  const gain = gains.length % 2 ? gains[mid]! : (gains[mid - 1]! + gains[mid]!) / 2;
  const firstImageRegressed = measurements.some(
    (m) => m.firstImageRustMs > m.firstImageTypescriptMs,
  );
  return {
    enabled: gain >= 0.2 && !firstImageRegressed,
    medianGain: gain,
    reason: firstImageRegressed
      ? "first-image-regressed"
      : gain < 0.2
        ? "gain-below-20-percent"
        : "accepted",
  };
}
/** Full-flow evidence must include Worker transfer and BufferGeometry construction.
 * No environment toggle can silently bypass this shipping gate. */
export const RUST_GEOMETRY_RELEASE = evaluateGeometryReleaseGate([]);
