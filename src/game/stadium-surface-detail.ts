import * as THREE from "three";

let maps: { normal: THREE.DataTexture; roughness: THREE.DataTexture } | undefined;

/** Eight KiB of shared, linear detail for all concrete batches; no extra draws. */
export function stadiumSurfaceDetail() {
  if (maps) return maps;
  const size = 32;
  const normal = new Uint8Array(size * size * 4);
  const roughness = new Uint8Array(size * size * 4);
  let seed = 0x51ad1a;
  const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  for (let pixel = 0; pixel < size * size; pixel++) {
    const offset = pixel * 4;
    const x = (random() - 0.5) * 0.18;
    const y = (random() - 0.5) * 0.18;
    const length = Math.hypot(x, y, 1);
    normal.set(
      [
        Math.round(128 + (x / length) * 127),
        Math.round(128 + (y / length) * 127),
        Math.round(128 + 127 / length),
        255,
      ],
      offset,
    );
    const value = 220 + Math.round(random() * 35);
    roughness.set([value, value, value, 255], offset);
  }
  const texture = (pixels: Uint8Array, name: string) => {
    const map = new THREE.DataTexture(pixels, size, size);
    map.name = name;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(8, 4);
    map.generateMipmaps = true;
    map.minFilter = THREE.LinearMipmapLinearFilter;
    map.magFilter = THREE.LinearFilter;
    map.needsUpdate = true;
    return map;
  };
  maps = {
    normal: texture(normal, "stadium-concrete-pores"),
    roughness: texture(roughness, "stadium-concrete-roughness"),
  };
  return maps;
}
