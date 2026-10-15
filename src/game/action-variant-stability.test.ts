import { expect, it } from "vitest";
import { selectClip, type SelectCtx } from "./animation";

it("holds keeper and celebration clips through the same action across global time boundaries", () => {
  for (const action of ["save", "saveHigh", "celebrate", "celebrateRun", "hug"] as const) {
    const c: SelectCtx = {
      action,
      isGK: true,
      speed: 0,
      hasBall: false,
      ballDist: 12,
      stamina: 90,
      defending: true,
      stopped: true,
      seed: 43,
      time: 2.35,
      actionT: 1.8,
      actionDur: 1.8,
    };
    const selected = selectClip(c);
    for (const elapsed of [0.1, 0.5, 1, 1.7])
      expect(selectClip({ ...c, time: c.time + elapsed, actionT: 1.8 - elapsed })).toBe(selected);
    expect(c.actionT).toBe(1.8);
    for (const time of [20, 23, 27])
      expect(selectClip({ ...c, actionSeed: 9, time })).toBe(selectClip({ ...c, actionSeed: 9 }));
  }
});
