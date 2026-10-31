import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { createPylonBeamBatch } from "./stadium-pylon-beams";
import { censusScene, createNonHeroDrawCounter } from "./scene-census";

describe("exterior pylon multi-draw batching", () => {
  it("attributes every visible BatchedMesh triangle to the scene budget", () => {
    const batch = createPylonBeamBatch();
    const scene = new THREE.Scene();
    scene.add(batch);
    const perConeTriangles = (batch.geometry.index?.count ?? 0) / 3;
    expect(censusScene(scene).total.triangles).toBe(perConeTriangles * 4);
    batch.setVisibleAt(2, false);
    expect(censusScene(scene).total.triangles).toBe(perConeTriangles * 3);
    batch.geometry.dispose();
    (batch.material as THREE.Material).dispose();
    batch.dispose();
  });
  it("reduces the isolated shaft group from four draw candidates to one", () => {
    const geometry = new THREE.ConeGeometry(4.5, 14, 12, 1, true);
    const material = new THREE.MeshBasicMaterial();
    const original = new THREE.Group();
    for (let i = 0; i < 4; i++) original.add(new THREE.Mesh(geometry, material));
    const batched = createPylonBeamBatch();
    const replacement = new THREE.Group();
    replacement.add(batched);
    const count = createNonHeroDrawCounter();
    expect(count(original)).toBe(4);
    expect(count(replacement)).toBe(1);
    expect(batched.sortObjects).toBe(false);
    original.clear();
    replacement.clear();
    geometry.dispose();
    material.dispose();
    batched.geometry.dispose();
    (batched.material as THREE.Material).dispose();
    batched.dispose();
  });
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
      for (const component of scale.toArray()) {
        expect(component).toBeCloseTo(1, 6);
      }
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
