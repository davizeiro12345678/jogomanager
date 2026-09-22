import type { SimView } from "./sim";

export function broadcastInterest(sim: SimView) {
  const ball = sim.ball;
  const speed = Math.hypot(ball.vx, ball.vz);
  const goalDistance = Math.max(0, 52.5 - Math.abs(ball.x));
  const central = 1 - Math.min(1, Math.abs(ball.z) / 28);
  let nearby = 0;
  for (const player of sim.players) if ((player.x - ball.x) ** 2 + (player.z - ball.z) ** 2 < 100) nearby++;
  const approach = Math.max(0, Math.sign(ball.x) * ball.vx) / 25;
  const danger = Math.min(1, (1 - Math.min(1, goalDistance / 35)) * (0.5 + central * 0.35) + Math.min(1, approach) * 0.15);
  return { speed, danger, nearby, lead: Math.min(0.32, speed / 90), counter: speed > 15 && goalDistance > 20 };
}

export class ShotHold<T extends string> {
  private candidate: T;
  private pending = 0;
  private age = 0;
  constructor(public current: T) { this.candidate = current; }
  update(wanted: T, dt: number, minimum: number, manual = false) {
    this.age += dt;
    if (wanted !== this.candidate) { this.candidate = wanted; this.pending = 0; }
    this.pending += dt;
    if (wanted !== this.current && (manual || (this.age >= minimum && this.pending >= 1.2))) { this.current = wanted; this.age = 0; }
    return this.current;
  }
}
