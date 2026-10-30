import { describe, expect, it } from "vitest";
import { depthPyramidDimensions } from "./webgpu-hiz";

describe("WebGPU hierarchical Z allocation", () => {
  it("covers odd and rectangular viewports down to a 1x1 depth mip", () => {
    expect(depthPyramidDimensions(5, 3)).toEqual([[3, 2], [2, 1], [1, 1]]);
    expect(depthPyramidDimensions(1, 1)).toEqual([]);
    expect(depthPyramidDimensions(640, 360).at(-1)).toEqual([1, 1]);
  });
  it("rejects invalid sizes before allocating GPU storage textures", () => {
    expect(() => depthPyramidDimensions(0, 1)).toThrow(RangeError);
    expect(() => depthPyramidDimensions(9000, 9000)).toThrow(RangeError);
    expect(() => depthPyramidDimensions(Number.NaN, 1)).toThrow(RangeError);
  });
});
