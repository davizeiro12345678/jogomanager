import { describe, expect, it } from "vitest";
import { CINEMATIC_CROWD_HZ, cinematicCrowdUpdateAt } from "./cinematic-crowd-timing";

describe("cinematic crowd timing", () => {
  it("updates distant people immediately, then holds their matrices to a 45 Hz budget", () => {
    let accumulator = 0;
    let initialized = false;
    let updates = 0;
    for (let frame = 0; frame < 139 * 2; frame++) {
      const step = cinematicCrowdUpdateAt(accumulator, 1 / 139, initialized);
      accumulator = step.accumulator;
      initialized ||= step.update;
      updates += Number(step.update);
    }
    expect(CINEMATIC_CROWD_HZ).toBe(45);
    expect(updates).toBeGreaterThanOrEqual(89);
    expect(updates).toBeLessThanOrEqual(91);
  });

  it("does not delay the first visible matrices or emit invalid accumulated time", () => {
    expect(cinematicCrowdUpdateAt(0, 0, false)).toEqual({ update: true, accumulator: 0 });
    expect(cinematicCrowdUpdateAt(0, Number.NaN, true)).toEqual({ update: false, accumulator: 0 });
    const result = cinematicCrowdUpdateAt(0, 1 / 30, true);
    expect(result.update).toBe(true);
    expect(result.accumulator).toBeGreaterThanOrEqual(0);
    expect(result.accumulator).toBeLessThan(1 / CINEMATIC_CROWD_HZ);
  });
});
