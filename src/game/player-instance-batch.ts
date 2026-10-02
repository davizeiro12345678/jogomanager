import type * as THREE from "three";

export type PlayerInstancePalette = {
  colors: Float32Array | null;
  sources: Int16Array;
};

/** Capture player colors before their original slots become compacted slots. */
export function capturePlayerPalette(mesh: THREE.InstancedMesh): PlayerInstancePalette {
  return {
    colors: mesh.instanceColor ? new Float32Array(mesh.instanceColor.array) : null,
    sources: new Int16Array(mesh.instanceMatrix.count).fill(-1),
  };
}

/** Append only a visible surface. count is reset before painting each frame;
 * unused hair/sock families and detailed players never reach the GPU. */
export function appendPlayerInstance(
  mesh: THREE.InstancedMesh,
  palette: PlayerInstancePalette,
  source: number,
  matrix: THREE.Matrix4,
) {
  const slot = mesh.count++;
  mesh.setMatrixAt(slot, matrix);
  if (palette.sources[slot] === source) return;
  palette.sources[slot] = source;
  if (palette.colors && mesh.instanceColor) {
    const offset = source * 3;
    mesh.instanceColor.setXYZ(
      slot,
      palette.colors[offset]!,
      palette.colors[offset + 1]!,
      palette.colors[offset + 2]!,
    );
    mesh.instanceColor.needsUpdate = true;
  }
}
