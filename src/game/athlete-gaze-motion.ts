/** Presentation-only eye/head target filtering. The authored action pose is
 * still sampled at its exact impact phase; only the additive ball gaze settles.
 * Reuses one result and consumes elapsed time without frame-rate dependent lerp. */
export class AthleteGazeMotion {
  yaw = 0;
  pitch = 0;
  private ready = false;

  reset(): void {
    this.ready = false;
  }

  sample(yaw: number, pitch: number, elapsed: number, instant = false): this {
    const targetYaw = Number.isFinite(yaw) ? yaw : this.yaw;
    const targetPitch = Number.isFinite(pitch) ? pitch : this.pitch;
    const dt = Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0;
    if (instant || !this.ready) {
      this.yaw = targetYaw;
      this.pitch = targetPitch;
      this.ready = true;
      return this;
    }
    const response = 1 - Math.exp(-14 * dt);
    this.yaw += (targetYaw - this.yaw) * response;
    this.pitch += (targetPitch - this.pitch) * response;
    this.ready = true;
    return this;
  }
}
