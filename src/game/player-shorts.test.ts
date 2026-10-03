import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { lookFor, lookWithPhysique, proportionsFor } from "./player-model";
import { footballShorts } from "./player-shorts";
import { buildRigSkin } from "./rig-skin";
import { playerMaterials } from "./player-materials";
import { kitFor } from "./kits";

describe("tailored player shorts", () => {
  it("contains the outer quadriceps at the split instead of exposing skin triangles", () => {
    for (const weight of [55, 78, 110]) {
      const p = proportionsFor(
        lookWithPhysique(lookFor("shorts-coverage", "MF"), { height: 183, weight }),
      );
      const geometry = footballShorts(p, 16);
      const pos = geometry.getAttribute("position");
      const splitY = -p.hipH * 0.73;
      let outer = 0,
        front = 0;
      for (let i = 0; i < pos.count; i++) {
        if (Math.abs(pos.getY(i) - splitY) < 1e-6) {
          outer = Math.max(outer, Math.abs(pos.getX(i)));
          front = Math.max(front, pos.getZ(i));
        }
      }
      expect(outer).toBeGreaterThan(p.hipW * 0.36 + p.legR * 1.22);
      expect(front).toBeGreaterThan(p.legR * 1.16);
      geometry.dispose();
    }
  });
  it("keeps the waist narrower than the shoulders and hems well above the knee", () => {
    for (const dimensions of [
      { height: 170, weight: 60 },
      { height: 183, weight: 78 },
      { height: 198, weight: 99 },
    ]) {
      const p = proportionsFor(lookWithPhysique(lookFor("shorts-body", "MF"), dimensions));
      const geometry = footballShorts(p);
      geometry.computeBoundingBox();
      const box = geometry.boundingBox!;
      expect(box.max.x - box.min.x).toBeLessThan(p.shoulderW * 1.04 + p.armR * 2.36);
      const legPivot = -p.hipH * 0.4;
      expect((legPivot - box.min.y) / p.thigh).toBeGreaterThan(0.4);
      expect((legPivot - box.min.y) / p.thigh).toBeLessThan(0.6);
      for (const name of ["position", "normal", "uv"]) {
        expect(Array.from(geometry.getAttribute(name).array).every(Number.isFinite)).toBe(true);
      }
      geometry.dispose();
    }
  });

  it("keeps the waistband planted while a hem follows a raised femur", () => {
    const look = lookFor("shorts-flexion", "MF");
    const p = proportionsFor(look);
    const kit = kitFor("fla", "#cc1e32", "#161b21");
    const mats = playerMaterials(look, kit, null, "alta");
    const rig = buildRigSkin(
      {
        P: p,
        look,
        segs: { radial: 16, cap: 4 },
        hi: true,
        mats,
        handR: p.handR,
        handMat: mats.skin,
        jerseyInk: "#fff",
      },
      [0, 0, 0],
    );
    const group = rig.groups.find((g) => g.material === mats.shorts && g.lod === "core")!;
    const mesh = new THREE.SkinnedMesh(group.geometry, group.material);
    mesh.bind(rig.skeleton, rig.bindMatrix);
    rig.root.updateMatrixWorld(true);
    rig.skeleton.update();
    const pos = group.geometry.getAttribute("position");
    let waist = 0,
      hem = 0;
    for (let i = 0; i < pos.count; i++) {
      if (pos.getY(i) > pos.getY(waist)) waist = i;
      if (pos.getX(i) > 0.05 && pos.getY(i) < pos.getY(hem)) hem = i;
    }
    const beforeWaist = mesh.applyBoneTransform(
      waist,
      new THREE.Vector3().fromBufferAttribute(pos, waist),
    );
    const beforeHem = mesh.applyBoneTransform(
      hem,
      new THREE.Vector3().fromBufferAttribute(pos, hem),
    );
    rig.boneOf.legL.rotation.x = -0.9;
    rig.root.updateMatrixWorld(true);
    rig.skeleton.update();
    const afterWaist = mesh.applyBoneTransform(
      waist,
      new THREE.Vector3().fromBufferAttribute(pos, waist),
    );
    const afterHem = mesh.applyBoneTransform(
      hem,
      new THREE.Vector3().fromBufferAttribute(pos, hem),
    );
    expect(afterWaist.distanceTo(beforeWaist)).toBeLessThan(0.002);
    expect(afterHem.distanceTo(beforeHem)).toBeGreaterThan(0.14);
    rig.dispose();
  });

  it("keeps both inner hems on their own femur when the openings cross the centre plane", () => {
    const look = lookFor("shorts-inner-hem", "MF"),
      p = proportionsFor(look),
      mats = playerMaterials(look, kitFor("fla", "#cc1e32", "#161b21"), null, "alta");
    const rig = buildRigSkin(
      {
        P: p,
        look,
        segs: { radial: 16, cap: 4 },
        hi: true,
        mats,
        handR: p.handR,
        handMat: mats.skin,
        jerseyInk: "#fff",
      },
      [0, 0, 0],
    );
    const group = rig.groups.find((g) => g.material === mats.shorts && g.lod === "core")!;
    const mesh = new THREE.SkinnedMesh(group.geometry, group.material);
    mesh.bind(rig.skeleton, rig.bindMatrix);
    rig.root.updateMatrixWorld(true);
    rig.skeleton.update();
    const pos = group.geometry.getAttribute("position"),
      uv = group.geometry.getAttribute("uv");
    const hemY = Math.min(...Array.from({ length: pos.count }, (_, i) => pos.getY(i)));
    let left = -1,
      right = -1;
    for (let i = 0; i < pos.count; i++) {
      if (Math.abs(pos.getY(i) - hemY) > 1e-6) continue;
      if (uv.getX(i) <= 0.5 && pos.getX(i) < 0) left = i;
      if (uv.getX(i) >= 0.5 && pos.getX(i) > 0) right = i;
    }
    expect(left).toBeGreaterThanOrEqual(0);
    expect(right).toBeGreaterThanOrEqual(0);
    const skinPoint = (i: number) =>
      mesh.applyBoneTransform(i, new THREE.Vector3().fromBufferAttribute(pos, i));
    const beforeLeft = skinPoint(left),
      beforeRight = skinPoint(right);
    rig.boneOf.legL.rotation.x = -0.9;
    rig.root.updateMatrixWorld(true);
    rig.skeleton.update();
    expect(skinPoint(left).distanceTo(beforeLeft)).toBeGreaterThan(0.1);
    expect(skinPoint(right).distanceTo(beforeRight)).toBeLessThan(0.002);
    expect(group.geometry.hasAttribute("openingLeg")).toBe(false);
    rig.dispose();
  });
});
