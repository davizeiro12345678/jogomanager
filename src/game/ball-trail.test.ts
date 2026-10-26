import { expect, it } from "vitest";
import { BallTrail, BALL_TRAIL_CLEAR_FRAMES } from "./ball-trail";

it("keeps possession clear and fades continuously into fast-shot emphasis", () => {
  const trail = new BallTrail();
  expect(trail.step(0, 1 / 60)).toBe(0);
  expect(trail.step(7.9, 1 / 60)).toBe(0);
  const justAbove = new BallTrail().step(8.01, 1 / 60);
  const medium = new BallTrail().step(13, 1 / 60);
  const fast = new BallTrail().step(18, 1 / 60);
  expect(justAbove).toBeGreaterThan(0);
  expect(justAbove).toBeLessThan(medium);
  expect(medium).toBeLessThan(fast);
  expect(fast).toBeLessThanOrEqual(0.32);
  for (let i = 0; i < 120; i++) trail.step(25, 1 / 60);
  expect(trail.step(0, 1 / 60)).toBeGreaterThan(0);
  for (let i = 0; i < 120; i++) trail.step(0, 1 / 60);
  expect(trail.step(0, 1 / 60)).toBe(0);
});

it("hides every old history sample after a seek, independently of display rate", () => {
  for (const fps of [20, 60, 144]) {
    const trail = new BallTrail();
    for (let i = 0; i < 30; i++) trail.step(25, 1 / fps);
    expect(trail.step(25, 1 / fps, true)).toBe(0);
    for (let i = 1; i < BALL_TRAIL_CLEAR_FRAMES; i++) expect(trail.step(25, 1 / fps)).toBe(0);
    expect(trail.step(25, 1 / fps)).toBeGreaterThan(0);
  }
});

it("holds the fade for invalid intervals and retains finite output", () => {
  const trail = new BallTrail();
  const opacity = trail.step(22, 1 / 60);
  for (const invalid of [0, -1, NaN, Infinity]) expect(trail.step(22, invalid)).toBe(opacity);
  expect(Number.isFinite(trail.step(NaN, 1 / 60))).toBe(true);
});
