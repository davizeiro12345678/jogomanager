import { expect, it } from "vitest";
import { supporterGeometry } from "./crowd-geometry";
it("keeps all supporters in one draw with distinct skin, hair and shirt regions", () => {
  const near = supporterGeometry(true),
    far = supporterGeometry(false);
  expect(near.groups).toHaveLength(0);
  expect(near.getAttribute("position").count).toBeGreaterThan(far.getAttribute("position").count);
  expect(new Set(near.getAttribute("crowdRegion").array)).toEqual(new Set([0, 1, 2, 3, 4]));
  expect(Array.from(near.getAttribute("position").array).every(Number.isFinite)).toBe(true);
  const motion = near.getAttribute("crowdLimb");
  expect(motion.count).toBe(near.getAttribute("position").count);
  expect(new Set(Array.from(motion.array).filter((_, i) => i % 2 === 1))).toEqual(
    new Set([0, 1, 2]),
  );
  const region = near.getAttribute("crowdRegion");
  for (let vertex = 0; vertex < motion.count; vertex++) {
    if (region.getX(vertex) === 2 || region.getX(vertex) === 4) expect(motion.getY(vertex)).toBe(0);
    if (motion.getY(vertex) > 0) expect(Math.abs(motion.getX(vertex))).toBe(1);
  }
  expect(near.boundingSphere!.radius).toBeLessThan(1.1);
  // A full stand must retain a bounded silhouette at medium distance.
  expect(far.index!.count / 3).toBeLessThanOrEqual(60);
  near.dispose();
  far.dispose();
});
