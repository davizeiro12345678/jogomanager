import * as THREE from "three";

/**
 * A single multi-draw batch replaces four transparent, identical exterior
 * light cones. Matrices are immutable and uploaded only during construction.
 * Keeping a single geometry/material also avoids four material programs.
 *
 * This is intentionally NOT used for skinned players or per-frame dynamic
 * objects: BatchedMesh does not preserve skinned motion by itself.
 */
export function createPylonBeamBatch(): THREE.BatchedMesh {
  const source = new THREE.ConeGeometry(4.5, 14, 12, 1, true);
  const material = new THREE.MeshBasicMaterial({
    color: "#dcebff",
    transparent: true,
    opacity: 0.1,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const vertices = source.getAttribute("position").count;
  const indices = source.getIndex()?.count ?? 0;
  const batch = new THREE.BatchedMesh(4, vertices, indices, material);
  const geometryId = batch.addGeometry(source);
  source.dispose();
  const pose = new THREE.Object3D();
  for (const [x, z] of [
    [-30, -38],
    [30, -38],
    [-30, 2],
    [30, 2],
  ] as const) {
    pose.position.set(x, 20, z);
    pose.rotation.set(0.35, 0, x > 0 ? -0.3 : 0.3);
    pose.updateMatrix();
    const id = batch.addInstance(geometryId);
    batch.setMatrixAt(id, pose.matrix);
  }
  // These four isolated light shafts do not overlap. Disabling per-instance
  // transparency sorting allows the renderer to group identical geometry
  // ranges into one draw instead of splitting them by depth.
  batch.sortObjects = false;
  batch.computeBoundingSphere();
  batch.name = "exterior-pylon-beams";
  return batch;
}
