import * as THREE from "three";

let texture: THREE.DataTexture | undefined;

/** Shared soft falloff: an untextured sprite made each floodlight a square. */
export function lightGlowTexture() {
  if (texture) return texture;
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const radius = Math.hypot(((x + 0.5) / size) * 2 - 1, ((y + 0.5) / size) * 2 - 1);
      const alpha =
        Math.exp(-radius * radius * 6) * (1 - THREE.MathUtils.smoothstep(radius, 0.72, 1));
      const i = (y * size + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 255;
      data[i + 3] = Math.round(alpha * 255);
    }
  texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.magFilter = texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}
