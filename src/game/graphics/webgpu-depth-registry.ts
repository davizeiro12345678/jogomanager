import * as THREE from "three";

/** One renderer owns its depth history. Never share textures across devices
 * or across a WebGPU device-loss/recovery boundary. */
export type WebGpuDepthSnapshot = Readonly<{
  texture: THREE.Texture;
  viewProjection: THREE.Matrix4;
}>;
const snapshots = new WeakMap<object, WebGpuDepthSnapshot>();

export function publishWebGpuDepthSnapshot(
  renderer: object,
  texture: THREE.Texture,
  camera: THREE.Camera,
): void {
  const previous = snapshots.get(renderer);
  if (previous?.texture === texture) {
    previous.viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    return;
  }
  snapshots.set(renderer, {
    texture,
    viewProjection: new THREE.Matrix4().multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse,
    ),
  });
}

export function webGpuDepthSnapshot(renderer: object): WebGpuDepthSnapshot | null {
  return snapshots.get(renderer) ?? null;
}

export function clearWebGpuDepthSnapshot(renderer: object, texture?: THREE.Texture): void {
  if (!texture || snapshots.get(renderer)?.texture === texture) snapshots.delete(renderer);
}

export function projectionsNearlyEqual(
  first: THREE.Matrix4,
  second: THREE.Matrix4,
  epsilon = 0.00001,
): boolean {
  for (let i = 0; i < 16; i++)
    if (Math.abs(first.elements[i]! - second.elements[i]!) > epsilon) return false;
  return true;
}
