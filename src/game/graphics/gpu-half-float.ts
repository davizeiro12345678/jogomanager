import * as THREE from "three";

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
  const halfOne = THREE.DataUtils.toHalfFloat(1);
  const halfZero = THREE.DataUtils.toHalfFloat(0);
  for (let i = 0; i < source.length; i++) {
    const value = source[i]!;
    result[i] =
      value === 0 ? halfZero : value === 1 ? halfOne : THREE.DataUtils.toHalfFloat(value);
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
