import { expect, it } from "vitest";
import { grassBladeGeometry } from "./grass-blade";
it("keeps the blade rooted at the surface with a tapered tip and bounded triangle cost", () => {
  const geometry = grassBladeGeometry();
  const p = geometry.getAttribute("position");
  expect(geometry.index!.count / 3).toBe(6);
  expect(p.getY(0)).toBe(0);
  // A clipped football pitch, rather than eight-centimetre ornamental grass.
  expect(p.getY(6)).toBeCloseTo(0.035);
  expect(Math.abs(p.getX(6))).toBeLessThan(Math.abs(p.getX(0)) * 0.1);
  expect(Array.from(geometry.getAttribute("normal").array).every(Number.isFinite)).toBe(true);
  geometry.dispose();
});
