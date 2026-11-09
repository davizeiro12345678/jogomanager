import * as THREE from "three";

/** Every drop shares orientation/scale until weather or wind changes. */
export function initializeWeatherInstanceMatrices(
  target: Float32Array,
  rain: boolean,
  wind: number,
): void {
  const transform = new THREE.Object3D();
  transform.rotation.set(0, 0, rain ? wind * 0.28 : 0);
  transform.scale.set(1, rain ? 1 : 0.5, 1);
  transform.updateMatrix();
  for (let offset = 0; offset + 16 <= target.length; offset += 16)
    target.set(transform.matrix.elements, offset);
}

/** Translation is the only changing matrix component during a weather frame. */
export function writeWeatherInstancePosition(
  target: Float32Array,
  index: number,
  x: number,
  y: number,
  z: number,
): void {
  const offset = index * 16;
  target[offset + 12] = x;
  target[offset + 13] = y;
  target[offset + 14] = z;
}
