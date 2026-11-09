/** Bounded samples. Visible stalls stay in the distribution, including >250 ms. */
export type PerformanceWithMemory = Performance & {
  memory?: { usedJSHeapSize?: number };
};

export function heapUsedBytes(
  source: PerformanceWithMemory | { memory?: { usedJSHeapSize?: number } } = performance,
) {
  const value = source.memory?.usedJSHeapSize;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export class FrameMetrics {
  protected readonly samples: Float64Array;
  private scratch = new Float64Array(0);
  protected size = 0;
  protected cursor = 0;
  private observedFrames = 0;
  private observedMs = 0;
  private invalidSamples = 0;
  constructor(readonly capacity = 18000) {
    if (!Number.isInteger(capacity) || capacity < 1)
      throw new RangeError("FrameMetrics capacity must be a positive integer");
    this.samples = new Float64Array(capacity);
  }
  add(ms: number) {
    if (Number.isFinite(ms) && ms > 0) {
      this.observedFrames += 1;
      this.observedMs += ms;
      this.samples[this.cursor] = ms;
      this.cursor = (this.cursor + 1) % this.capacity;
      this.size = Math.min(this.capacity, this.size + 1);
    } else this.invalidSamples += 1;
  }
  reset() {
    this.size = 0;
    this.cursor = 0;
    this.observedFrames = this.observedMs = this.invalidSamples = 0;
  }
  /** Explicit evidence export only; reporting cadence does not allocate or
   * repeatedly transmit the full campaign's raw samples. */
  rawFrameMs(): number[] {
    const start = this.size === this.capacity ? this.cursor : 0;
    return Array.from(
      { length: this.size },
      (_, index) => this.samples[(start + index) % this.capacity]!,
    );
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
    let over33 = 0,
      over100 = 0,
      over250 = 0;
    for (let index = 0; index < this.size; index += 1) {
      const sample = this.samples[(start + index) % this.capacity]!;
      values[index] = sample;
      mean += sample;
      if (sample > 1000 / 30) over33 += 1;
      if (sample > 50) stalls += 1;
      if (sample > 100) over100 += 1;
      if (sample > 250) over250 += 1;
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
    const pointOneCount = Math.max(1, Math.ceil(count * 0.001));
    let pointOneTotal = 0;
    for (let index = count - pointOneCount; index < count && index >= 0; index += 1)
      pointOneTotal += sorted[index]!;
    return {
      frames: count,
      meanMs,
      fps: meanMs ? 1000 / meanMs : 0,
      onePercentLow: slowMean ? 1000 / slowMean : 0,
      pointOnePercentLow: pointOneTotal ? (1000 * pointOneCount) / pointOneTotal : 0,
      p50: percentile(0.5),
      p95: percentile(0.95),
      p99: percentile(0.99),
      maxMs: sorted[count - 1] ?? 0,
      stalls,
      framesOver33Ms: over33,
      framesOver50Ms: stalls,
      framesOver100Ms: over100,
      framesOver250Ms: over250,
      coverage: {
        capacity: this.capacity,
        observedFrames: this.observedFrames,
        retainedFrames: count,
        droppedFrames: this.observedFrames - count,
        invalidSamples: this.invalidSamples,
        observedMs: this.observedMs,
        retainedMs: mean,
        completeDistribution: this.observedFrames === count,
      },
    };
  }
}
