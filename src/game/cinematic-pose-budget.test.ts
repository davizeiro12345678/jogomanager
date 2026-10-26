import { describe, expect, it } from "vitest";
import { CinematicPoseBudget, cinematicActorBounds } from "./cinematic-pose-budget";

describe("cinematic pose work budget", () => {
  it("updates a visible principal on every frame and preserves the full visual delta", () => {
    const budget = new CinematicPoseBudget();
    const steps = Array.from({ length: 120 }, () => budget.sample(1 / 120, true, true));
    expect(steps.filter((step) => step !== null)).toHaveLength(120);
    expect(steps.reduce<number>((sum, step) => sum + (step ?? 0), 0)).toBeCloseTo(1);
  });
  it("bounds background work while retaining elapsed time for visible listeners", () => {
    const budget = new CinematicPoseBudget();
    const steps = Array.from({ length: 120 }, () => budget.sample(1 / 120, true, false));
    expect(steps.filter((step) => step !== null)).toHaveLength(30);
    expect(steps.reduce<number>((sum, step) => sum + (step ?? 0), 0)).toBeCloseTo(1);
  });
  it("reduces offscreen work and immediately refreshes on camera reentry", () => {
    const budget = new CinematicPoseBudget();
    const hidden = Array.from({ length: 120 }, () => budget.sample(1 / 120, false, true));
    expect(hidden.filter((step) => step !== null).length).toBeLessThanOrEqual(9);
    expect(budget.sample(1 / 120, true, true)).not.toBeNull();
  });
  it("allows a forced static pose, rejects invalid deltas and bounds catch-up", () => {
    const budget = new CinematicPoseBudget();
    expect(budget.sample(0, true, true, true)).toBe(0);
    expect(budget.sample(0, true, true)).toBeNull();
    expect(budget.sample(NaN, true, true)).toBeNull();
    expect(budget.sample(10, true, true)).toBeCloseTo(1 / 12);
  });
  it("uses a conservative whole-body envelope for seated, standing and reaching actors", () => {
    const bounds = cinematicActorBounds(1.84);
    for (const [x, y, z] of [
      [0, -0.3, 0],
      [0, 2.5, 0],
      [-1.5, 1.5, 0],
      [1.5, 1.5, 0],
      [0, 0.3, 1.6],
    ]) {
      expect(Math.hypot(x!, y! - bounds.centerY, z!)).toBeLessThan(bounds.radius);
    }
    expect(cinematicActorBounds(1.6).radius).toBeLessThan(bounds.radius);
  });
});
