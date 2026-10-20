const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

/** A new relative CPU gate, independent of the existing absolute Lighthouse budgets.
 * Two ABBA passes provide 62 samples per revision. A 10% material-regression
 * margin plus a 99% bootstrap lower bound avoids failing on shared-runner noise.
 * This measures constructor CPU, not CodSpeed efficiency, wall latency or FPS.
 */
export function assessMatchSetup(before, after) {
  for (const [name, values] of [
    ["baseline", before],
    ["candidate", after],
  ]) {
    if (values.length < 62 || values.some((value) => !Number.isFinite(value) || value <= 0))
      throw new Error(`${name}: at least 62 finite, positive CPU samples are required`);
  }
  let state = 0x51a7e;
  const random = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x1_0000_0000;
  };
  const sampleMedian = (values) =>
    median(values.map(() => values[Math.floor(random() * values.length)]));
  const ratios = Array.from(
    { length: 4096 },
    () => sampleMedian(after) / sampleMedian(before),
  ).sort((a, b) => a - b);
  const baselineCpuMs = median(before);
  const candidateCpuMs = median(after);
  const lowerRatio = ratios[Math.floor(ratios.length * 0.005)];
  const upperRatio = ratios[Math.ceil(ratios.length * 0.995) - 1];
  return {
    baselineCpuMs,
    candidateCpuMs,
    durationChangePercent: (candidateCpuMs / baselineCpuMs - 1) * 100,
    materialRegressionPercent: 10,
    confidence: 0.99,
    lowerRatio,
    upperRatio,
    failed: lowerRatio > 1.1,
  };
}
