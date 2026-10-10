import { describe, expect, it } from "vitest";
import { advanceAthleteHairMotion, createAthleteHairMotionState } from "./athlete-secondary-motion";

const sample = {
  dt: 1 / 60,
  speed: 7,
  accelerationLean: 0.08,
  turnRate: 3,
  phase: 1.2,
  style: "ponytail" as const,
};

describe("athlete loose-hair motion", () => {
  it("adds a bounded delayed response to acceleration and turns", () => {
    const state = createAthleteHairMotionState();
    for (let frame = 0; frame < 90; frame++)
      advanceAthleteHairMotion(state, { ...sample, phase: frame * 0.17 });
    expect(Math.abs(state.pitch)).toBeGreaterThan(0.015);
    expect(Math.abs(state.yaw)).toBeGreaterThan(0.015);
    expect(Math.abs(state.pitch)).toBeLessThanOrEqual(0.17);
    expect(Math.abs(state.yaw)).toBeLessThanOrEqual(0.17);
    expect(Math.abs(state.roll)).toBeLessThanOrEqual(0.13);
    expect(Object.values(state).every(Number.isFinite)).toBe(true);
  });

  it("stays stable across irregular frame times and settles when motion stops", () => {
    const state = createAthleteHairMotionState();
    for (let frame = 0; frame < 60; frame++)
      advanceAthleteHairMotion(state, { ...sample, dt: [0, 0.2, 1 / 120][frame % 3]! });
    for (let frame = 0; frame < 120; frame++)
      advanceAthleteHairMotion(state, {
        dt: 1 / 60,
        speed: 0,
        accelerationLean: 0,
        turnRate: 0,
        phase: 0,
        style: "ponytail",
      });
    expect(Math.abs(state.pitch)).toBeLessThan(0.001);
    expect(Math.abs(state.yaw)).toBeLessThan(0.001);
    expect(Math.abs(state.roll)).toBeLessThan(0.001);
  });

  it("keeps short or absent hair motionless", () => {
    const state = createAthleteHairMotionState();
    advanceAthleteHairMotion(state, { ...sample, style: "none" });
    expect(state).toEqual(createAthleteHairMotionState());
  });
});
