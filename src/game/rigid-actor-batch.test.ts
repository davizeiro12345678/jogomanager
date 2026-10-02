import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { batchRigidActors } from "./rigid-actor-batch";
import { censusScene } from "./scene-census";

describe("animated sideline batching", () => {
  it("preserves independent joint movement, parent transforms, colors and triangle counts", () => {
    const root = new THREE.Group();
    root.position.set(7, 0, -11);
    root.rotation.y = 0.4;
    const pivot = new THREE.Group();
    pivot.position.set(2, 1, 0);
    root.add(pivot);
    const first = new THREE.Mesh(
      new THREE.BoxGeometry(),
      new THREE.MeshStandardMaterial({ color: "red" }),
    );
    const second = new THREE.Mesh(
      new THREE.BoxGeometry(),
      new THREE.MeshStandardMaterial({ color: "blue" }),
    );
    second.position.y = 2;
    pivot.add(first, second);
    const before = censusScene(root);
    const batch = batchRigidActors(root);
    expect(batch.meshes).toHaveLength(1);
    expect(censusScene(root).total.triangles).toBe(before.total.triangles);
    const mesh = batch.meshes[0]!;
    const position = mesh.geometry.getAttribute("position");
    const inverse = root.matrixWorld.clone().invert();
    for (const angle of [0, 0.7, -1.2]) {
      pivot.rotation.z = angle;
      second.rotation.x = angle * 0.5;
      batch.sync();
      mesh.updateWorldMatrix(true, false);
      const vertex = new THREE.Vector3().fromBufferAttribute(position, 36);
      mesh.applyBoneTransform(36, vertex);
      const expected = new THREE.Vector3().fromBufferAttribute(
        second.geometry.getAttribute("position"),
        second.geometry.index!.getX(0),
      );
      expected.applyMatrix4(second.matrixWorld).applyMatrix4(inverse);
      expect(vertex.distanceTo(expected)).toBeLessThan(1e-5);
    }
    const color = mesh.geometry.getAttribute("color");
    expect(color.getX(0)).toBe(1);
    expect(color.getZ(36)).toBe(1);
    const sourceDispose = vi.spyOn(first.geometry, "dispose");
    batch.dispose();
    expect(sourceDispose).not.toHaveBeenCalled();
    expect(first.visible).toBe(true);
    expect(censusScene(root).total.triangles).toBe(before.total.triangles);
  });

  it("leaves transparency and textured surfaces intact and keeps shadow groups separate", () => {
    const root = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
      mesh.castShadow = i < 2;
      root.add(mesh);
    }
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(),
      new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.2 }),
    );
    const textured = new THREE.Mesh(
      new THREE.BoxGeometry(),
      new THREE.MeshStandardMaterial({ map: new THREE.Texture() }),
    );
    root.add(glass, textured);
    const batch = batchRigidActors(root);
    expect(batch.meshes).toHaveLength(2);
    expect(batch.sources).toHaveLength(4);
    expect(glass.visible).toBe(true);
    expect(textured.visible).toBe(true);
    expect(batch.meshes.filter((mesh) => mesh.castShadow)).toHaveLength(1);
    batch.dispose();
  });
});
