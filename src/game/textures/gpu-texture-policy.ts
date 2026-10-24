import * as THREE from "three";

export type GpuTexturePolicy = Readonly<{
  maxDataSize: number;
  maxColorSize: number;
  residentBudget: number;
  colorAnisotropy: number;
  dataAnisotropy: number;
}>;

/** Select authored resolution before fetching/decoding, while retaining GPU mip safeguards. */
export function selectTextureResolution(
  tiers: Readonly<Record<string, string>> | undefined,
  fallback: string,
  maxSize: number,
): string {
  let selected = fallback,
    selectedSize = 0;
  for (const [dimension, url] of Object.entries(tiers ?? {})) {
    const size = Number(dimension);
    if (Number.isSafeInteger(size) && size > selectedSize && size <= maxSize) {
      selected = url;
      selectedSize = size;
    }
  }
  return selected;
}

export function gpuTexturePolicy(
  memoryGb?: number,
  maxAnisotropy = 4,
  portrait = false,
): GpuTexturePolicy {
  const constrained = memoryGb !== undefined && memoryGb <= 4;
  const close = portrait && memoryGb !== undefined && Number.isFinite(memoryGb) && memoryGb >= 8;
  const supportedAnisotropy = Number.isFinite(maxAnisotropy) ? Math.max(1, maxAnisotropy) : 1;
  return {
    maxDataSize: constrained ? 256 : close ? 1024 : 512,
    maxColorSize: constrained ? 512 : 1024,
    residentBudget: (constrained ? 8 : close ? 32 : 24) * 1024 * 1024,
    colorAnisotropy: Math.min(constrained ? 2 : 4, supportedAnisotropy),
    dataAnisotropy: Math.min(constrained ? 1 : 2, supportedAnisotropy),
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
  // A device without compressed support or a malformed decoder result cannot
  // consume the scene budget or silently bypass the maximum mip dimension.
  if (
    !(texture instanceof THREE.CompressedTexture) ||
    (texture.format as number) === THREE.RGBAFormat ||
    (texture.format as number) === THREE.RGBFormat ||
    !mips.length ||
    mips.some(
      (mip) =>
        !Number.isInteger(mip.width) ||
        !Number.isInteger(mip.height) ||
        mip.width < 1 ||
        mip.height < 1 ||
        !ArrayBuffer.isView(mip.data) ||
        !mip.data.byteLength,
    )
  )
    return { bytes: 0, droppedMips: 0, compressed: false };
  let droppedMips = 0;
  while (
    droppedMips + 1 < mips.length &&
    Math.max(mips[droppedMips]!.width, mips[droppedMips]!.height) > maxSize
  )
    droppedMips += 1;
  if (Math.max(mips[droppedMips]!.width, mips[droppedMips]!.height) > maxSize)
    return { bytes: 0, droppedMips, compressed: false };
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
