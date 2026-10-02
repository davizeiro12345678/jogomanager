import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { buildRigSkin } from "./rig-skin";
import { CORRECTIVE_DRIVERS, spineRollForAction, updateRigCorrectives } from "./rig-correctives";
import { lookFor, proportionsFor } from "./player-model";
import { playerMaterials } from "./player-materials";

const kit = {
  base: "#ffff00",
  shorts: "#101418",
  socks: "#ffff00",
  detail: "#101418",
  pattern: "solid",
} as const;
function rig() {
  const look = lookFor("keeper-correctives", "GK");
  const p = proportionsFor(look);
  const mats = playerMaterials(look, kit, null, "alta");
  return buildRigSkin(
    {
      P: p,
      look,
      mats,
      segs: { radial: 12, cap: 4 },
      hi: true,
      handR: p.handR * 1.25,
      handMat: mats.glove,
      jerseyInk: "#101418",
    },
    [0, 0, 0],
  );
}

describe("joint volume correction", () => {
  it("spreads pronation through weighted forearm bones without turning the elbow", () => {
    const skin = rig();
    skin.boneOf.handL.rotation.set(0, 1.2, 0);
    updateRigCorrectives(skin.boneOf);
    expect(skin.boneOf.forearmTwistL.parent).toBe(skin.boneOf.foreL);
    expect(skin.boneOf.forearmTwistL.rotation.y).toBeCloseTo(1.2 * 0.82, 6);
    expect(skin.boneOf.foreL.quaternion.angleTo(new THREE.Quaternion())).toBe(0);
    expect(skin.boneOf.forearmTwistR.quaternion.angleTo(new THREE.Quaternion())).toBe(0);
    let influenced = 0;
    const twistIndex = skin.bones.indexOf(skin.boneOf.forearmTwistL);
    for (const group of skin.groups) {
      const indices = group.geometry.getAttribute("skinIndex");
      const weights = group.geometry.getAttribute("skinWeight");
      for (let i = 0; i < indices.count; i++)
        for (let c = 0; c < 4; c++)
          if (indices.getComponent(i, c) === twistIndex && weights.getComponent(i, c) > 0.1)
            influenced++;
    }
    expect(influenced).toBeGreaterThan(30);
    skin.boneOf.handL.rotation.set(1.1, 0, 0);
    updateRigCorrectives(skin.boneOf);
    expect(skin.boneOf.forearmTwistL.quaternion.angleTo(new THREE.Quaternion())).toBeCloseTo(0, 6);
    expect(skin.bones.length).toBeLessThanOrEqual(64);
    skin.dispose();
  });
  it("binds all corrective sockets at their driver pivot and weights actual surfaces to them", () => {
    const skin = rig();
    const counts = new Map<string, number>();
    for (const group of skin.groups) {
      const indices = group.geometry.getAttribute("skinIndex");
      const weights = group.geometry.getAttribute("skinWeight");
      for (let v = 0; v < weights.count; v++) {
        let sum = 0;
        for (let c = 0; c < 4; c++) {
          const w = weights.getComponent(v, c);
          expect(w).toBeGreaterThanOrEqual(0);
          sum += w;
          if (w > 0.04) {
            const name = skin.bones[indices.getComponent(v, c)]!.name;
            counts.set(name, (counts.get(name) ?? 0) + 1);
          }
        }
        expect(sum).toBeCloseTo(1, 5);
      }
    }
    for (const { joint, driver } of CORRECTIVE_DRIVERS) {
      expect(skin.boneOf[joint].parent).toBe(skin.boneOf[driver].parent);
      expect(skin.boneOf[joint].position.distanceTo(skin.boneOf[driver].position)).toBe(0);
      expect(counts.get(joint) ?? 0).toBeGreaterThan(5);
    }
    skin.skeleton.computeBoneTexture();
    expect(skin.skeleton.boneTexture!.image.width).toBe(16);
    expect(skin.skeleton.boneTexture!.image.height).toBe(16);
    skin.dispose();
  });

  it("retains elbow cross-section at 120 degree flexion without changing geometry or the opposite limb", () => {
    const skin = rig();
    const original = skin.groups.map((group) =>
      Array.from(group.geometry.getAttribute("position").array),
    );
    skin.boneOf.foreL.rotation.x = (Math.PI * 2) / 3;
    updateRigCorrectives(skin.boneOf);
    const helper = skin.boneOf.elbowVolumeL;
    expect(helper.quaternion.angleTo(new THREE.Quaternion())).toBeCloseTo(Math.PI / 3, 6);
    expect(skin.boneOf.elbowVolumeR.quaternion.angleTo(new THREE.Quaternion())).toBe(0);
    const radial = new THREE.Vector3(0, 0, 1);
    const linear = radial
      .clone()
      .multiplyScalar(0.5)
      .addScaledVector(radial.clone().applyQuaternion(skin.boneOf.foreL.quaternion), 0.5);
    const corrected = radial
      .clone()
      .multiplyScalar(0.15)
      .addScaledVector(radial.clone().applyQuaternion(skin.boneOf.foreL.quaternion), 0.15)
      .addScaledVector(
        radial.clone().multiply(helper.scale).applyQuaternion(helper.quaternion),
        0.7,
      );
    expect(linear.length()).toBeCloseTo(0.5, 6);
    expect(corrected.length()).toBeGreaterThan(0.89);
    expect(corrected.length()).toBeLessThan(1.06);
    skin.groups.forEach((group, index) =>
      expect(Array.from(group.geometry.getAttribute("position").array)).toEqual(original[index]),
    );
    skin.dispose();
  });

  it("retains the dive's line of action while other clips preserve their spine balance", () => {
    expect(spineRollForAction(1.33, "diveLeft")).toBeCloseTo(-1.33 * 0.14);
    expect(spineRollForAction(-1.33, "diveRight")).toBeCloseTo(1.33 * 0.14);
    expect(spineRollForAction(0.3, "shotPower")).toBeCloseTo(-0.105);
  });
});
