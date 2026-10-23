import { expect, it } from "vitest";
import * as THREE from "three";
import { buildLockerFrame } from "./locker-room-geometry";

it("leaves an actual open recess for the shirt while retaining solid cabinet sides", () => {
  const geometry = buildLockerFrame();
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const frame = new THREE.Mesh(geometry, material);
  frame.updateMatrixWorld();
  const ray = new THREE.Raycaster(new THREE.Vector3(0, 0, 2), new THREE.Vector3(0, 0, -1));
  expect(ray.intersectObject(frame)).toHaveLength(0);
  ray.ray.origin.x = 0.66;
  expect(ray.intersectObject(frame).length).toBeGreaterThan(0);
  geometry.computeBoundingBox();
  expect(geometry.boundingBox!.min.z).toBeCloseTo(-0.31);
  expect(geometry.boundingBox!.max.z).toBeCloseTo(0.31);
  expect(geometry.getAttribute("position").array.every(Number.isFinite)).toBe(true);
  // Recess geometry is a small static resource, shared by the nine existing cabinets.
  expect(geometry.getAttribute("position").count).toBeLessThanOrEqual(120);
  geometry.dispose();
  material.dispose();
});
