import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { emptyPose } from "./animation-core";
import { LowShortsAnimator, lowShortsGeometry } from "./player-lod-shorts";
import { lookFor, lookWithPhysique, proportionsFor } from "./player-model";

function morphedVertex(mesh: THREE.InstancedMesh, instance: number, vertex: number) {
  const geometry = mesh.geometry;
  const result = new THREE.Vector3().fromBufferAttribute(geometry.getAttribute("position"), vertex);
  const targets = geometry.morphAttributes.position!;
  const data = mesh.morphTexture!.image.data as Float32Array;
  for (let target = 0; target < targets.length; target++)
    result.addScaledVector(
      new THREE.Vector3().fromBufferAttribute(targets[target]!, vertex),
      data[instance * 19 + target + 1]!,
    );
  return result;
}

describe("continuous instanced player shorts", () => {
  it("keeps crossed inner hems attached to their own femur in the actual instanced morph buffer", () => {
    const geometry = lowShortsGeometry(),
      material = new THREE.MeshStandardMaterial();
    const mesh = new THREE.InstancedMesh(geometry, material, 1),
      animator = new LowShortsAnimator(geometry);
    const p = proportionsFor(lookFor("crossed-inner-hem", "MF"));
    const scale = new THREE.Vector3(p.hipW, p.hipH, p.chestD / 0.47);
    const position = geometry.getAttribute("position"),
      uv = geometry.getAttribute("uv");
    const hemY = Math.min(...Array.from({ length: position.count }, (_, i) => position.getY(i)));
    let left = -1,
      right = -1;
    for (let i = 0; i < position.count; i++) {
      if (Math.abs(position.getY(i) - hemY) > 1e-6) continue;
      if (uv.getX(i) < 0.5 && position.getX(i) < 0) left = i;
      if (uv.getX(i) > 0.5 && position.getX(i) > 0) right = i;
    }
    try {
      expect(left).toBeGreaterThanOrEqual(0);
      expect(right).toBeGreaterThanOrEqual(0);
      animator.update(mesh, 0, emptyPose(), scale.x, scale.y, scale.z);
      const beforeL = morphedVertex(mesh, 0, left).multiply(scale),
        beforeR = morphedVertex(mesh, 0, right).multiply(scale);
      animator.update(
        mesh,
        0,
        { ...emptyPose(), legLPitch: -0.9, legLRoll: -0.35 },
        scale.x,
        scale.y,
        scale.z,
      );
      expect(morphedVertex(mesh, 0, left).multiply(scale).distanceTo(beforeL)).toBeGreaterThan(
        0.08,
      );
      expect(morphedVertex(mesh, 0, right).multiply(scale).distanceTo(beforeR)).toBeLessThan(0.002);
    } finally {
      animator.dispose();
      mesh.dispose();
      geometry.dispose();
      material.dispose();
    }
  });

  it("matches weighted femur movement across different physiques without moving the waistband", () => {
    const geometry = lowShortsGeometry();
    const material = new THREE.MeshStandardMaterial();
    const mesh = new THREE.InstancedMesh(geometry, material, 22);
    const animator = new LowShortsAnimator(geometry);
    const position = geometry.getAttribute("position");
    for (const dimensions of [
      { height: 160, weight: 55 },
      { height: 184, weight: 78 },
      { height: 205, weight: 110 },
    ]) {
      const p = proportionsFor(lookWithPhysique(lookFor("low-shorts-fit", "MF"), dimensions));
      const scale = new THREE.Vector3(p.hipW, p.hipH, p.chestD / 0.47);
      for (const pitch of [0, -0.9, -1.62]) {
        const pose = { ...emptyPose(), legLPitch: pitch, legLRoll: 0.16, legRPitch: -pitch * 0.4 };
        animator.update(mesh, 0, pose, scale.x, scale.y, scale.z);
        const left = new THREE.Quaternion().setFromEuler(
          new THREE.Euler(pose.legLPitch, 0, pose.legLRoll),
        );
        const right = new THREE.Quaternion().setFromEuler(
          new THREE.Euler(pose.legRPitch, 0, pose.legRRoll),
        );
        for (let vertex = 0; vertex < position.count; vertex++) {
          const bind = new THREE.Vector3().fromBufferAttribute(position, vertex).multiply(scale);
          const weight = 1 - THREE.MathUtils.smoothstep(bind.y, -0.85 * p.hipH, 0.1 * p.hipH);
          const owner = geometry.getAttribute("openingLeg").getX(vertex);
          const leftWeight = owner
            ? owner > 0
              ? 1
              : 0
            : THREE.MathUtils.smoothstep(bind.x, -0.12 * p.hipW, 0.12 * p.hipW);
          const pivotL = new THREE.Vector3(0.36 * p.hipW, -0.4 * p.hipH, 0);
          const pivotR = new THREE.Vector3(-0.36 * p.hipW, -0.4 * p.hipH, 0);
          const onLeft = bind.clone().sub(pivotL).applyQuaternion(left).add(pivotL);
          const onRight = bind.clone().sub(pivotR).applyQuaternion(right).add(pivotR);
          const expected = bind
            .clone()
            .multiplyScalar(1 - weight)
            .addScaledVector(onLeft, weight * leftWeight)
            .addScaledVector(onRight, weight * (1 - leftWeight));
          const actual = morphedVertex(mesh, 0, vertex).multiply(scale);
          expect(actual.distanceTo(expected)).toBeLessThan(1e-6);
          if (bind.y > p.hipH * 0.1) expect(actual.distanceTo(bind)).toBeLessThan(1e-6);
        }
      }
    }
    animator.dispose();
    mesh.dispose();
    material.dispose();
    geometry.dispose();
  });

  it("allocates the full team capacity while compacting visible players and keeps their poses independent", () => {
    const geometry = lowShortsGeometry();
    const material = new THREE.MeshStandardMaterial();
    const mesh = new THREE.InstancedMesh(geometry, material, 22);
    mesh.count = 1;
    const animator = new LowShortsAnimator(geometry);
    animator.update(mesh, 0, { ...emptyPose(), legLPitch: -0.9 }, 0.26, 0.14, 0.27);
    expect(mesh.count).toBe(1);
    expect(mesh.morphTexture!.image.height).toBe(22);
    const before = new Float32Array((mesh.morphTexture!.image.data as Float32Array).slice(0, 19));
    mesh.count = 2;
    animator.update(mesh, 1, { ...emptyPose(), legRPitch: -1.1 }, 0.3, 0.16, 0.3);
    const data = mesh.morphTexture!.image.data as Float32Array;
    expect(Array.from(data.slice(0, 19))).toEqual(Array.from(before));
    expect(Array.from(data.slice(19, 38))).not.toEqual(Array.from(before));
    expect(Array.from(data).every(Number.isFinite)).toBe(true);
    animator.dispose();
    mesh.dispose();
    material.dispose();
    geometry.dispose();
  });
});
