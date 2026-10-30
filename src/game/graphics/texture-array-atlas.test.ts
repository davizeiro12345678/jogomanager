import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { makeRgbaTextureArray } from "./texture-array-atlas";

describe("GPU texture array atlas", () => {
  it("preserves layer bytes and sampler format without bleeding between layers", () => {
    const a = new Uint8Array([255, 0, 0, 255]);
    const b = new Uint8Array([0, 0, 255, 255]);
    const atlas = makeRgbaTextureArray([a, b], 1, 1);
    expect(atlas.image.depth).toBe(2);
    expect(Array.from(atlas.image.data ?? new Uint8Array())).toEqual([...a, ...b]);
    expect(atlas.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(atlas.generateMipmaps).toBe(false);
    atlas.dispose();
  });
  it("rejects different layer dimensions and excessive GPU storage", () => {
    expect(() => makeRgbaTextureArray([new Uint8Array(3)], 1, 1)).toThrow(RangeError);
    expect(() =>
      makeRgbaTextureArray(
        Array.from({ length: 65 }, () => new Uint8Array(4)),
        1,
        1,
      ),
    ).toThrow(RangeError);
  });
});
