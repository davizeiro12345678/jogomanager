import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { applyHandPose, handPoseAt } from "./player-hands";
import { buildRigSkin } from "./rig-skin";
import { lookFor, proportionsFor } from "./player-model";
import { playerMaterials } from "./player-materials";
import { shoulderPose, refineAthletePosture } from "./athlete-posture";
import { emptyPose } from "./animation-core";
import { solveLegTarget, gaitPoseAt, gaitCadence } from "./gait-kinematics";
import type { Kit } from "./kits";

const kit: Kit = {
  base: "#ad1624",
  shorts: "#fff",
  socks: "#151515",
  detail: "#fff",
  pattern: "solid",
};

describe("articulated athlete hands and shoulders", () => {
  it.each(["MF", "GK"])(
    "curls the actual %s finger vertices while keeping the palm anchored",
    (role) => {
      const look = lookFor(`articulated-hands-${role}`, role);
      const P = proportionsFor(look);
      const mats = playerMaterials(look, kit, null, "alta");
      const skin = buildRigSkin(
        {
          P,
          look,
          mats,
          hi: true,
          segs: { radial: 16, cap: 4 },
          jerseyInk: "#fff",
          handR: P.handR * (look.gloves ? 1.25 : 1),
          handMat: look.gloves ? mats.glove : mats.skin,
        },
        [0, 0, 0],
      );
      const host = new THREE.Group();
      host.add(skin.root);
      host.updateMatrixWorld(true);
      skin.skeleton.update();
      const knuckle = skin.bones.indexOf(skin.boneOf.fingerL1);
      const tip = skin.bones.indexOf(skin.boneOf.fingerTipL1);
      const palm = skin.bones.indexOf(skin.boneOf.handL);
      const probes: {
        mesh: THREE.SkinnedMesh;
        index: number;
        before: THREE.Vector3;
        finger: boolean;
      }[] = [];
      for (const group of skin.groups) {
        const mesh = new THREE.SkinnedMesh(group.geometry, group.material);
        mesh.skeleton = skin.skeleton;
        mesh.bindMatrix.copy(skin.bindMatrix);
        mesh.bindMatrixInverse.copy(skin.bindMatrix).invert();
        const positions = group.geometry.getAttribute("position");
        const indices = group.geometry.getAttribute("skinIndex");
        const weights = group.geometry.getAttribute("skinWeight");
        for (let index = 0; index < positions.count; index++) {
          const finger =
            indices.getX(index) === knuckle &&
            indices.getY(index) === tip &&
            weights.getY(index) > 0.7;
          const anchored = indices.getX(index) === palm && weights.getX(index) === 1;
          if (finger || anchored)
            probes.push({
              mesh,
              index,
              before: mesh.applyBoneTransform(
                index,
                new THREE.Vector3().fromBufferAttribute(positions, index),
              ),
              finger,
            });
        }
      }
      expect(skin.bones.length).toBe(46);
      expect(skin.boneOf.fingerTipL1.parent).toBe(skin.boneOf.fingerL1);
      const restingPalm = skin.boneOf.handL.getWorldPosition(new THREE.Vector3());
      for (let frame = 0; frame < 30; frame++)
        applyHandPose(skin.boneOf, { grip: 0.75, spread: 0.03, wrist: 0 }, 1 / 60);
      host.updateMatrixWorld(true);
      skin.skeleton.update();
      const moved = probes.map(({ mesh, index, before, finger }) => {
        const point = new THREE.Vector3().fromBufferAttribute(
          mesh.geometry.getAttribute("position"),
          index,
        );
        return { distance: mesh.applyBoneTransform(index, point).distanceTo(before), finger };
      });
      expect(Math.max(...moved.filter((p) => p.finger).map((p) => p.distance))).toBeGreaterThan(
        0.012,
      );
      expect(Math.max(...moved.filter((p) => !p.finger).map((p) => p.distance))).toBeLessThan(
        0.00001,
      );
      expect(
        skin.boneOf.handL.getWorldPosition(new THREE.Vector3()).distanceTo(restingPalm),
      ).toBeLessThan(0.000001);
      skin.dispose();
    },
  );

  it("opens for a save, grips after catching and releases the lateral throw", () => {
    expect(handPoseAt("catch", 0.72, 0).grip).toBeGreaterThan(
      handPoseAt("catch", 0.2, 0).grip + 0.4,
    );
    expect(handPoseAt("throwIn", 0.8, 0).grip).toBeLessThan(
      handPoseAt("throwIn", 0.2, 0).grip - 0.3,
    );
    expect(handPoseAt("saveHigh", 0.5, 0).spread).toBeGreaterThan(handPoseAt(null, 0.5, 0).spread);
    expect(handPoseAt(null, 0.5, 8).grip).toBeGreaterThan(handPoseAt(null, 0.5, 0).grip);
  });

  it("uses mirrored upper-chest clavicles for overhead actions without changing arm reach", () => {
    const left = shoulderPose(-2.5, 0.6),
      right = shoulderPose(-2.5, -0.6);
    expect(left.clavPitch).toBeCloseTo(right.clavPitch, 6);
    expect(left.clavRoll).toBeCloseTo(-right.clavRoll, 6);
    expect(left.armPitch + left.clavPitch).toBeCloseTo(-2.5, 6);
    expect(left.armRoll + left.clavRoll).toBeCloseTo(0.6, 6);
    const look = lookFor("shoulder-pivots", "MF"),
      P = proportionsFor(look);
    const mats = playerMaterials(look, kit, null, "alta");
    const skin = buildRigSkin(
      {
        P,
        look,
        mats,
        hi: true,
        segs: { radial: 12, cap: 4 },
        jerseyInk: "#fff",
        handR: P.handR,
        handMat: mats.skin,
      },
      [0, 0, 0],
    );
    expect(skin.boneOf.clavL.position.y).toBeCloseTo(P.chestLen * 0.84, 6);
    expect(skin.boneOf.clavL.position.x + skin.boneOf.armL.position.x).toBeCloseTo(
      P.shoulderW * 0.52,
      6,
    );
    expect(skin.boneOf.foreL.position.y).toBeCloseTo(-P.upperArm, 6);
    skin.dispose();
  });

  it("adds inertial balance consistently while protecting authored action swings", () => {
    const sample = {
      time: 1,
      phase: 0.4,
      speed: 5,
      seed: 12,
      stamina: 85,
      accelerationLean: 0.1,
      turnRate: 1.2,
      hasAction: false,
      defending: false,
    };
    const accelerating = refineAthletePosture(emptyPose(), sample);
    const braking = refineAthletePosture(emptyPose(), { ...sample, accelerationLean: -0.1 });
    expect(accelerating.spine).toBeGreaterThan(braking.spine + 0.1);
    const action = refineAthletePosture(emptyPose(), { ...sample, hasAction: true });
    expect(action.armLPitch).toBe(0);
    expect(action.armRPitch).toBe(0);
    expect(Object.values(accelerating).every(Number.isFinite)).toBe(true);
  });
});

describe("continuous three dimensional strides", () => {
  it("reaches lateral, sagittal and diagonal targets through the actual Three bone rotations", () => {
    for (const lateral of [-0.16, 0, 0.16])
      for (const forward of [-0.22, 0.25]) {
        const leg = solveLegTarget(forward, 0.75, 0.45, 0.43, lateral);
        const end = new THREE.Vector3(0, -0.43, 0).applyEuler(new THREE.Euler(-leg.knee, 0, 0));
        end.y -= 0.45;
        end.applyEuler(new THREE.Euler(leg.pitch, 0, leg.roll));
        expect(end.x).toBeCloseTo(lateral, 6);
        expect(end.y).toBeCloseTo(-0.75, 6);
        expect(end.z).toBeCloseTo(forward, 6);
      }
  });

  it.each([1.6, 5.5, 8])(
    "matches foot velocity across toe-off and heel strike at %s m/s",
    (speed) => {
      const p = proportionsFor(lookFor("smooth-foot-strike", "MF"));
      const duty = 0.64 - Math.min(1, speed / 6.8) * 0.38;
      const cadence = gaitCadence(speed, p.thigh + p.shin);
      const dt = 0.00001;
      const zAt = (cycle: number) => {
        const pose = gaitPoseAt(cycle * Math.PI * 2, speed, p).pose;
        return -p.thigh * Math.sin(pose.legLPitch) - p.shin * Math.sin(pose.legLPitch - pose.kneeL);
      };
      for (const contact of [0, duty]) {
        const incoming = ((zAt(contact) - zAt(contact - dt)) * cadence) / dt;
        const outgoing = ((zAt(contact + dt) - zAt(contact)) * cadence) / dt;
        expect(incoming).toBeCloseTo(-speed, 2);
        expect(outgoing).toBeCloseTo(-speed, 2);
      }
    },
  );
});
