/** Live meter with no history, sorting or allocations on ordinary frames. */
export class FrameRateWindow {
  private last: number | null = null;
  private elapsed = 0;
  private frames = 0;
  constructor(readonly intervalMs = 2000) {
    if (!Number.isFinite(intervalMs) || intervalMs <= 0) throw new RangeError("Invalid interval");
  }
  sample(
    now: number,
    hidden = false,
  ): { fps: number; meanMs: number; frames: number; elapsedMs: number } | null {
    if (hidden || !Number.isFinite(now)) {
      this.last = null;
      this.elapsed = this.frames = 0;
      return null;
    }
    const previous = this.last;
    this.last = now;
    if (previous === null) return null;
    const delta = now - previous;
    if (delta <= 0) return null;
    this.elapsed += delta;
    this.frames++;
    if (this.elapsed < this.intervalMs) return null;
    const result = {
      fps: (this.frames * 1000) / this.elapsed,
      meanMs: this.elapsed / this.frames,
      frames: this.frames,
      elapsedMs: this.elapsed,
    };
    this.elapsed = this.frames = 0;
    return result;
  }
}
