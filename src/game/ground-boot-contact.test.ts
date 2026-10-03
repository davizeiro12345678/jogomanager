import { expect, it } from "vitest";
import * as THREE from "three";
import { emptyPose } from "./animation-core";
import { solveGroundContact, soleHeightFor } from "./ground-contact";
import { lookFor, proportionsFor } from "./player-model";
import { footballBoot } from "./rig-geometry";

it("keeps actual outer sole vertices above the turf during inclined lateral support", () => {
  const p = proportionsFor(lookFor("lateral-boot-contact", "DF"));
  const sole = footballBoot(p.footLen, p.footH, 20, true);
  const vertices = sole.getAttribute("position"),
    point = new THREE.Vector3();
  for (const roll of [-0.28, 0.28, -0.55, 0.55]) {
    const pose = emptyPose();
    pose.hipRoll = roll;
    pose.legLRoll = -roll * 0.35;
    pose.legRRoll = -roll * 0.35;
    pose.legLPitch = 0.25;
    pose.kneeL = -0.6;
    pose.ankleL = 0.35;
    pose.legRPitch = -0.2;
    pose.kneeR = -0.35;
    const input = {
      P: p,
      pose,
      hipShiftX: 0.02,
      leanX: 0.08,
      leanZ: roll * 0.25,
      airborne: 0,
      previousRootY: 0,
      dt: 1 / 60,
    };
    const contact = solveGroundContact(input);
    for (const left of [true, false]) {
      const root = new THREE.Group();
      root.position.y = contact.rootY;
      root.rotation.set(input.leanX, 0, input.leanZ, "YXZ");
      const hips = new THREE.Group();
      hips.position.set(input.hipShiftX, p.hipY, 0);
      hips.rotation.set(pose.hipPitch, pose.hipYaw, pose.hipRoll);
      root.add(hips);
      const thigh = new THREE.Group();
      thigh.position.set((left ? 1 : -1) * p.hipW * 0.36, -p.hipH * 0.4, 0);
      thigh.rotation.set(
        left ? pose.legLPitch : pose.legRPitch,
        0,
        left ? pose.legLRoll : pose.legRRoll,
      );
      hips.add(thigh);
      const knee = new THREE.Group();
      knee.position.y = -p.thigh;
      knee.rotation.x = -(left ? pose.kneeL : pose.kneeR);
      thigh.add(knee);
      const ankle = new THREE.Group();
      ankle.position.y = -p.shin;
      ankle.rotation.x = left ? pose.ankleL + contact.ankleLFix : pose.ankleR + contact.ankleRFix;
      knee.add(ankle);
      root.updateMatrixWorld(true);
      let bottom = Infinity;
      for (let i = 0; i < vertices.count; i++) {
        point.fromBufferAttribute(vertices, i).applyMatrix4(ankle.matrixWorld);
        bottom = Math.min(bottom, point.y);
      }
      expect(bottom, `${left ? "left" : "right"} support at roll ${roll}`).toBeGreaterThanOrEqual(
        0.007,
      );
      const predicted =
        soleHeightFor(input, left, left ? contact.ankleLFix : contact.ankleRFix).y + contact.rootY;
      expect(
        bottom - predicted,
        "contact projection must follow the real sole instead of its centre line",
      ).toBeGreaterThanOrEqual(-0.00001);
      // The smooth physical envelope can sit just outside a 20-sided rendered
      // ellipse; keep that conservative clearance below one millimetre.
      expect(bottom - predicted).toBeLessThan(0.001);
    }
  }
  sole.dispose();
});
