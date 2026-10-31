import * as THREE from "three";

/** Array atlas avoids 2D UV edge bleed and multiple sampler permutations.
 * Source layers must be RGBA8 at the same dimensions. Nothing is uploaded
 * until the texture is attached to an actual material. */
export function makeRgbaTextureArray(
  layers: readonly Uint8Array[],
  width: number,
  height: number,
  srgb = true,
): THREE.DataArrayTexture {
  if (
    !Number.isSafeInteger(width) ||
    width <= 0 ||
    !Number.isSafeInteger(height) ||
    height <= 0 ||
    !layers.length ||
    layers.length > 64
  )
    throw new RangeError("Invalid texture-array dimensions or layer count");
  const layerBytes = width * height * 4;
  const storage = new Uint8Array(layerBytes * layers.length);
  layers.forEach((layer, index) => {
    if (layer.length !== layerBytes)
      throw new RangeError("All texture-array layers must have identical RGBA8 dimensions");
    storage.set(layer, layerBytes * index);
  });
  const texture = new THREE.DataArrayTexture(storage, width, height, layers.length);
  texture.format = THREE.RGBAFormat;
  texture.type = THREE.UnsignedByteType;
  texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}
