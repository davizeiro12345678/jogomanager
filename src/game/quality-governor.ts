import { FrameMetrics } from "./frame-metrics";

/** Decisions use two-second p95 windows. Recovery is deliberately slower.
 * Stages resolve through RuntimeSceneBudget: DPR, grass, crowd, props,
 * shadows, post, then hero players as the final emergency lever. */
export class QualityGovernor {
  stage = 0;
  private window = new FrameMetrics(600);
  private elapsed = 0;
  private cooldown = 5;
  private slow = 0;
  private fast = 0;
  constructor(readonly budgetMs: number) {}
  resetWindow() {
    this.window.reset();
    this.elapsed = 0;
    this.slow = 0;
    this.fast = 0;
  }
  sample(dt: number): number {
    if (!Number.isFinite(dt) || dt <= 0) return this.stage;
    this.cooldown -= dt;
    this.elapsed += dt;
    this.window.add(dt * 1000);
    if (this.elapsed < 2) return this.stage;
    const { p95 } = this.window.summary();
    this.window.reset();
    this.elapsed = 0;
    if (this.cooldown > 0) return this.stage;
    this.slow = p95 > this.budgetMs * 1.08 ? this.slow + 1 : 0;
    this.fast = p95 < this.budgetMs * 0.72 ? this.fast + 1 : 0;
    if (this.slow >= 2 && this.stage < 8) {
      this.stage++;
      this.cooldown = 8;
      this.slow = 0;
      this.fast = 0;
    } else if (this.fast >= 6 && this.stage > 0) {
      this.stage--;
      this.cooldown = 16;
      this.fast = 0;
      this.slow = 0;
    }
    return this.stage;
  }
}

export function resolutionForStage(stage: number) {
  return stage >= 2 ? 0.76 : stage >= 1 ? 0.88 : 1;
}
