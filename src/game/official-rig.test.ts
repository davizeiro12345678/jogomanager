import { expect, it, vi } from "vitest";
import * as THREE from "three";
import { applyOfficialLegPose, assistantFlagGeometry, buildOfficialRig } from "./official-rig";
import { gaitPoseAt } from "./gait-kinematics";
import { clampPoseAnatomy, soleHeightFor, solveGroundContact } from "./ground-contact";
import { SOLE_CONTACT_PROFILE } from "./boot-profile";

it("retains every material surface in three core draws without incompatible geometry attributes", () => {
  const errors = vi.spyOn(console, "error");
  for (const role of ["ref", "ar1", "ar2"] as const) {
    const { skin, materials } = buildOfficialRig(role, "#c52613", "#0a6b3c");
    const core = skin.groups.filter((group) => group.lod === "core");
    expect(core).toHaveLength(3);
    expect(new Set(core.map((group) => group.material))).toEqual(new Set(materials));
    expect(skin.groups.some((group) => group.lod === "near")).toBe(true);
    for (const group of skin.groups) {
      expect(group.geometry.index!.count).toBeGreaterThan(0);
      expect(Array.from(group.geometry.getAttribute("position").array).every(Number.isFinite)).toBe(
        true,
      );
      const weight = group.geometry.getAttribute("skinWeight");
      for (let i = 0; i < weight.count; i++) {
        expect(weight.getX(i) + weight.getY(i) + weight.getZ(i) + weight.getW(i)).toBeCloseTo(1);
      }
    }
    skin.dispose();
    materials.forEach((material) => material.dispose());
  }
  expect(errors).not.toHaveBeenCalled();
  errors.mockRestore();
});

it("keeps the assistant's checked flag in eight triangles without a texture", () => {
  const geometry = assistantFlagGeometry();
  expect(geometry.groups).toHaveLength(0);
  expect(geometry.getAttribute("position").count / 3).toBe(8);
  const colors = geometry.getAttribute("color");
  const colorAt = (i: number) => [colors.getX(i), colors.getY(i), colors.getZ(i)];
  expect(colorAt(0)).toEqual(colorAt(18));
  expect(colorAt(6)).toEqual(colorAt(12));
  expect(colorAt(0)).not.toEqual(colorAt(6));
  geometry.dispose();
});

it("renders the same planted sole that the contact solver measured throughout walking and running", () => {
  const { p, skin, materials } = buildOfficialRig("ref", "#c52613", "#0a6b3c");
  const root = new THREE.Group();
  root.add(skin.root);
  for (const speed of [0, 1.6, 5.5, 6.8]) {
    for (let phase = 0; phase < Math.PI * 2; phase += 0.2) {
      const pose = gaitPoseAt(phase, speed, p).pose;
      clampPoseAnatomy(pose);
      const input = {
        P: p,
        pose,
        hipShiftX: 0,
        leanX: 0,
        leanZ: 0,
        airborne: 0,
        previousRootY: 0,
        dt: 1,
      };
      const contact = solveGroundContact(input);
      skin.boneOf.hips.position.y = p.hipY + pose.hipY;
      skin.boneOf.hips.rotation.set(pose.hipPitch, pose.hipYaw, pose.hipRoll);
      applyOfficialLegPose(skin.boneOf, pose, contact);
      root.position.y = contact.rootY;
      root.updateMatrixWorld(true);
      for (const [left, ankle, fix] of [
        [true, skin.boneOf.ankleL, contact.ankleLFix],
        [false, skin.boneOf.ankleR, contact.ankleRFix],
      ] as const) {
        const renderedSole = Math.min(
          ...SOLE_CONTACT_PROFILE.map((section) => {
            // Project the complete sole envelope through the rendered bones.
            // The old toe/heel centre sample missed the edge during lateral roll.
            const rx = section.width * p.footH,
              ry = p.footH * 0.045;
            const m = ankle.matrixWorld.elements;
            const angle = Math.atan2(-m[5]! * ry, -m[1]! * rx);
            return new THREE.Vector3(
              rx * Math.cos(angle),
              -p.footH * 0.64 + ry * Math.sin(angle),
              section.z * p.footLen,
            ).applyMatrix4(ankle.matrixWorld).y;
          }),
        );
        const authoredAnkle = left ? pose.ankleL : pose.ankleR;
        const measuredSole =
          soleHeightFor(
            input,
            left,
            THREE.MathUtils.clamp(authoredAnkle + fix, -0.9, 0.9) - authoredAnkle,
          ).y + contact.rootY;
        expect(renderedSole).toBeCloseTo(measuredSole, 6);
        expect(renderedSole).toBeGreaterThanOrEqual(0.007);
      }
    }
  }
  skin.dispose();
  materials.forEach((material) => material.dispose());
});
