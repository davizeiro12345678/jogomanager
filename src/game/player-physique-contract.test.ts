import { describe, expect, it } from "vitest";
import { anatomyMeasurements, lookFor, lookWithPhysique, proportionsFor } from "./player-model";

describe("roster physique contract", () => {
  it("matches measured stature, varies weight and preserves appearance identity", () => {
    const look = lookFor("physique-contract", "GK");
    for (const height of [160, 175, 190, 205]) {
      const light = lookWithPhysique(look, { height, weight: 65 });
      const heavy = lookWithPhysique(look, { height, weight: 105 });
      expect(anatomyMeasurements(proportionsFor(light)).height).toBeCloseTo(height / 100, 6);
      expect(heavy.girth).toBeGreaterThan(light.girth);
      for (const key of [
        "seed",
        "skin",
        "eyeColor",
        "hairStyle",
        "hairColor",
        "beard",
        "bootColor",
      ] as const)
        expect(heavy[key]).toBe(look[key]);
    }
    expect(lookWithPhysique(look, {})).toBe(look);
    expect(lookWithPhysique(look, { height: NaN, weight: -1 })).toBe(look);
  });
});
