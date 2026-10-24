import { describe, expect, it } from "vitest";
import { visualMotionFor } from "./visual-motion";
describe("athlete inertia", () => {
  it("bounds a sprint half-turn while preserving the input snapshot", () => {
    const owner = {};
    const first = Object.freeze({ id: "runner", x: 0, z: 0, vx: 0, vz: 8 });
    const ball = { x: 0, z: 10 };
    visualMotionFor(owner, first, ball, 12, 0.86, 0);
    const reverse = Object.freeze({ ...first, vz: -8 });
    const next = visualMotionFor(owner, reverse, ball, 12, 0.86, 1 / 60);
    expect(Math.abs(next.yaw)).toBeLessThanOrEqual(14 / (1 + 8 * 0.22) / 60 + 1e-9);
    expect(reverse.vz).toBe(-8);
    expect(visualMotionFor(owner, reverse, ball, 12, 0.86, 1 / 60)).toBe(next);
  });
  it("resets presentation inertia after seeking backwards", () => {
    const owner = {};
    const player = { id: "runner", x: 0, z: 0, vx: 5, vz: 0 };
    visualMotionFor(owner, player, { x: 10, z: 0 }, 1, 0.86, 10);
    const reset = visualMotionFor(owner, { ...player, vx: 0, vz: 5 }, { x: 10, z: 0 }, 1, 0.86, 0);
    expect(reset.yaw).toBe(0);
    expect(reset.turnRate).toBe(0);
  });
});
