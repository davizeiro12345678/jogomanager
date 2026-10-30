import { describe, expect, it } from "vitest";
import { buildConservativeDepthPyramid, certainlyOccluded } from "./depth-pyramid";

describe("conservative Hi-Z depth reference", () => {
  it("propagates the farthest depth to keep visible depth holes", () => {
    const levels = buildConservativeDepthPyramid(
      new Float32Array([0.1, 0.2, 0.2, 0.2, 0.9, 0.2, 0.1, 0.2, 0.2]),
      3,
      3,
    );
    expect(levels.map((x) => [x.width, x.height])).toEqual([
      [3, 3],
      [2, 2],
      [1, 1],
    ]);
    expect(levels.at(-1)?.values[0]).toBeCloseTo(0.9);
    expect(certainlyOccluded(levels.at(-1)!, 0, 0, 0.7)).toBe(false);
    expect(certainlyOccluded(levels.at(-1)!, 0, 0, 0.98)).toBe(true);
  });
  it("treats invalid depth as the farthest value rather than falsely removing surfaces", () => {
    const level = buildConservativeDepthPyramid(new Float32Array([Number.NaN, 0.1]), 2, 1);
    expect(level.at(-1)?.values[0]).toBe(1);
    expect(certainlyOccluded(level.at(-1)!, 0, 0, 0.6)).toBe(false);
  });
});
