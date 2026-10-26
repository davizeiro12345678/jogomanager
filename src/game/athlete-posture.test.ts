import { expect, it } from "vitest";
import { emptyPose } from "./animation-core";
import { refineAthletePosture } from "./athlete-posture";
const input = {
  time: 1,
  phase: 0.7,
  speed: 6,
  seed: 17,
  stamina: 90,
  accelerationLean: 0,
  turnRate: 0,
  hasAction: false,
  defending: false,
};
it("absorbs braking in the legs and lowers the body without changing action contacts", () => {
  const steady = refineAthletePosture(emptyPose(), input);
  const braking = refineAthletePosture(emptyPose(), { ...input, accelerationLean: -0.085 });
  expect(braking.hipY).toBeLessThan(steady.hipY);
  expect(braking.kneeL).toBeLessThan(steady.kneeL);
  expect(braking.kneeL).toBe(braking.kneeR);
  const action = refineAthletePosture(emptyPose(), { ...input, hasAction: true });
  expect(
    refineAthletePosture(emptyPose(), { ...input, hasAction: true, accelerationLean: -0.085 }),
  ).toEqual(action);
});
it("keeps the defensive set stance finite across extreme inputs", () => {
  for (const stamina of [0, 50, 100, NaN])
    for (const speed of [0, 1, 3, 8, 12]) {
      const pose = refineAthletePosture(emptyPose(), {
        ...input,
        stamina,
        speed,
        defending: true,
        accelerationLean: -5,
        turnRate: 100,
      });
      expect(Object.values(pose).every(Number.isFinite)).toBe(true);
    }
});
