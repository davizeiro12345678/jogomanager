import { expect, it } from "vitest";
import { AthleteGazeMotion } from "./athlete-gaze-motion";

it("settles abrupt ball tracking without a one-frame head snap at 10/20/30/60 Hz", () => {
  for (const hz of [10, 20, 30, 60]) {
    const motion = new AthleteGazeMotion();
    motion.sample(-0.9, -0.2, 0);
    const first = motion.sample(0.9, 0.3, 1 / hz);
    expect(first.yaw).toBeGreaterThan(-0.9);
    expect(first.yaw).toBeLessThan(0.9);
    expect(first.pitch).toBeLessThan(0.3);
    for (let frame = 1; frame < hz; frame++) motion.sample(0.9, 0.3, 1 / hz);
    expect(motion.yaw).toBeCloseTo(0.9 - 1.8 * Math.exp(-14), 12);
    expect(motion.pitch).toBeCloseTo(0.3 - 0.5 * Math.exp(-14), 12);
  }
});

it("samples paused inspection exactly and resets invisible history without allocating results", () => {
  const motion = new AthleteGazeMotion();
  expect(motion.sample(0.5, 0.1, 0)).toBe(motion);
  motion.sample(-0.5, -0.1, 0, true);
  expect(motion.yaw).toBe(-0.5);
  expect(motion.pitch).toBe(-0.1);
  motion.reset();
  motion.sample(0.8, 0.2, 0);
  expect(motion.yaw).toBe(0.8);
  expect(motion.pitch).toBe(0.2);
  motion.sample(Number.NaN, Number.POSITIVE_INFINITY, Number.NaN);
  expect(motion.yaw).toBe(0.8);
  expect(motion.pitch).toBe(0.2);
});
