import * as THREE from "three";

// Bit-pattern lookup from a Float32Array avoids a shared mutable scalar
// conversion view, function calls and a float→int conversion for each voxel.
// Table entries represent signed exponent ranges (9-bit exponent + sign).
const HALF_BASE = new Uint16Array(512);
const HALF_SHIFT = new Uint8Array(512);
for (let key = 0; key < 512; key++) {
  const sign = (key & 0x100) !== 0 ? 0x8000 : 0;
  const exponent = (key & 0xff) - 127;
  if (exponent < -27) {
    HALF_BASE[key] = sign;
    HALF_SHIFT[key] = 24;
  } else if (exponent < -14) {
    HALF_BASE[key] = sign | (0x0400 >> (-exponent - 14));
    HALF_SHIFT[key] = -exponent - 1;
  } else if (exponent <= 15) {
    HALF_BASE[key] = sign | ((exponent + 15) << 10);
    HALF_SHIFT[key] = 13;
  } else {
    HALF_BASE[key] = sign | 0x7c00;
    HALF_SHIFT[key] = exponent < 128 ? 24 : 13;
  }
}

/** FP32 -> FP16 conversion for optional HDR volume textures. Input is never
 * modified; constant alpha/zero/one avoid repeated scalar converter calls.
 * Infinity and NaN remain delegated to the engine's supported conversion.
 */
export function packHalfFloatTexture(
  source: Float32Array,
  channels: 1 | 2 | 3 | 4 = 4,
): Uint16Array {
  if (source.length % channels !== 0)
    throw new RangeError("Half-float data is not aligned to its channel count");
  const result = new Uint16Array(source.length);
  const bits = new Uint32Array(source.buffer, source.byteOffset, source.length);
  for (let i = 0; i < source.length; i++) {
    const value = source[i]!;
    // Respect the upstream converter's out-of-range and NaN semantics.
    // Ordinary finite HDR samples take the fast path without allocations.
    if (!Number.isFinite(value) || Math.abs(value) > 65504) {
      result[i] = THREE.DataUtils.toHalfFloat(value);
      continue;
    }
    const word = bits[i]!;
    const key = (word >>> 23) & 0x1ff;
    result[i] = HALF_BASE[key]! + ((word & 0x007fffff) >>> HALF_SHIFT[key]!);
  }
  return result;
}

/** Optional fp16 procedural 3D texture, without an expensive per-frame upload. */
export function createHalfFloatVolume(
  data: Float32Array,
  width: number,
  height: number,
  depth: number,
): THREE.Data3DTexture {
  if (
    ![width, height, depth].every((size) => Number.isSafeInteger(size) && size > 0) ||
    data.length !== width * height * depth * 4
  ) throw new RangeError("Invalid HDR volume dimensions");
  const packed = packHalfFloatTexture(data, 4);
  const texture = new THREE.Data3DTexture(packed, width, height, depth);
  texture.type = THREE.HalfFloatType;
  texture.format = THREE.RGBAFormat;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}
