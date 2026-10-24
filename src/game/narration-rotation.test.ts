import { describe, expect, it } from "vitest";
import { NarrationRotation } from "./narration-rotation";
describe("narration rotation", () => {
  it("exhausts a repertoire without repetition even with a constant RNG", () => {
    const rotation = new NarrationRotation();
    const first = Array.from({ length: 80 }, () => rotation.next("goal", 80, () => 0));
    expect(new Set(first).size).toBe(80);
    expect(rotation.next("goal", 80, () => 0)).not.toBe(first.at(-1));
  });
  it("isolates event bags and tolerates unavailable random samples", () => {
    const rotation = new NarrationRotation();
    const goals = Array.from({ length: 4 }, () => {
      rotation.next("save", 2, () => NaN);
      return rotation.next("goal", 4, () => 1);
    });
    expect(new Set(goals).size).toBe(4);
    expect(rotation.next("goal", 0)).toBe(0);
  });
});
