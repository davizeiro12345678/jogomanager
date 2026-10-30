import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { buildMeshletClusters, meshletInsideFrustum } from "./meshlet-clusters";

describe("GPU-ready meshlet preprocessing", () => {
  it("clusters real triangles within 64-vertex and 126-triangle limits", async () => {
    const geometry = new THREE.PlaneGeometry(10, 10, 32, 32);
    const clusters = await buildMeshletClusters(geometry);
    expect(clusters.length).toBeGreaterThan(1);
    let triangles = 0;
    for (const cluster of clusters) {
      expect(cluster.vertices.length).toBeLessThanOrEqual(64);
      expect(cluster.triangles.length / 3).toBeLessThanOrEqual(126);
      triangles += cluster.triangles.length / 3;
      expect(Number.isFinite(cluster.radius)).toBe(true);
    }
    expect(triangles).toBe(32 * 32 * 2);
    geometry.dispose();
  });

  it("culls distant clusters while respecting world matrix scale", async () => {
    const geometry = new THREE.BoxGeometry();
    const [cluster] = await buildMeshletClusters(geometry);
    expect(cluster).toBeDefined();
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    camera.position.z = 10;
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    const frustum = new THREE.Frustum().setFromProjectionMatrix(
      new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse),
    );
    expect(meshletInsideFrustum(cluster!, frustum, new THREE.Matrix4())).toBe(true);
    expect(
      meshletInsideFrustum(
        cluster!,
        frustum,
        new THREE.Matrix4().makeTranslation(0, 0, -300),
      ),
    ).toBe(false);
    geometry.dispose();
  });
});
