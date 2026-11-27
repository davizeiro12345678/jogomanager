/**
 * A window of complete, visible frame intervals covering the latest 30 seconds.
 * The oldest interval can straddle the boundary; it is never shortened to hide
 * a stall. Capacity is a memory bound, not an assumed display refresh rate.
 */
export class FpsWindow {
  private readonly frames: Float64Array;
  private scratch = new Float64Array(0);
  private first = 0;
  private size = 0;
  private totalMs = 0;
  private elapsedMs = 0;
  private bucketMs = 0;
  private bucketFrames = 0;
  private readonly bucketFps = new Float64Array(32);
  private readonly bucketEnds = new Float64Array(32);
  private bucketCursor = 0;
  private bucketSize = 0;

  constructor(
    readonly windowMs = 30_000,
    readonly capacity = 18_000,
  ) {
    if (!Number.isFinite(windowMs) || windowMs <= 0)
      throw new RangeError("FPS window must have a positive duration");
    if (!Number.isInteger(capacity) || capacity <= 0)
      throw new RangeError("FPS window capacity must be a positive integer");
    this.frames = new Float64Array(capacity);
  }

  add(ms: number): boolean {
    if (!Number.isFinite(ms) || ms <= 0) return false;
    if (this.size === this.capacity) this.removeOldest();
    this.frames[(this.first + this.size) % this.capacity] = ms;
    this.size += 1;
    this.totalMs += ms;
    this.elapsedMs += ms;
    // A whole interval crossing the window boundary remains observable.
    while (this.size > 1 && this.totalMs - this.frames[this.first]! >= this.windowMs - 1e-7)
      this.removeOldest();

    this.bucketMs += ms;
    this.bucketFrames += 1;
    if (this.bucketMs < 1000 - 1e-7) return false;
    this.bucketFps[this.bucketCursor] = (this.bucketFrames * 1000) / this.bucketMs;
    this.bucketEnds[this.bucketCursor] = this.elapsedMs;
    this.bucketCursor = (this.bucketCursor + 1) % this.bucketFps.length;
    this.bucketSize = Math.min(this.bucketSize + 1, this.bucketFps.length);
    this.resetPartialSecond();
    return true;
  }

  resetPartialSecond() {
    this.bucketMs = 0;
    this.bucketFrames = 0;
  }

  reset() {
    this.first = this.size = this.totalMs = this.elapsedMs = 0;
    this.bucketCursor = this.bucketSize = 0;
    this.resetPartialSecond();
  }

  summary() {
    if (this.scratch.length < this.size)
      this.scratch = new Float64Array(
        Math.min(this.capacity, Math.max(this.size, this.scratch.length * 2, 64)),
      );
    const sorted = this.scratch.subarray(0, this.size);
    let over33 = 0,
      over50 = 0,
      over100 = 0,
      over250 = 0;
    for (let index = 0; index < this.size; index += 1) {
      const value = this.frames[(this.first + index) % this.capacity]!;
      sorted[index] = value;
      if (value > 1000 / 30) over33 += 1;
      if (value > 50) over50 += 1;
      if (value > 100) over100 += 1;
      if (value > 250) over250 += 1;
    }
    sorted.sort();
    const percentile = (fraction: number) =>
      sorted[Math.max(0, Math.ceil(this.size * fraction) - 1)] ?? 0;
    const low = (fraction: number) => {
      if (!this.size) return 0;
      const count = Math.max(1, Math.ceil(this.size * fraction));
      let total = 0;
      for (let index = this.size - count; index < this.size; index += 1) total += sorted[index]!;
      return (1000 * count) / total;
    };
    const cutoff = this.elapsedMs - this.totalMs;
    let now = 0,
      worst = Number.POSITIVE_INFINITY;
    const firstBucket =
      (this.bucketCursor - this.bucketSize + this.bucketFps.length) % this.bucketFps.length;
    for (let offset = 0; offset < this.bucketSize; offset += 1) {
      const index = (firstBucket + offset) % this.bucketFps.length;
      if (this.bucketEnds[index]! <= cutoff) continue;
      now = this.bucketFps[index]!;
      worst = Math.min(worst, now);
    }
    return {
      frames: this.size,
      windowMs: this.totalMs,
      fps: this.totalMs ? (this.size * 1000) / this.totalMs : 0,
      now,
      worst: Number.isFinite(worst) ? worst : 0,
      low1: low(0.01),
      low01: low(0.001),
      p50FrameMs: percentile(0.5),
      p95FrameMs: percentile(0.95),
      p99FrameMs: percentile(0.99),
      maxFrameMs: sorted[this.size - 1] ?? 0,
      framesOver33Ms: over33,
      framesOver50Ms: over50,
      framesOver100Ms: over100,
      framesOver250Ms: over250,
    };
  }

  private removeOldest() {
    this.totalMs -= this.frames[this.first]!;
    this.first = (this.first + 1) % this.capacity;
    this.size -= 1;
  }
}
