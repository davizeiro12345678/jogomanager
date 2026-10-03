/** Bounded presentation-only cloth. Fixed edges and double buffering keep the
 * wave isotropic and stable at any render rate; no values enter the match save. */
export class NetDynamics {
  readonly displacement: Float32Array;
  private velocity: Float32Array;
  private next: Float32Array;
  private accumulator = 0;
  constructor(
    readonly cols: number,
    readonly rows: number,
  ) {
    const size = (cols + 1) * (rows + 1);
    this.displacement = new Float32Array(size);
    this.velocity = new Float32Array(size);
    this.next = new Float32Array(size);
  }
  impact(u: number, v: number, speed: number) {
    const stride = this.cols + 1;
    const force = Math.min(9, Math.max(0, speed) * 0.3);
    for (let y = 1; y < this.rows; y++) {
      for (let x = 1; x < this.cols; x++) {
        const distance = ((x / this.cols - u) * 7.32) ** 2 + ((y / this.rows - v) * 2.44) ** 2;
        const index = y * stride + x;
        this.velocity[index] = Math.min(
          12,
          this.velocity[index]! + force * Math.exp(-distance / 0.32),
        );
      }
    }
  }
  step(dt: number, time: number, wind: number) {
    this.accumulator += Math.max(0, Math.min(0.1, dt));
    const step = 1 / 120;
    const stride = this.cols + 1;
    while (this.accumulator + 1e-9 >= step) {
      this.accumulator -= step;
      for (let y = 1; y < this.rows; y++) {
        for (let x = 1; x < this.cols; x++) {
          const i = y * stride + x;
          const current = this.displacement[i]!;
          const lap =
            this.displacement[i - 1]! +
            this.displacement[i + 1]! +
            this.displacement[i - stride]! +
            this.displacement[i + stride]! -
            4 * current;
          const breeze = Math.sin(time * 1.7 + x * 0.3 + y * 0.25) * wind * 0.45;
          const velocity =
            (this.velocity[i]! + (lap * 380 - current * 24 + breeze) * step) *
            Math.exp(-4.2 * step);
          this.velocity[i] = velocity;
          this.next[i] = Math.max(-0.18, Math.min(0.85, current + velocity * step));
        }
      }
      this.displacement.set(this.next);
    }
  }
}

export interface NetBall {
  x: number;
  z: number;
  height: number;
  vx: number;
  vz: number;
}
/** Swept contact against the rear net, including high-speed shots that cross
 * the whole plane in one snapshot. Mirrored goals use the same local UV. */
export function rearNetImpact(previous: NetBall, ball: NetBall, side: number, fieldX: number) {
  const depth = side * ball.x - fieldX;
  const before = side * previous.x - fieldX;
  const plane = 1.72;
  if (before >= plane || depth < plane || depth - before > 5 || depth <= before) return null;
  const alpha = (plane - before) / (depth - before);
  const z = previous.z + (ball.z - previous.z) * alpha;
  const height = previous.height + (ball.height - previous.height) * alpha;
  if (Math.abs(z) > 3.66 || height < 0 || height > 2.44) return null;
  return {
    u: 0.5 - (side * z) / 7.32,
    v: 1 - height / 2.44,
    speed: Math.hypot(ball.vx, ball.vz, previous.vx, previous.vz) / Math.SQRT2,
  };
}
