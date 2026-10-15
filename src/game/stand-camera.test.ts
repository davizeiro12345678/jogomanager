import { describe, expect, it } from "vitest";
import { standCameraPosition } from "./stand-camera";

describe("stand camera clearance", () => {
  it("keeps the lens and pitch sightline above the front concrete tiers", () => {
    for (const side of [-1, 1]) {
      const lens = standCameraPosition(34, side);
      expect(lens.y).toBeGreaterThan(2 + 2 * 1.45 + 1.7);
      // Former z=54, y=13.5 put the lens inside row nine (top=15.05).
      expect(Math.abs(lens.z)).toBeLessThan(34 + 7 + 3 * 1.5 - 0.75);
      for (const targetZ of [-34, 0, 34]) {
        for (let row = 0; row < 2; row++) {
          const tierFront = side * (34 + 7 + row * 1.5 - 0.75);
          const t = (tierFront - lens.z) / (targetZ - lens.z);
          const rayHeight = lens.y + (1 - lens.y) * t;
          expect(rayHeight).toBeGreaterThan(2 + row * 1.45 + 0.1);
        }
      }
      const lowestRoof = 2 + 3 * 1.45 + 7;
      expect(lens.y).toBeLessThan(lowestRoof - 1);
    }
  });
});
