import { describe, expect, it } from "vitest";
import { ballHorizontalBlend, ballShadowAppearance } from "./stadium-ball";

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

describe("visual ball positioning", () => {
  const fallback = { hasVisualBall: false, isHeld: false, discontinuity: false };

  it("does not add latency to the Worker visual presentation", () => {
    expect(ballHorizontalBlend(1 / 60, { ...fallback, hasVisualBall: true })).toBe(1);
  });

  it("keeps the ball locked to the boot while possessed", () => {
    expect(ballHorizontalBlend(1 / 60, { ...fallback, isHeld: true })).toBe(1);
  });

  it("snaps across restarts and canonical discontinuities", () => {
    expect(ballHorizontalBlend(1 / 60, { ...fallback, discontinuity: true })).toBe(1);
  });

  it("preserves legacy smoothing only for an unheld canonical free ball", () => {
    const factor = ballHorizontalBlend(1 / 60, fallback);
    expect(factor).toBeGreaterThan(0);
    expect(factor).toBeLessThan(1);
    expect(ballHorizontalBlend(0, fallback)).toBe(0);
    expect(ballHorizontalBlend(Number.NaN, fallback)).toBe(0);
    expect(ballHorizontalBlend(Infinity, fallback)).toBe(0);
    expect(ballHorizontalBlend(1_000, fallback)).toBeLessThan(1);
  });
});
