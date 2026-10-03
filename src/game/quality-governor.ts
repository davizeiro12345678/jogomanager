import { FrameMetrics } from "./frame-metrics";

/** Decisions use short p95 windows. Recovery is deliberately slower.
 * Stages resolve through RuntimeSceneBudget: DPR, grass, crowd, props,
 * shadows, post, then hero players as the final emergency lever. */
export class QualityGovernor {
  stage = 0;
  private window = new FrameMetrics(900);
  private elapsed = 0;
  private cooldown = 0.75;
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
    if (this.elapsed < 1.5) return this.stage;
    const { p95, frames } = this.window.summary();
    this.window.reset();
    this.elapsed = 0;
    if (this.cooldown > 0 || frames < 8) return this.stage;
    const pressure = this.budgetMs > 0 ? p95 / this.budgetMs : 0;
    // Catch a badly overloaded device before it spends most of a match on
    // the wrong side of its frame budget. Preserve hero detail until the
    // later stages, while allowing severe stalls to skip redundant steps.
    if (pressure >= 3 && this.stage < 8) {
      this.stage = Math.min(8, this.stage + 3);
      this.cooldown = 2.25;
      this.slow = 0;
      this.fast = 0;
      return this.stage;
    }
    if (pressure >= 2.1 && this.stage < 8) {
      this.stage = Math.min(8, this.stage + 2);
      this.cooldown = 2.25;
      this.slow = 0;
      this.fast = 0;
      return this.stage;
    }
    this.slow = pressure > 1.08 ? this.slow + 1 : 0;
    this.fast = p95 < this.budgetMs * 0.72 ? this.fast + 1 : 0;
    if (this.slow >= 2 && this.stage < 8) {
      this.stage++;
      this.cooldown = 3;
      this.slow = 0;
      this.fast = 0;
    } else if (this.fast >= 6 && this.stage > 0) {
      this.stage--;
      this.cooldown = 12;
      this.fast = 0;
      this.slow = 0;
    }
    return this.stage;
  }
}

export function resolutionForStage(stage: number) {
  return stage >= 2 ? 0.76 : stage >= 1 ? 0.88 : 1;
}
