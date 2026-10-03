import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { cinematicActorPose, cinematicLook } from "./cinematic-actor";
import { cinematicExpressionAt, CinematicGaze } from "./cinematic-expression";
import { cinematicShotFor } from "./cinematic-shot";
import { cinematicStageFocus } from "./cinematic-blocking";
import { proportionsFor } from "./player-model";
import { soleHeightFor } from "./ground-contact";
import type { CinematicCue } from "./cinematic-cue";

const cue: CinematicCue = {
  id: "delivery", speaker: "manager", gesture: "explain", mood: "neutral",
  tension: 0.4, warmth: 0.8, duration: 5, decision: false,
};

describe("cinematic physical performance", () => {
  it("leads attention with the eyes while the head follows without snapping", () => {
    const gaze = new CinematicGaze();
    gaze.sample(0, 0, true);
    const first = { ...gaze.sample(0.8, 1 / 60) };
    expect(first.headYaw).toBeGreaterThan(0);
    expect(first.headYaw).toBeLessThan(0.2);
    expect(first.eyeYaw).toBeGreaterThan(first.headYaw);
    for (let i = 0; i < 120; i++) gaze.sample(0.8, 1 / 60);
    const settled = { ...gaze.sample(0.8, 1 / 60) };
    expect(settled.headYaw).toBeGreaterThan(0.5);
    expect(settled.headYaw).toBeLessThan(0.8);
    expect(Math.abs(settled.eyeYaw)).toBeLessThan(0.3);
    expect(gaze.sample(-0.8, 0)).toEqual(settled);
    expect(Object.values(gaze.sample(NaN, 20)).every(Number.isFinite)).toBe(true);
  });

  it("transfers a speaking gesture through the pelvis and keeps a real sole on the floor", () => {
    const p = proportionsFor(cinematicLook(21));
    const speaking = cinematicActorPose(1, 21, "stand", true, p, undefined, undefined, cue, 1);
    expect(Math.abs(speaking.hipYaw)).toBeGreaterThan(0.008);
    for (let frame = 0; frame <= 180; frame++) {
      const pose = cinematicActorPose(frame / 30, 21, "stand", true, p, undefined, undefined, cue, frame / 30);
      const input = { P: p, pose, hipShiftX: 0, leanX: 0, leanZ: 0, airborne: 0, previousRootY: 0, dt: 0 };
      const heights = [soleHeightFor(input, true).y, soleHeightFor(input, false).y];
      expect(Math.min(...heights)).toBeGreaterThanOrEqual(-0.00001);
      expect(Math.min(...heights)).toBeLessThan(0.003);
      expect(Math.max(...heights)).toBeLessThan(0.025);
    }
  });

  it("lets a warm listener acknowledge the speaker with a restrained brow response", () => {
    const warm = cinematicExpressionAt(1.8, 21, false, 0.4, cue, 0.8);
    const cold = cinematicExpressionAt(1.8, 21, false, 0.4, { ...cue, warmth: 0 }, 0.8);
    expect(warm.browLift).toBeGreaterThan(cold.browLift);
    expect(Math.abs(warm.browLift)).toBeLessThan(0.002);
  });

  it("leaves look room towards the dialogue partner without losing the face in portrait", () => {
    for (const aspect of [0.56, 1.78]) {
      for (const speaker of ["manager", "president"] as const) {
        const shot = cinematicShotFor("office", speaker, "close", aspect);
        const actor = cinematicStageFocus("office", speaker)!;
        const partner = cinematicStageFocus("office", speaker === "manager" ? "president" : "manager")!;
        const camera = new THREE.PerspectiveCamera(shot.fov, aspect, 0.1, 100);
        camera.position.fromArray(shot.position);
        camera.lookAt(new THREE.Vector3(...shot.target));
        camera.updateMatrixWorld(true);
        const face = new THREE.Vector3(actor[0], shot.target[1], actor[1]).project(camera);
        const other = new THREE.Vector3(partner[0], shot.target[1], partner[1]).project(camera);
        expect(face.x * (other.x - face.x)).toBeLessThan(-0.005);
        expect(Math.abs(face.x)).toBeLessThan(0.4);
      }
    }
  });
});
