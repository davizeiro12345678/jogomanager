import * as THREE from "three";

export type QuantizedGeometryPositions = Readonly<{
  data: Uint16Array;
  origin: THREE.Vector3;
  scale: THREE.Vector3;
  count: number;
}>;

/**
 * Reversible quantization to 16-bit coordinates per axis (6 B/vertex
 * instead of 12 B for Float32). Decode in a shader or in a worker before
 * drawing; directly binding this normalized data as world coordinates
 * would break the pitch bounds and raycasts.
 */
export function quantizeGeometryPositions(
  geometry: THREE.BufferGeometry,
): QuantizedGeometryPositions {
  const pos = geometry.getAttribute("position");
  if (!pos || pos.itemSize !== 3) throw new TypeError("Expected xyz geometry positions");
  const bounds = new THREE.Box3();
  const point = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    point.set(pos.getX(i), pos.getY(i), pos.getZ(i));
    if (![point.x, point.y, point.z].every(Number.isFinite))
      throw new RangeError("Nonfinite geometry position");
    bounds.expandByPoint(point);
  }
  if (bounds.isEmpty()) throw new RangeError("Cannot quantize empty geometry");
  const origin = bounds.min.clone();
  const scale = bounds.max.clone().sub(origin).divideScalar(65535);
  const data = new Uint16Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    data[i * 3] = scale.x ? Math.round((pos.getX(i) - origin.x) / scale.x) : 0;
    data[i * 3 + 1] = scale.y ? Math.round((pos.getY(i) - origin.y) / scale.y) : 0;
    data[i * 3 + 2] = scale.z ? Math.round((pos.getZ(i) - origin.z) / scale.z) : 0;
  }
  return { data, origin, scale, count: pos.count };
}

/** Exact shader-equivalent reconstruction used by visual parity tests. */
export function decodeQuantizedPosition(
  data: QuantizedGeometryPositions,
  index: number,
  target = new THREE.Vector3(),
): THREE.Vector3 {
  if (!Number.isInteger(index) || index < 0 || index >= data.count)
    throw new RangeError("Invalid quantized vertex");
  return target.set(
    data.origin.x + data.data[index * 3]! * data.scale.x,
    data.origin.y + data.data[index * 3 + 1]! * data.scale.y,
    data.origin.z + data.data[index * 3 + 2]! * data.scale.z,
  );
}
