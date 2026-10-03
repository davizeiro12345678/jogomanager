import { expect, it } from "vitest";
import * as THREE from "three";
import { createLowPlayerGeometries } from "./player-lod-geometry";
import { LowTorsoAnimator } from "./player-lod-torso";
import { lookFor, lookWithPhysique, lowDetailBodyFor, proportionsFor } from "./player-model";

it("keeps the shirt hem planted and its collar on the posed chest across physiques", () => {
  const geometries = createLowPlayerGeometries();
  const geometry = geometries["torso"]!;
  const material = new THREE.MeshStandardMaterial();
  const mesh = new THREE.InstancedMesh(geometry, material, 22);
  const animator = new LowTorsoAnimator(geometry);
  mesh.count = 1;
  const positions = geometry.getAttribute("position");
  for (const physique of [
    { height: 160, weight: 55 },
    { height: 185, weight: 80 },
    { height: 205, weight: 110 },
  ]) {
    const p = proportionsFor(lookWithPhysique(lookFor("torso-fit", "MF"), physique));
    const body = lowDetailBodyFor(p);
    const scale = new THREE.Vector3(body.torsoWidth, body.torsoHeight, body.torsoDepth);
    const offset = body.torsoCenterY - p.hipY - p.hipH * 0.5;
    const hinge = new THREE.Vector3(0, p.spineLen - offset, 0);
    for (const pitch of [-0.6, 0, 0.42]) {
      const yaw = 0.45;
      animator.update(mesh, 0, pitch, yaw, hinge.y, scale.x, scale.y, scale.z);
      const weights = mesh.morphTexture!.image.data as Float32Array;
      const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0));
      for (let vertex = 0; vertex < positions.count; vertex++) {
        const bind = new THREE.Vector3().fromBufferAttribute(positions, vertex);
        if (bind.y > -0.12 && bind.y < 0.32) continue;
        const actual = bind.clone();
        geometry.morphAttributes.position!.forEach((target, i) => {
          actual.addScaledVector(
            new THREE.Vector3().fromBufferAttribute(target, vertex),
            weights[i + 1]!,
          );
        });
        actual.multiply(scale);
        const expected = bind.clone().multiply(scale);
        if (bind.y >= 0.32) expected.sub(hinge).applyQuaternion(rotation).add(hinge);
        expect(actual.distanceTo(expected)).toBeLessThan(1e-6);
      }
    }
  }
  expect(mesh.morphTexture!.image.height).toBe(22);
  expect(mesh.count).toBe(1);
  animator.dispose();
  mesh.dispose();
  material.dispose();
  Object.values(geometries).forEach((g) => g.dispose());
});

it("retains independent compacted torso poses in a single instance buffer", () => {
  const geometries = createLowPlayerGeometries();
  const geometry = geometries["torso"]!;
  const material = new THREE.MeshStandardMaterial();
  const mesh = new THREE.InstancedMesh(geometry, material, 22);
  const animator = new LowTorsoAnimator(geometry);
  animator.update(mesh, 0, 0.4, 0.2, 0.03, 0.48, 0.55, 0.29);
  const first = new Float32Array((mesh.morphTexture!.image.data as Float32Array).slice(0, 13));
  animator.update(mesh, 1, -0.3, -0.1, 0.04, 0.42, 0.5, 0.26);
  const data = mesh.morphTexture!.image.data as Float32Array;
  expect(Array.from(data.slice(0, 13))).toEqual(Array.from(first));
  expect(Array.from(data.slice(13, 26))).not.toEqual(Array.from(first));
  expect(Array.from(data).every(Number.isFinite)).toBe(true);
  animator.dispose();
  mesh.dispose();
  material.dispose();
  Object.values(geometries).forEach((g) => g.dispose());
});
