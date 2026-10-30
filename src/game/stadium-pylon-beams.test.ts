import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { createPylonBeamBatch } from "./stadium-pylon-beams";

describe("exterior pylon multi-draw batching", () => {
  it("preserves the four positions and rotations in one draw candidate", () => {
    const batch = createPylonBeamBatch();
    expect(batch.isBatchedMesh).toBe(true);
    expect(batch.maxInstanceCount).toBe(4);
    expect(batch.geometry.getAttribute("position").count).toBeGreaterThan(0);
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    for (const [i, x, z] of [
      [0, -30, -38],
      [1, 30, -38],
      [2, -30, 2],
      [3, 30, 2],
    ] as const) {
      batch.getMatrixAt(i, matrix);
      matrix.decompose(position, rotation, scale);
      expect(position.toArray()).toEqual([x, 20, z]);
      expect(scale.toArray()).toEqual([1, 1, 1]);
      const expected = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(0.35, 0, x > 0 ? -0.3 : 0.3),
      );
      expect(rotation.angleTo(expected)).toBeLessThan(1e-6);
    }
    expect(batch.boundingSphere).not.toBeNull();
    expect((batch.material as THREE.MeshBasicMaterial).transparent).toBe(true);
    batch.geometry.dispose();
    (batch.material as THREE.Material).dispose();
    batch.dispose();
  });
});
