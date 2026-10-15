/**
 * The standalone graphics benchmark must not bundle web-authenticated server
 * functions or send optional player telemetry. It already collects verified
 * local graphics samples through the benchmark harness.
 */
export function reportTechSample(_sample: { fps: number; p95: number; errorCode?: string }) {
  void _sample;
}
