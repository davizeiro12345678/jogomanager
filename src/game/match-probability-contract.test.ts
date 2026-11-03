import { expect, it } from "vitest";
import { expectedGoals } from "./match-probability";

it("keeps the default match rates bit-identical to explicitly empty conditions", () => {
  const strengths = [-Infinity, NaN, -0, 0, 20, 35, 60, 70, 83.5, 99, 120, Infinity];
  for (let index = 0; index < 32; index++) {
    for (const home of strengths) {
      for (const away of strengths) {
        const seed = `default-conditions-${index}`;
        expect(expectedGoals(home, away, seed)).toEqual(expectedGoals(home, away, seed, {}));
      }
    }
  }
});
