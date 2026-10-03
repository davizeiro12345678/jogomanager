import { expect, it } from "vitest";
import { studioCameraFit } from "./player-studio-camera";

it("keeps an athlete inside the inspection frustum at portrait and wide aspect ratios", () => {
  for (const height of [1.6, 1.8, 2.05]) {
    for (const aspect of [0.2, 0.45, 0.8, 1.7, 3]) {
      const frame = studioCameraFit(height, aspect, 32, "body");
      const halfHeight = Math.tan((32 * Math.PI) / 360) * frame.distance;
      expect(halfHeight * 2).toBeGreaterThanOrEqual(height * 1.22);
      expect(halfHeight * aspect * 2).toBeGreaterThanOrEqual(height * 0.65);
      // OrbitControls must not clamp an automatically fitted portrait camera.
      expect(frame.maxDistance).toBeGreaterThan(frame.distance);
      expect(frame.minDistance).toBeLessThan(frame.distance);
    }
  }
});

it("keeps close-up and action camera fits finite, with room for a taller pose", () => {
  for (const framing of ["face", "kit", "legs", "boots", "hands", "body"]) {
    const short = studioCameraFit(1.6, 0.45, 32, framing);
    const tall = studioCameraFit(2.05, 0.45, 32, framing);
    expect(tall.distance).toBeGreaterThan(short.distance);
    expect(Object.values(tall).every(Number.isFinite)).toBe(true);
  }
  expect(studioCameraFit(1.8, 0.8, 32, "body", true).distance).toBeGreaterThan(
    studioCameraFit(1.8, 0.8, 32, "body").distance,
  );
  expect(Object.values(studioCameraFit(NaN, 0, 0, "body")).every(Number.isFinite)).toBe(true);
});
