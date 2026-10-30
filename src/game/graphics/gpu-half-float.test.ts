import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { createHalfFloatVolume, packHalfFloatTexture } from "./gpu-half-float";

describe("optional half-float volume uploads", () => {
  it("matches Three's scalar conversion and preserves input bytes", () => {
    const input = Float32Array.from([
      0, 1, -1, 0.5, 0.0001, 2.25, 15.875, 65504,
      0, 0, 1, 1, -0.0001, 0.12, 3.9, 0,
    ]);
    const before = input.slice();
    const output = packHalfFloatTexture(input, 4);
    expect(input).toEqual(before);
    expect(output.length).toBe(input.length);
    for (let i = 0; i < input.length; i++) {
      expect(output[i]).toBe(THREE.DataUtils.toHalfFloat(input[i]!));
    }
  });
  it("creates an fp16 RGBA volume with no runtime recompression", () => {
    const voxels = new Float32Array(2 * 2 * 2 * 4).fill(1);
    const texture = createHalfFloatVolume(voxels, 2, 2, 2);
    expect(texture.type).toBe(THREE.HalfFloatType);
    expect(texture.image.data).toBeInstanceOf(Uint16Array);
    expect(texture.image.data.byteLength).toBe(64);
    expect(texture.generateMipmaps).toBe(false);
    texture.dispose();
    expect(() => createHalfFloatVolume(voxels, 4, 4, 4)).toThrow(RangeError);
    expect(() => packHalfFloatTexture(new Float32Array(3), 4)).toThrow(RangeError);
  });
});
