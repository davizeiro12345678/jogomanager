import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import {
  WeatherInstanceTransforms,
  writeWeatherInstancePosition,
} from "./weather-instance-transforms";

describe("weather particle matrices", () => {
  it("preserves Object3D transforms across movement, wind changes, rain and snow", () => {
    const geometry = new THREE.PlaneGeometry();
    const material = new THREE.MeshBasicMaterial();
    const mesh = new THREE.InstancedMesh(geometry, material, 3);
    const batch = new WeatherInstanceTransforms();
    const reference = new THREE.Object3D();
    const positions = [
      { x: -37.45, y: 34.1, z: 42.7 },
      { x: 0, y: 0.0003, z: -0.125 },
      { x: 61.8, y: 6.9, z: -55.3 },
    ];
    for (const [rain, wind] of [
      [true, 0.4],
      [true, -1.2],
      [false, -1.2],
      [false, 0.7],
      [true, 0],
    ] as const) {
      const array = batch.prepare(mesh, rain, wind);
      for (let frame = 0; frame < 5; frame++) {
        for (let index = 0; index < positions.length; index++) {
          const p = positions[index]!;
          const x = p.x + frame * 0.025;
          const y = p.y - frame * 0.12;
          const z = p.z + frame * 0.014;
          writeWeatherInstancePosition(array, index, x, y, z);
          reference.position.set(x, y, z);
          reference.rotation.set(0, 0, rain ? wind * 0.28 : 0);
          reference.scale.set(1, rain ? 1 : 0.5, 1);
          reference.updateMatrix();
          expect(Array.from(array.subarray(index * 16, index * 16 + 16))).toEqual(
            Array.from(new Float32Array(reference.matrix.elements)),
          );
        }
      }
    }
    mesh.dispose();
    geometry.dispose();
    material.dispose();
  });

  it("composes a shared basis once, retains translations and initializes replacement meshes", () => {
    const geometry = new THREE.PlaneGeometry();
    const material = new THREE.MeshBasicMaterial();
    const mesh = new THREE.InstancedMesh(geometry, material, 2);
    const replacement = new THREE.InstancedMesh(geometry, material, 4);
    const batch = new WeatherInstanceTransforms();
    const compose = vi.spyOn(THREE.Object3D.prototype, "updateMatrix");
    const array = batch.prepare(mesh, true, 0.3);
    writeWeatherInstancePosition(array, 1, 4, 5, 6);
    const initialVersion = mesh.instanceMatrix.version;
    for (let frame = 0; frame < 120; frame++) batch.prepare(mesh, true, 0.3);
    expect(compose).toHaveBeenCalledOnce();
    expect(mesh.instanceMatrix.version).toBe(initialVersion);
    batch.prepare(mesh, true, 0.9);
    expect(Array.from(array.subarray(28, 31))).toEqual([4, 5, 6]);
    expect(compose).toHaveBeenCalledTimes(2);
    const fresh = batch.prepare(replacement, false, 0.9);
    for (let index = 0; index < 4; index++) {
      const offset = index * 16;
      expect(fresh[offset]).toBe(1);
      expect(fresh[offset + 5]).toBe(0.5);
      expect(fresh[offset + 10]).toBe(1);
      expect(fresh[offset + 15]).toBe(1);
    }
    expect(replacement.instanceMatrix.usage).toBe(THREE.DynamicDrawUsage);
    compose.mockRestore();
    mesh.dispose();
    replacement.dispose();
    geometry.dispose();
    material.dispose();
  });
});
