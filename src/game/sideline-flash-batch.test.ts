import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { SidelineFlashBatch } from "./sideline-flash-batch";

describe("photographer flash uploads", () => {
  it("skips idle matrices and uploads while preserving flash placement and decay", () => {
    const mesh = new THREE.InstancedMesh(
      new THREE.SphereGeometry(),
      new THREE.MeshBasicMaterial(),
      2,
    );
    const batch = new SidelineFlashBatch(2);
    const flashes = [
      { x: 54, z: -4.2, heat: 0 },
      { x: -54, z: 4.2, heat: 0 },
    ];
    const write = vi.spyOn(mesh, "setMatrixAt");
    batch.paint(mesh, flashes);
    expect(mesh.visible).toBe(false);
    expect(mesh.instanceMatrix.usage).toBe(THREE.DynamicDrawUsage);
    const idleVersion = mesh.instanceMatrix.version;
    write.mockClear();
    for (let frame = 0; frame < 120; frame++) batch.paint(mesh, flashes);
    expect(write).not.toHaveBeenCalled();
    expect(mesh.instanceMatrix.version).toBe(idleVersion);

    const matrix = new THREE.Matrix4();
    for (const heat of [1, 0.55, 0.1, 0]) {
      flashes[1]!.heat = heat;
      write.mockClear();
      const version = mesh.instanceMatrix.version;
      batch.paint(mesh, flashes);
      expect(write).toHaveBeenCalledOnce();
      expect(mesh.instanceMatrix.version).toBe(version + 1);
      expect(mesh.visible).toBe(heat > 0);
      mesh.getMatrixAt(1, matrix);
      expect(matrix.elements[12]).toBe(-54);
      expect(matrix.elements[13]).toBe(1);
      expect(matrix.elements[14]).toBeCloseTo(4.2);
      expect(matrix.elements[0]).toBeCloseTo(Math.max(0.0001, heat * 1.6));
    }
    const expiredVersion = mesh.instanceMatrix.version;
    batch.paint(mesh, flashes);
    expect(mesh.instanceMatrix.version).toBe(expiredVersion);
    mesh.dispose();
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();
  });

  it("repaints a replacement mesh and preserves simultaneous flashes", () => {
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshBasicMaterial();
    const first = new THREE.InstancedMesh(geometry, material, 2);
    const replacement = new THREE.InstancedMesh(geometry, material, 2);
    const batch = new SidelineFlashBatch(2);
    const flashes = [
      { x: 2, z: 3, heat: 0.6 },
      { x: -2, z: -3, heat: 1 },
    ];
    batch.paint(first, flashes);
    batch.paint(replacement, flashes);
    expect(Array.from(replacement.instanceMatrix.array)).toEqual(
      Array.from(first.instanceMatrix.array),
    );
    flashes[0]!.heat = 0;
    batch.paint(replacement, flashes);
    expect(replacement.visible).toBe(true);
    flashes[1]!.heat = 0;
    batch.paint(replacement, flashes);
    expect(replacement.visible).toBe(false);
    first.dispose();
    replacement.dispose();
    geometry.dispose();
    material.dispose();
  });
});
