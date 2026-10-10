import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { gpuTexturePolicy, prepareGpuTexture } from "./gpu-texture-policy";

describe("compressed GPU texture budgets", () => {
  it("releases the discarded backing allocation when decoder mipmaps share a buffer", () => {
    const buffer = new Uint8Array(1024 * 1024 + 256 * 256 + 64 * 64);
    buffer.fill(23, 1024 * 1024);
    const mips = [
      { width: 1024, height: 1024, data: buffer.subarray(0, 1024 * 1024) },
      { width: 256, height: 256, data: buffer.subarray(1024 * 1024, 1024 * 1024 + 256 * 256) },
      { width: 64, height: 64, data: buffer.subarray(1024 * 1024 + 256 * 256) },
    ];
    const texture = new THREE.CompressedTexture(mips, 1024, 1024, THREE.RGBA_BPTC_Format);
    const result = prepareGpuTexture(texture, false, gpuTexturePolicy(2));
    expect(result.bytes).toBe(256 * 256 + 64 * 64);
    for (const mip of texture.mipmaps) {
      expect(mip.data.buffer).not.toBe(buffer.buffer);
      expect(mip.data.buffer.byteLength).toBe(result.bytes);
      expect(mip.data[0]).toBe(23);
    }
    texture.dispose();
  });
  it("drops excessive authored mip levels while keeping correct dimensions and compressed blocks", () => {
    const mips = [1024, 512, 256, 128, 64, 32, 16, 8, 4].map((size) => ({
      width: size,
      height: size,
      data: new Uint8Array(size * size),
    }));
    const texture = new THREE.CompressedTexture(mips, 1024, 1024, THREE.RGBA_BPTC_Format);
    const result = prepareGpuTexture(texture, false, gpuTexturePolicy(16, 16));
    expect(result.compressed).toBe(true);
    expect(result.droppedMips).toBe(1);
    expect(result.bytes).toBe(mips.slice(1).reduce((sum, mip) => sum + mip.data.byteLength, 0));
    expect(texture.image).toMatchObject({ width: 512, height: 512 });
    expect(texture.mipmaps[0]).toBe(mips[1]);
    expect(texture.anisotropy).toBe(1);
    expect(texture.generateMipmaps).toBe(false);
  });

  it("reduces resolution and sampling cost on low-memory devices", () => {
    expect(gpuTexturePolicy(2, 16)).toMatchObject({
      maxDataSize: 256,
      maxColorSize: 512,
      residentBudget: 8 * 1024 * 1024,
      colorAnisotropy: 2,
    });
    expect(gpuTexturePolicy(16, 2).colorAnisotropy).toBe(2);
  });
});
