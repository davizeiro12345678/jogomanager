import * as THREE from "three";

export type GpuTexturePolicy = Readonly<{
  maxDataSize: number;
  maxColorSize: number;
  residentBudget: number;
  colorAnisotropy: number;
  dataAnisotropy: number;
}>;

export function gpuTexturePolicy(memoryGb?: number, maxAnisotropy = 4): GpuTexturePolicy {
  const constrained = memoryGb !== undefined && memoryGb <= 4;
  return {
    maxDataSize: constrained ? 256 : 512,
    maxColorSize: constrained ? 512 : 1024,
    residentBudget: (constrained ? 8 : 24) * 1024 * 1024,
    colorAnisotropy: Math.max(1, Math.min(constrained ? 2 : 4, maxAnisotropy)),
    dataAnisotropy: 1,
  };
}

/** Keep authored mipmaps and compressed blocks. Never rescale them through canvas. */
export function prepareGpuTexture(
  texture: THREE.CompressedTexture,
  color: boolean,
  policy: GpuTexturePolicy,
): {
  bytes: number;
  droppedMips: number;
  compressed: boolean;
} {
  const maxSize = color ? policy.maxColorSize : policy.maxDataSize;
  const mips = texture.mipmaps;
  let droppedMips = 0;
  while (
    droppedMips + 1 < mips.length &&
    Math.max(mips[droppedMips]!.width, mips[droppedMips]!.height) > maxSize
  )
    droppedMips += 1;
  if (droppedMips > 0) {
    texture.mipmaps = mips.slice(droppedMips);
    // Clones can share the source, so dimensions must be fixed before publishing.
    texture.image.width = mips[droppedMips]!.width;
    texture.image.height = mips[droppedMips]!.height;
    // KTX decoders commonly return views into one allocation containing ALL
    // mip levels. Slicing the mip list alone keeps the discarded 1024/2048
    // levels alive in RAM. Pack the retained views into a right-sized buffer.
    const retainedBytes = texture.mipmaps.reduce((sum, mip) => sum + mip.data.byteLength, 0);
    if (texture.mipmaps.some((mip) => mip.data.buffer.byteLength > retainedBytes)) {
      const packed = new Uint8Array(retainedBytes);
      let offset = 0;
      texture.mipmaps = texture.mipmaps.map((mip) => {
        const length = mip.data.byteLength;
        packed.set(new Uint8Array(mip.data.buffer, mip.data.byteOffset, length), offset);
        const data = packed.subarray(offset, offset + length);
        offset += length;
        return { ...mip, data };
      });
    }
  }
  texture.anisotropy = color ? policy.colorAnisotropy : policy.dataAnisotropy;
  texture.generateMipmaps = false;
  texture.minFilter =
    texture.mipmaps.length > 1 ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
  const bytes = (texture.mipmaps as typeof mips).reduce((sum, mip) => sum + mip.data.byteLength, 0);
  return {
    bytes,
    droppedMips,
    compressed:
      texture instanceof THREE.CompressedTexture &&
      (texture.format as number) !== THREE.RGBAFormat &&
      (texture.format as number) !== THREE.RGBFormat,
  };
}
