/** A damped rubber shell response driven by velocity discontinuities, rather
 * than speed alone. Compression conserves approximate volume and dies out. */
export class BallResponse {
  compression = 0;
  private velocity = 0;
  impact(speed: number) {
    this.velocity += Math.min(2.5, Math.max(0, speed) * 0.065);
  }
  step(dt: number) {
    let remaining = Math.max(0, Math.min(dt, 0.1));
    while (remaining > 0) {
      const h = Math.min(remaining, 1 / 240);
      this.velocity += (-900 * this.compression - 36 * this.velocity) * h;
      this.compression = Math.max(0, Math.min(0.085, this.compression + this.velocity * h));
      if (this.compression === 0 && this.velocity < 0) this.velocity = 0;
      remaining -= h;
    }
    const axial = 1 - this.compression;
    return { axial, radial: 1 / Math.sqrt(axial) };
  }
}
