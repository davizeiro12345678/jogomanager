import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { buildPuddleInstanceMatrices, PUDDLE_COUNT, PUDDLE_HEIGHT } from "./puddle-instance-data";

// Fixed original layout: guards RNG arithmetic, call order, axis scales and
// altitude when the separate meshes move to one instance buffer.
const ORIGINAL = [
  [-45.192183474, -32.25255415, 0.933135253, 0.855577862],
  [-24.524473596, 2.415547625, 1.286637533, 0.864844334],
  [8.860863296, 7.132453603, 1.9604895, 0.668907559],
  [-27.640900065, -13.933072588, 1.15272916, 0.525300688],
  [-26.558102992, 32.27899577, 1.087283552, 1.058200848],
  [-7.547369401, 4.728041523, 0.849840963, 0.887950747],
  [29.842839487, -0.958325586, 1.850463945, 0.625234169],
  [32.058394202, -21.517317981, 0.736250521, 0.632008657],
  [-21.910893144, -25.550201282, 0.698383425, 0.636441159],
  [36.858639877, -2.050077329, 1.521568561, 1.15921948],
  [-39.755984182, 32.237131644, 1.507568121, 0.645759726],
  [36.672900479, 25.607777241, 0.553782034, 1.292238404],
] as const;

describe("instanced reflective puddles", () => {
  it("preserves all twelve original seeded ellipses and their horizontal plane", () => {
    const matrices = buildPuddleInstanceMatrices(52.5, 34);
    expect(matrices).toHaveLength(PUDDLE_COUNT * 16);
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const normal = new THREE.Vector3();
    for (let index = 0; index < PUDDLE_COUNT; index++) {
      matrix.fromArray(matrices, index * 16);
      matrix.decompose(position, rotation, scale);
      const [x, z, rx, rz] = ORIGINAL[index]!;
      expect(position.x).toBeCloseTo(x, 5);
      expect(position.z).toBeCloseTo(z, 5);
      expect(position.y).toBeCloseTo(PUDDLE_HEIGHT, 8);
      expect(scale.x).toBeCloseTo(rx, 6);
      expect(scale.y).toBeCloseTo(rz, 6);
      expect(scale.z).toBeCloseTo(1, 6);
      normal.set(0, 0, 1).transformDirection(matrix);
      expect(normal.distanceTo(new THREE.Vector3(0, 1, 0))).toBeLessThan(1e-6);
    }
    expect(buildPuddleInstanceMatrices(52.5, 34)).toEqual(matrices);
  });

  it("keeps the ellipse bounds disjoint so instance order cannot change puddle blending", () => {
    const matrices = buildPuddleInstanceMatrices(52.5, 34);
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const bounds = Array.from({ length: PUDDLE_COUNT }, (_, index) => {
      matrix.fromArray(matrices, index * 16);
      matrix.decompose(position, rotation, scale);
      return { x: position.x, z: position.z, radius: Math.max(scale.x, scale.y) };
    });
    for (let left = 0; left < bounds.length; left++)
      for (let right = left + 1; right < bounds.length; right++) {
        const a = bounds[left]!;
        const b = bounds[right]!;
        expect(Math.hypot(a.x - b.x, a.z - b.z) - a.radius - b.radius).toBeGreaterThan(3.72);
      }
  });
});
