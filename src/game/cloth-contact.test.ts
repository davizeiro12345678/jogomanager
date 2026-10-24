import { expect, it } from "vitest";
import { clothContactPulse } from "./cloth-contact";
import { ClothDynamics } from "./athlete-cloth";

it("uses the real action contact marker and rejects inactive or invalid actions", () => {
  expect(clothContactPulse("pass", 0.55, 1)).toBeCloseTo(1);
  expect(clothContactPulse("header", 0.5, 1)).toBe(1);
  expect(clothContactPulse("tackle", 0.65, 1)).toBeCloseTo(1);
  expect(clothContactPulse("pass", 1, 1)).toBe(0);
  expect(clothContactPulse("idle", 0.5, 1)).toBe(0);
  expect(clothContactPulse("pass", NaN, 1)).toBe(0);
  expect(clothContactPulse("pass", -1, 1)).toBe(0);
});
it("adds a bounded impulse at contact and lets the cloth return to rest", () => {
  const cloth = new ClothDynamics();
  const motion = { x: 0, z: 0, lift: 0, effort: 0, bend: 0 };
  cloth.advance(1 / 30, { ...motion, contact: 1 });
  expect(cloth.impact).toBeGreaterThan(0);
  for (let i = 0; i < 120; i++) cloth.advance(1 / 60, motion);
  expect(cloth.impact).toBeLessThan(0.00001);
});
it("wet fabric has a smaller bounded inertial response than dry fabric", () => {
  const dry = new ClothDynamics(),
    wet = new ClothDynamics();
  const motion = { x: 0, z: 0, lift: 0, effort: 0, bend: 0 };
  dry.advance(1 / 60, motion);
  wet.advance(1 / 60, motion);
  for (let i = 0; i < 30; i++) {
    dry.advance(1 / 60, { ...motion, z: 8 });
    wet.advance(1 / 60, { ...motion, z: 8, wet: 1 });
  }
  expect(Math.abs(wet.offset[1]!)).toBeLessThan(Math.abs(dry.offset[1]!));
});
