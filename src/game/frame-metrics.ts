/** Bounded samples. Visible stalls stay in the distribution, including >250 ms. */
export type PerformanceWithMemory = Performance & {
  memory?: { usedJSHeapSize?: number };
};

export function heapUsedBytes(source: PerformanceWithMemory | { memory?: { usedJSHeapSize?: number } } = performance) {
  const value = source.memory?.usedJSHeapSize;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export class FrameMetrics {
  private samples: number[] = [];
  constructor(readonly capacity = 18000) {}
  add(ms: number) {
    if (Number.isFinite(ms) && ms > 0) {
      this.samples.push(ms);
      if (this.samples.length > this.capacity) this.samples.shift();
    }
  }
  reset() {
    this.samples.length = 0;
  }
  summary() {
    const sorted = this.samples.slice().sort((a, b) => a - b);
    const count = sorted.length;
    const percentile = (p: number) => sorted[Math.max(0, Math.ceil(count * p) - 1)] ?? 0;
    const mean = count ? this.samples.reduce((sum, ms) => sum + ms, 0) / count : 0;
    return {
      frames: count,
      meanMs: mean,
      fps: mean ? 1000 / mean : 0,
      p50: percentile(0.5),
      p95: percentile(0.95),
      p99: percentile(0.99),
      maxMs: sorted[count - 1] ?? 0,
      stalls: this.samples.filter((ms) => ms > 50).length,
    };
  }
}
