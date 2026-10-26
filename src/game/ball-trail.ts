/** Drei's existing 5.5-length trail retains 55 history samples. Include one
 * extra frame because its child subscriber can sample before the ball moves. */
export const BALL_TRAIL_CLEAR_FRAMES = 56;

/** Cosmetic emphasis only. No simulation state, allocations or frame timers. */
export class BallTrail {
  private opacity = 0;
  private hiddenFrames = 0;

  step(speed: number, dt: number, snap = false): number {
    if (snap) {
      this.hiddenFrames = BALL_TRAIL_CLEAR_FRAMES;
      this.opacity = 0;
    }
    if (this.hiddenFrames > 0) {
      this.hiddenFrames--;
      return 0;
    }
    if (!Number.isFinite(dt) || dt <= 0) return this.opacity;
    const u = Number.isFinite(speed) ? Math.max(0, Math.min(1, (speed - 8) / 10)) : 0;
    const target = 0.32 * u * u * (3 - 2 * u);
    this.opacity += (target - this.opacity) * (1 - Math.exp(-14 * Math.min(dt, 0.1)));
    if (target === 0 && this.opacity < 0.001) this.opacity = 0;
    return this.opacity;
  }
}
