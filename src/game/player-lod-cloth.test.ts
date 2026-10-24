import { expect, it } from "vitest";
import * as THREE from "three";
import { createLowPlayerGeometries } from "./player-lod-geometry";
import { LowTorsoAnimator } from "./player-lod-torso";
import { LowShortsAnimator } from "./player-lod-shorts";
import {
  applyLowClothShader,
  supportsAffinePlayerCloth,
  type LowClothKind,
} from "./player-lod-cloth";
import { applyLowKitShader } from "./player-lod-kit";
import { emptyPose } from "./animation-core";

it("keeps the native route on the measured Iris Xe driver and unsupported renderers", () => {
  expect(supportsAffinePlayerCloth("ANGLE (Intel, Intel(R) Iris(R) Xe Graphics)", 16)).toBe(false);
  expect(supportsAffinePlayerCloth("ANGLE (Google, Vulkan SwiftShader)", 16)).toBe(false);
  expect(supportsAffinePlayerCloth("", 16)).toBe(false);
  expect(supportsAffinePlayerCloth("NVIDIA GeForce", 8)).toBe(false);
  expect(supportsAffinePlayerCloth("NVIDIA GeForce", 16)).toBe(true);
});

function packedWeights(geometry: THREE.BufferGeometry, instance: number, kind: LowClothKind) {
  const weights: number[] = [];
  for (let column = 0; column < (kind === "torso" ? 3 : 6); column++) {
    const a = geometry.getAttribute(`lowCloth${column}`);
    weights.push(a.getX(instance), a.getY(instance), a.getZ(instance));
  }
  if (kind === "torso")
    for (let column = 0; column < 3; column++)
      weights.push(geometry.getAttribute(`lowCloth${column}`).getW(instance));
  return weights;
}

it("retains native cloth coefficients and vertices across body scales and compacted instances", () => {
  const native = createLowPlayerGeometries(true);
  const affine = createLowPlayerGeometries(true, true);
  for (const [name, kind] of [
    ["torso", "torso"],
    ["hips", "shorts"],
  ] as const) {
    const a = affine[name]!,
      n = native[name]!;
    const material = new THREE.MeshStandardMaterial();
    const nativeMesh = new THREE.InstancedMesh(n, material, 22);
    const affineMesh = new THREE.InstancedMesh(a, material, 22);
    const nativeAnimator = kind === "torso" ? new LowTorsoAnimator(n) : new LowShortsAnimator(n);
    const affineAnimator = kind === "torso" ? new LowTorsoAnimator(a) : new LowShortsAnimator(a);
    for (let instance = 0; instance < 3; instance++) {
      const sx = 0.24 + instance * 0.05,
        sy = 0.13 + instance * 0.02,
        sz = 0.25 + instance * 0.04;
      const pose = { ...emptyPose(), legLPitch: -0.8, legLRoll: 0.18, legRPitch: 0.33 };
      for (const [animator, mesh] of [
        [nativeAnimator, nativeMesh],
        [affineAnimator, affineMesh],
      ] as const) {
        if (animator instanceof LowTorsoAnimator)
          animator.update(mesh, instance, 0.32, -0.24, 0.035, sx, sy, sz);
        else animator.update(mesh, instance, pose, sx, sy, sz);
      }
      const weights = packedWeights(a, instance, kind);
      const targetCount = kind === "torso" ? 12 : 18;
      const stored = nativeMesh.morphTexture!.image.data as Float32Array;
      for (let i = 0; i < targetCount; i++)
        expect(weights[i]).toBeCloseTo(stored[instance * (targetCount + 1) + i + 1]!, 6);
      expect(a.getAttribute("position").array).toEqual(n.getAttribute("position").array);
      expect(a.morphAttributes.position).toBeUndefined();
      expect(a.morphAttributes.normal).toBeUndefined();
      expect(affineMesh.morphTexture).toBeNull();
    }
    nativeAnimator.dispose();
    affineAnimator.dispose();
    nativeMesh.dispose();
    affineMesh.dispose();
    material.dispose();
  }
  Object.values(native).forEach((g) => g.dispose());
  Object.values(affine).forEach((g) => g.dispose());
});

it("composes cloth with club patterns and leaves the native renderer path available", () => {
  for (const kind of ["torso", "shorts"] as const) {
    const material = new THREE.MeshStandardMaterial();
    if (kind === "torso") applyLowKitShader(material);
    applyLowClothShader(material, kind);
    const shader = {
      uniforms: {},
      vertexShader: THREE.ShaderLib.standard.vertexShader,
      fragmentShader: THREE.ShaderLib.standard.fragmentShader,
    };
    material.onBeforeCompile(
      shader as Parameters<typeof material.onBeforeCompile>[0],
      {} as THREE.WebGLRenderer,
    );
    expect(shader.vertexShader).toContain("lowClothNormal");
    expect(shader.vertexShader).toContain("transformed += clothWeight");
    expect(material.customProgramCacheKey()).toContain(`affine-cloth-${kind}`);
    if (kind === "torso") expect(shader.fragmentShader).toContain("vLowKit");
    material.dispose();
  }
});
