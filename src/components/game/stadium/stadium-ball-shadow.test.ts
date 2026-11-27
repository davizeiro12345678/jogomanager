import { describe, expect, it } from "vitest";
import { ballShadowAppearance } from "./stadium-ball";

describe("visual ball contact shadow", () => {
  it("keeps the shadow compact and legible at ground contact", () => {
    expect(ballShadowAppearance(0.12)).toEqual({ scale: 1, opacity: 0.34 });
    expect(ballShadowAppearance(0)).toEqual(ballShadowAppearance(0.12));
  });

  it("gets broader and fainter as the ball climbs, instead of shrinking", () => {
    const ground = ballShadowAppearance(0.12);
    const volley = ballShadowAppearance(2);
    const highBall = ballShadowAppearance(8);

    expect(volley.scale).toBeGreaterThan(ground.scale);
    expect(highBall.scale).toBeGreaterThanOrEqual(volley.scale);
    expect(volley.opacity).toBeLessThan(ground.opacity);
    expect(highBall.opacity).toBeLessThan(volley.opacity);
  });

  it("clamps extreme and nonfinite heights to stable display values", () => {
    expect(ballShadowAppearance(Number.NaN)).toEqual(ballShadowAppearance(0.12));
    expect(ballShadowAppearance(-Infinity)).toEqual(ballShadowAppearance(0.12));
    for (const height of [Number.POSITIVE_INFINITY, 1e9]) {
      const visual = ballShadowAppearance(height);
      expect(Number.isFinite(visual.scale)).toBe(true);
      expect(Number.isFinite(visual.opacity)).toBe(true);
      expect(visual.scale).toBeGreaterThanOrEqual(1);
      expect(visual.scale).toBeLessThanOrEqual(3.1);
      expect(visual.opacity).toBeGreaterThanOrEqual(0);
      expect(visual.opacity).toBeLessThanOrEqual(0.34);
    }
  });
});
