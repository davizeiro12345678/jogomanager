import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { emptyPose, JOINTS } from "./animation-core";
import { shoulderPose } from "./athlete-posture";
import { refineGoalkeeperAction } from "./goalkeeper-motion";
import { handPoseAt } from "./player-hands";
import { lookFor, proportionsFor } from "./player-model";
import { playerMaterials } from "./player-materials";
import { spineRollForAction, updateRigCorrectives } from "./rig-correctives";
import { buildRigSkin, type RigJoint } from "./rig-skin";

const kit = {
  base: "#ffff00",
  shorts: "#101418",
  socks: "#ffff00",
  detail: "#101418",
  pattern: "solid",
} as const;

function keeper() {
  const look = lookFor("premium-keeper-volume", "GK");
  const P = proportionsFor(look);
  const mats = playerMaterials(look, kit, null, "alta");
  const skin = buildRigSkin(
    {
      P,
      look,
      mats,
      hi: true,
      portrait: false,
      segs: { radial: 16, cap: 4 },
      handR: P.handR * 1.25,
      handMat: mats.glove,
      jerseyInk: "#101418",
    },
    [0, 0, 0],
  );
  skin.root.updateMatrixWorld(true);
  skin.skeleton.update();
  return { skin, mats, P };
}

describe("premium athlete deformation", () => {
  it("keeps the actual overhead and diving vertices inside the match culling bounds", () => {
    const { skin, P } = keeper();
    const meshes = skin.groups.map((group) => {
      const mesh = new THREE.SkinnedMesh(group.geometry, group.material);
      mesh.skeleton = skin.skeleton;
      mesh.bindMatrix.copy(skin.bindMatrix);
      mesh.bindMatrixInverse.copy(skin.bindMatrix).invert();
      return mesh;
    });
    const point = new THREE.Vector3();
    for (const action of ["diveLeft", "diveRight", "saveHigh"]) {
      for (const u of [0, 0.12, 0.28, 0.5, 0.7, 0.88, 1]) {
        const pose = emptyPose();
        refineGoalkeeperAction(pose, action, u);
        const b = skin.boneOf;
        b.hips.position.y = P.hipY + pose.hipY;
        b.hips.rotation.set(pose.hipPitch, pose.hipYaw, pose.hipRoll);
        b.spine.rotation.set(
          pose.spine,
          -pose.hipYaw * 0.45,
          spineRollForAction(pose.hipRoll, action),
        );
        b.chest.rotation.set(pose.chest, -pose.hipYaw * 0.6, 0);
        b.neck.rotation.set(pose.headPitch, pose.headYaw, 0);
        for (const side of ["L", "R"] as const) {
          const shoulder = shoulderPose(pose[`arm${side}Pitch`], pose[`arm${side}Roll`]);
          b[`clav${side}`].rotation.set(shoulder.clavPitch, 0, shoulder.clavRoll);
          b[`arm${side}`].rotation.set(shoulder.armPitch, shoulder.armYaw, shoulder.armRoll);
          b[`fore${side}`].rotation.x = pose[`elbow${side}`];
          b[`leg${side}`].rotation.set(pose[`leg${side}Pitch`], 0, pose[`leg${side}Roll`]);
          b[`knee${side}`].rotation.x = -pose[`knee${side}`];
          b[`ankle${side}`].rotation.x = pose[`ankle${side}`];
        }
        updateRigCorrectives(b);
        skin.root.updateMatrixWorld(true);
        skin.skeleton.update();
        for (const mesh of meshes) {
          const positions = mesh.geometry.getAttribute("position");
          const sphere = mesh.geometry.boundingSphere!;
          let farthest = 0;
          for (let index = 0; index < positions.count; index++) {
            point.fromBufferAttribute(positions, index);
            mesh.applyBoneTransform(index, point);
            farthest = Math.max(farthest, point.distanceTo(sphere.center));
          }
          expect(farthest, `${action} at ${u}`).toBeLessThanOrEqual(sphere.radius);
        }
      }
    }
    skin.dispose();
  });

  it.each([
    ["armL", "shoulderVolumeL", 2.75],
    ["foreL", "elbowVolumeL", 2.1],
    ["kneeL", "kneeVolumeL", 2.1],
  ] as const)(
    "retains the generated %s socket radius under deep flexion",
    (driver: RigJoint, helper: RigJoint, angle: number) => {
      const { skin } = keeper();
      const pivot = skin.boneOf[driver].getWorldPosition(new THREE.Vector3());
      const helperIndex = skin.bones.indexOf(skin.boneOf[helper]);
      const probes: { mesh: THREE.SkinnedMesh; index: number; rest: THREE.Vector3 }[] = [];
      for (const group of skin.groups) {
        const mesh = new THREE.SkinnedMesh(group.geometry, group.material);
        mesh.skeleton = skin.skeleton;
        mesh.bindMatrix.copy(skin.bindMatrix);
        mesh.bindMatrixInverse.copy(skin.bindMatrix).invert();
        const positions = group.geometry.getAttribute("position");
        const indices = group.geometry.getAttribute("skinIndex");
        const weights = group.geometry.getAttribute("skinWeight");
        for (let index = 0; index < positions.count; index++) {
          const rest = new THREE.Vector3().fromBufferAttribute(positions, index).sub(pivot);
          const influenced = [0, 1, 2, 3].some(
            (channel) =>
              indices.getComponent(index, channel) === helperIndex &&
              weights.getComponent(index, channel) > 0.6,
          );
          if (influenced && Math.abs(rest.y) < 0.003 && Math.abs(rest.z) > 0.015)
            probes.push({ mesh, index, rest });
        }
      }
      expect(probes.length).toBeGreaterThan(3);
      skin.boneOf[driver].rotation.x = angle;
      updateRigCorrectives(skin.boneOf);
      skin.root.updateMatrixWorld(true);
      skin.skeleton.update();
      const inverse = skin.boneOf[helper].getWorldQuaternion(new THREE.Quaternion()).invert();
      for (const { mesh, index, rest } of probes) {
        const point = new THREE.Vector3().fromBufferAttribute(
          mesh.geometry.getAttribute("position"),
          index,
        );
        mesh.applyBoneTransform(index, point).sub(pivot).applyQuaternion(inverse);
        expect(Math.abs(point.z / rest.z)).toBeGreaterThan(0.94);
        expect(Math.abs(point.z / rest.z)).toBeLessThan(1.12);
      }
      expect(skin.bones.length).toBeLessThanOrEqual(64);
      expect(skin.groups.length).toBeLessThanOrEqual(24);
      skin.dispose();
    },
  );

  it("gives latex and backhand distinct albedo within the same glove groups", () => {
    const { skin, mats } = keeper();
    const gloves = skin.groups.filter((group) => group.material === mats.glove);
    expect(gloves.length).toBeLessThanOrEqual(2);
    const base = (mats.glove as THREE.MeshStandardMaterial).color;
    let neutralLatex = 0;
    let colouredPanel = 0;
    for (const group of gloves) {
      const colors = group.geometry.getAttribute("color");
      expect(colors.count).toBe(group.geometry.getAttribute("position").count);
      for (let i = 0; i < colors.count; i++) {
        const r = base.r * colors.getX(i),
          g = base.g * colors.getY(i),
          b = base.b * colors.getZ(i);
        expect(Number.isFinite(r + g + b)).toBe(true);
        if (r > 0.65 && g > 0.65 && b > 0.6) neutralLatex++;
        if (colors.getX(i) === 1 && colors.getY(i) === 1 && colors.getZ(i) === 1) colouredPanel++;
      }
    }
    expect(neutralLatex).toBeGreaterThan(30);
    expect(colouredPanel).toBeGreaterThan(30);
    skin.dispose();
  });
});

describe("aerial save choreography", () => {
  it("mirrors the full dive and the leading glove, including scapular yaw", () => {
    for (let frame = 0; frame <= 100; frame++) {
      const u = frame / 100;
      const left = emptyPose(),
        right = emptyPose();
      refineGoalkeeperAction(left, "diveLeft", u);
      refineGoalkeeperAction(right, "diveRight", u);
      expect(left.hipRoll).toBeCloseTo(-right.hipRoll, 6);
      expect(left.hipYaw).toBeCloseTo(-right.hipYaw, 6);
      expect(left.armLPitch).toBeCloseTo(right.armRPitch, 6);
      expect(left.elbowL).toBeCloseTo(right.elbowR, 6);
      expect(left.kneeL).toBeCloseTo(right.kneeR, 6);
      const a = shoulderPose(left.armLPitch, left.armLRoll),
        b = shoulderPose(right.armRPitch, right.armRRoll);
      expect(a.armYaw).toBeCloseTo(-b.armYaw, 6);
      expect(handPoseAt("diveLeft", u, 0, "L")).toEqual(handPoseAt("diveRight", u, 0, "R"));
    }
  });

  it("loads before flight, holds contact, cushions the landing and returns smoothly", () => {
    const sample = (u: number) => {
      const pose = emptyPose();
      refineGoalkeeperAction(pose, "diveLeft", u);
      return pose;
    };
    expect(sample(0.12).hipY).toBeLessThan(-0.09);
    expect(sample(0.5).hipY).toBeGreaterThan(0.35);
    expect(sample(0.5).armLPitch).toBeLessThan(sample(0.5).armRPitch);
    expect(sample(0.5).kneeR).toBeLessThan(sample(0.5).kneeL - 0.35);
    expect(sample(0.75).hipY).toBeLessThan(0);
    expect(Math.abs(sample(0.99).hipRoll)).toBeLessThan(0.005);
    const leader = handPoseAt("diveLeft", 0.5, 0, "L"),
      support = handPoseAt("diveLeft", 0.5, 0, "R");
    expect(leader.spread).toBeGreaterThan(support.spread);
    expect(leader.grip).toBeLessThan(support.grip);
    let previous = sample(0);
    for (let frame = 1; frame <= 200; frame++) {
      const pose = sample(frame / 200);
      for (const joint of JOINTS) {
        expect(Number.isFinite(pose[joint])).toBe(true);
        expect(Math.abs(pose[joint] - previous[joint])).toBeLessThan(0.16);
      }
      previous = pose;
    }
  });
});
