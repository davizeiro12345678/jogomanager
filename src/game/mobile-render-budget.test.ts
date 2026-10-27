import { describe, expect, it } from "vitest";
import { mobileFramebufferRatio, mobileRenderBudget } from "./mobile-render-budget";

describe("mobile framebuffer budget", () => {
  it("caps both axes after rotation, resize and a high requested DPR", () => {
    for (const tier of ["baixa", "media", "alta", "cinema"] as const) {
      const budget = mobileRenderBudget(tier, true)!;
      for (const [width, height] of [
        [1920, 1080],
        [390, 844],
        [1366, 768],
        [844, 390],
      ]) {
        const ratio = mobileFramebufferRatio(width!, height!, 3, budget);
        expect(Math.max(width!, height!) * ratio).toBeLessThanOrEqual(budget.longEdge);
        expect(Math.min(width!, height!) * ratio).toBeLessThanOrEqual(budget.shortEdge);
        expect(ratio).toBeLessThanOrEqual(3);
      }
    }
  });
  it("preserves desktop quality and a cheaper requested resolution", () => {
    expect(mobileRenderBudget("alta", false)).toBeNull();
    const budget = mobileRenderBudget("baixa", true)!;
    expect(mobileFramebufferRatio(800, 400, 0.5, budget)).toBe(0.5);
    expect(mobileFramebufferRatio(0, 0, NaN, budget)).toBeGreaterThan(0);
    expect(budget).toMatchObject({
      maxDrawCalls: 75,
      maxTriangles: 130000,
      studioDrawCalls: 40,
      studioTriangles: 90000,
    });
    expect(mobileRenderBudget("media", true)).toMatchObject({
      maxDrawCalls: 110,
      maxTriangles: 260000,
    });
  });
});
