import { FrameMetrics } from "../src/game/frame-metrics";

/** Offline qualification; do not ship campaign analysis in the render governor. */
export class MobileFrameMetrics extends FrameMetrics {
  override summary() {
    const base = super.summary();
    const start = this.size === this.capacity ? this.cursor : 0;
    let elapsed = 0,
      firstEnd = 0,
      first = 0,
      over33Ms = 0;
    let minFiveSecondFps: number | null = null;
    for (let index = 0; index < this.size; index++) {
      const ms = this.samples[(start + index) % this.capacity]!;
      elapsed += ms;
      if (ms > 33.3) over33Ms++;
      if (index === 0) firstEnd = ms;
      while (first < index && firstEnd <= elapsed - 5000) {
        first++;
        firstEnd += this.samples[(start + first) % this.capacity]!;
      }
      if (elapsed >= 5000) {
        const fps = (index - first + 1) / 5;
        minFiveSecondFps = minFiveSecondFps === null ? fps : Math.min(minFiveSecondFps, fps);
      }
    }
    return {
      ...base,
      over33Ms,
      over33Percent: this.size ? (over33Ms * 100) / this.size : 0,
      minFiveSecondFps,
    };
  }
}
