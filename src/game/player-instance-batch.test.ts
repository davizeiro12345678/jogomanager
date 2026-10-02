import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { appendPlayerInstance, capturePlayerPalette } from "./player-instance-batch";

describe("packed distant players", () => {
  it("draws only selected instances and preserves their original colors after roster changes", () => {
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshBasicMaterial();
    const mesh = new THREE.InstancedMesh(geometry, material, 22);
    for (let i = 0; i < 22; i++) mesh.setColorAt(i, new THREE.Color(i / 22, 0.5, 1 - i / 22));
    const palette = capturePlayerPalette(mesh);
    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();
    for (const roster of [[3, 9, 20], [9, 3], [20], []]) {
      mesh.count = 0;
      for (const source of roster) {
        matrix.makeTranslation(source, 0, 0);
        appendPlayerInstance(mesh, palette, source, matrix);
      }
      expect(mesh.count).toBe(roster.length);
      for (let slot = 0; slot < roster.length; slot++) {
        const source = roster[slot]!;
        mesh.getMatrixAt(slot, matrix);
        expect(matrix.elements[12]).toBe(source);
        mesh.getColorAt(slot, color);
        expect(color.r).toBeCloseTo(source / 22);
        expect(color.b).toBeCloseTo(1 - source / 22);
      }
    }
    mesh.dispose();
    geometry.dispose();
    material.dispose();
  });

  it("keeps matrices compact for uncolored shadow batches too", () => {
    const geometry = new THREE.CircleGeometry();
    const material = new THREE.MeshBasicMaterial();
    const mesh = new THREE.InstancedMesh(geometry, material, 22);
    const palette = capturePlayerPalette(mesh);
    mesh.count = 0;
    appendPlayerInstance(mesh, palette, 17, new THREE.Matrix4().makeTranslation(17, 0, 0));
    expect(mesh.count).toBe(1);
    expect(mesh.instanceColor).toBeNull();
    expect(palette.sources[0]).toBe(17);
    mesh.dispose();
    geometry.dispose();
    material.dispose();
  });
});
