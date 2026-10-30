import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { createHalfFloatVolume, packHalfFloatTexture } from "./gpu-half-float";

describe("optional half-float volume uploads", () => {
  it("matches Three's scalar conversion and preserves input bytes", () => {
    const input = Float32Array.from([
      0, 1, -1, 0.5, 0.0001, 2.25, 15.875, 65504, 0, 0, 1, 1, -0.0001, 0.12, 3.9, 0,
    ]);
    const before = input.slice();
    const output = packHalfFloatTexture(input, 4);
    expect(input).toEqual(before);
    expect(output.length).toBe(input.length);
    for (let i = 0; i < input.length; i++) {
      expect(output[i]).toBe(THREE.DataUtils.toHalfFloat(input[i]!));
    }
  });
  it("preserves signed zero, subnormals and high-dynamic-range input", () => {
    const source = new Float32Array([
      0,
      -0,
      2 ** -23,
      -(2 ** -23),
      0.00006103515625,
      -65504,
      65504,
      1,
    ]);
    const packed = packHalfFloatTexture(source, 4);
    expect(packed[0]).toBe(0x0000);
    expect(packed[1]).toBe(0x8000);
    for (let i = 0; i < source.length; i++)
      expect(packed[i]).toBe(THREE.DataUtils.toHalfFloat(source[i]!));
  });

  it("matches Three's scalar reference on a dense HDR voxel field", () => {
    const source = Float32Array.from(
      { length: 32768 },
      (_, i) => Math.sin(i * 0.783) * Math.pow(2, (i % 29) - 14),
    );
    const packed = packHalfFloatTexture(source, 4);
    for (let i = 0; i < source.length; i++)
      expect(packed[i]).toBe(THREE.DataUtils.toHalfFloat(source[i]!));
  });

  it("creates an fp16 RGBA volume with no runtime recompression", () => {
    const voxels = new Float32Array(2 * 2 * 2 * 4).fill(1);
    const texture = createHalfFloatVolume(voxels, 2, 2, 2);
    expect(texture.type).toBe(THREE.HalfFloatType);
    expect(texture.image.data).toBeInstanceOf(Uint16Array);
    expect(texture.image.data?.byteLength).toBe(64);
    expect(texture.generateMipmaps).toBe(false);
    texture.dispose();
    expect(() => createHalfFloatVolume(voxels, 4, 4, 4)).toThrow(RangeError);
    expect(() => packHalfFloatTexture(new Float32Array(3), 4)).toThrow(RangeError);
  });
});
