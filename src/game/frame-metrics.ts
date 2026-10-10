/** Bounded samples. Visible stalls stay in the distribution, including >250 ms. */
export class FrameMetrics {
  private readonly samples: Float64Array;
  private scratch = new Float64Array(0);
  private size = 0;
  private cursor = 0;
  constructor(readonly capacity = 18000) {
    if (!Number.isInteger(capacity) || capacity < 1)
      throw new RangeError("FrameMetrics capacity must be a positive integer");
    this.samples = new Float64Array(capacity);
  }
  add(ms: number) {
    if (Number.isFinite(ms) && ms > 0) {
      this.samples[this.cursor] = ms;
      this.cursor = (this.cursor + 1) % this.capacity;
      this.size = Math.min(this.capacity, this.size + 1);
    }
  }
  reset() {
    this.size = 0;
    this.cursor = 0;
  }
  summary() {
    // Ring storage avoids Array.shift() on every frame once the window is
    // full. Build the sortable window only at reporting cadence (1.5 s in the
    // quality governor), not during rendering.
    if (this.scratch.length < this.size)
      this.scratch = new Float64Array(
        Math.min(this.capacity, Math.max(this.size, this.scratch.length * 2, 64)),
      );
    const values = this.scratch.subarray(0, this.size);
    const start = this.size === this.capacity ? this.cursor : 0;
    let mean = 0;
    let stalls = 0;
    for (let index = 0; index < this.size; index += 1) {
      const sample = this.samples[(start + index) % this.capacity]!;
      values[index] = sample;
      mean += sample;
      if (sample > 50) stalls += 1;
    }
    const sorted = values.sort();
    const count = this.size;
    const percentile = (p: number) => sorted[Math.max(0, Math.ceil(count * p) - 1)] ?? 0;
    const meanMs = count ? mean / count : 0;
    const slowCount = Math.max(1, Math.ceil(count * 0.01));
    let slowTotal = 0;
    for (let index = count - slowCount; index < count && index >= 0; index += 1)
      slowTotal += sorted[index]!;
    const slowMean = count ? slowTotal / slowCount : 0;
    return {
      frames: count,
      meanMs,
      fps: meanMs ? 1000 / meanMs : 0,
      onePercentLow: slowMean ? 1000 / slowMean : 0,
      p50: percentile(0.5),
      p95: percentile(0.95),
      p99: percentile(0.99),
      maxMs: sorted[count - 1] ?? 0,
      stalls,
    };
  }
}

export type PerformanceWithMemory = Performance & { memory?: { usedJSHeapSize?: number } };
export function heapUsedBytes(
  source: PerformanceWithMemory | { memory?: { usedJSHeapSize?: number } } = performance,
) {
  const value = source.memory?.usedJSHeapSize;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
