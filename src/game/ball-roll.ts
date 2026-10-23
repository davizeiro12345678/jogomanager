/** Presentation-only rolling from actual rendered travel. The same travelled
 * distance produces the same rotation at 20 or 120 FPS. Airborne spin retains
 * angular momentum instead of repeatedly resetting to the flight direction. */
export class BallRoll {
  private x = 0;
  private z = 0;
  private angularX = 0;
  private angularZ = 0;
  private ready = false;
  private readonly result = { axisX: 0, axisZ: 1, angle: 0 };

  step(x: number, z: number, height: number, dt: number, reset = false) {
    const h = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
    // A paused/invalid presentation sample cannot consume travelled distance
    // or angular momentum. Explicit replay seeks still reset the anchor.
    if (this.ready && !reset && h === 0) {
      this.result.angle = 0;
      return this.result;
    }
    const distance = Math.hypot(x - this.x, z - this.z);
    if (!this.ready || reset || !Number.isFinite(distance) || distance > 4) {
      this.angularX = this.angularZ = 0;
      this.ready = true;
      this.result.angle = 0;
    } else if (height <= 0.2 && h > 0) {
      const dx = x - this.x,
        dz = z - this.z;
      this.angularX = dz / (0.12 * h);
      this.angularZ = -dx / (0.12 * h);
      this.result.angle = distance / 0.12;
    } else {
      const decay = Math.exp(-0.28 * h);
      // Analytic integration preserves the decay over different frame sizes.
      this.result.angle = (Math.hypot(this.angularX, this.angularZ) * (1 - decay)) / 0.28;
      this.angularX *= decay;
      this.angularZ *= decay;
    }
    const speed = Math.hypot(this.angularX, this.angularZ);
    if (speed > 0.0001) {
      this.result.axisX = this.angularX / speed;
      this.result.axisZ = this.angularZ / speed;
    }
    this.x = Number.isFinite(x) ? x : 0;
    this.z = Number.isFinite(z) ? z : 0;
    return this.result;
  }
}
