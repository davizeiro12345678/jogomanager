import { describe, expect, it } from "vitest";
import * as THREE from "three";

import { CLIP_NAMES, type PlayerAction } from "./animation";
import { emptyPose, JOINTS, type Pose } from "./animation-core";
import { shoulderPose } from "./athlete-posture";
import { refineFootballAction } from "./football-action";
import { gaitPoseAt, solveLegTarget } from "./gait-kinematics";
import { clampPoseAnatomy } from "./ground-contact";
import { footballContactAt } from "./motion-metadata";
import { lookFor, proportionsFor } from "./player-model";
import { getAnnotatedClip } from "./register-animations";
import { visualMotionFor } from "./visual-motion";

const p = proportionsFor(lookFor("athletic-motion", "MF"));

// Reconstruct the rendered clavicle, arm and forearm chain in shoulder space.
// The resulting positions distinguish real reach from angle-only assertions.
function wristFor(pose: Pose, left: boolean) {
  const sign = left ? 1 : -1;
  const shoulder = shoulderPose(
    left ? pose.armLPitch : pose.armRPitch,
    left ? pose.armLRoll : pose.armRRoll,
  );
  const wrist = new THREE.Vector3(0, -p.foreArm, 0).applyEuler(
    new THREE.Euler(left ? pose.elbowL : pose.elbowR, 0, 0),
  );
  wrist.y -= p.upperArm;
  wrist.applyEuler(new THREE.Euler(shoulder.armPitch, shoulder.armYaw, shoulder.armRoll));
  wrist.x += sign * p.shoulderW * 0.4;
  wrist.applyEuler(new THREE.Euler(shoulder.clavPitch, 0, shoulder.clavRoll));
  wrist.x += sign * p.shoulderW * 0.12;
  return wrist;
}

describe("athletic locomotion", () => {
  it("reconstructs the requested ankle target through the rendered two bone chain", () => {
    for (const z of [-0.22, 0, 0.32]) {
      const thigh = 0.45;
      const shin = 0.43;
      const { pitch, knee } = solveLegTarget(z, 0.78, thigh, shin);
      expect(-Math.sin(pitch) * thigh - Math.sin(pitch - knee) * shin).toBeCloseTo(z, 6);
      expect(Math.cos(pitch) * thigh + Math.cos(pitch - knee) * shin).toBeCloseTo(0.78, 6);
    }
  });

  it("loops lateral and backward steps without snapping or reversed knees", () => {
    const direction = { forward: -1.8, lateral: 1.2, turnRate: -1.3, stamina: 32, hasBall: false };
    const first = gaitPoseAt(0, 2.2, p, emptyPose(), direction).pose;
    const last = gaitPoseAt(Math.PI * 2, 2.2, p, emptyPose(), direction).pose;
    for (const joint of JOINTS) expect(last[joint]).toBeCloseTo(first[joint], 6);
    expect(Math.abs(first.legLRoll)).toBeGreaterThan(0.01);
    expect(first.kneeL).toBeLessThanOrEqual(0);
    expect(first.kneeR).toBeLessThanOrEqual(0);
  });

  it("advances the same stride at five and sixty rendered frames per second", () => {
    const player = { id: "frame-rate", x: 0, z: 0, vx: 0, vz: 5 };
    const ball = { x: 0, z: 3 };
    const sample = (frames: number) => {
      const owner = {};
      let motion = visualMotionFor(owner, player, ball, 123, p.thigh + p.shin, 0);
      for (let frame = 1; frame <= frames; frame++) {
        motion = visualMotionFor(owner, player, ball, 123, p.thigh + p.shin, frame / frames);
      }
      expect(visualMotionFor(owner, player, ball, 123, p.thigh + p.shin, 1)).toBe(motion);
      return motion.phase;
    };
    expect(sample(5)).toBeCloseTo(sample(60), 6);
  });
});

describe("football choreography and catalog", () => {
  const actions: PlayerAction[] = [
    "shotPower",
    "pass",
    "cross",
    "trap",
    "tackle",
    "header",
    "diveLeft",
    "diveRight",
    "throwIn",
    "catch",
    "saveHigh",
    "duel",
    "block",
  ];

  it("mirrors the striking leg and supporting leg for both dominant feet", () => {
    for (const action of [
      "shotPower",
      "pass",
      "cross",
      "trap",
      "tackle",
    ] satisfies PlayerAction[]) {
      const left = refineFootballAction(emptyPose(), action, footballContactAt(action), p, "left");
      const right = refineFootballAction(
        emptyPose(),
        action,
        footballContactAt(action),
        p,
        "right",
      );
      expect(left.legLPitch).toBeCloseTo(right.legRPitch, 6);
      expect(left.kneeL).toBeCloseTo(right.kneeR, 6);
      expect(left.legRPitch).toBeCloseTo(right.legLPitch, 6);
      expect(left.kneeR).toBeCloseTo(right.kneeL, 6);
      if (action !== "trap" && action !== "tackle") {
        expect(left.armLPitch).toBeCloseTo(right.armRPitch, 6);
        expect(left.armRPitch).toBeCloseTo(right.armLPitch, 6);
      }
    }
  });

  it("collects at chest height and absorbs towards the body, separately from a high save", () => {
    const catchContact = refineFootballAction(emptyPose(), "catch", 0.5, p, "right");
    const caught = refineFootballAction(emptyPose(), "catch", 0.88, p, "right");
    const highSave = refineFootballAction(emptyPose(), "saveHigh", 0.5, p, "right");
    for (const left of [true, false]) {
      const reaching = wristFor(catchContact, left);
      const holding = wristFor(caught, left);
      expect(wristFor(highSave, left).y).toBeGreaterThan(reaching.y + 0.35);
      expect(reaching.y).toBeLessThan(0.1);
      expect(holding.z).toBeLessThan(reaching.z - 0.045);
    }
  });

  it("sends both wrists towards the save after the body rolls in either dive direction", () => {
    for (const [action, side] of [
      ["diveLeft", 1],
      ["diveRight", -1],
    ] as const) {
      const pose = refineFootballAction(emptyPose(), action, 0.5, p, "right");
      for (const left of [true, false]) {
        const wrist = wristFor(pose, left);
        expect(wrist.y).toBeGreaterThan(0.3);
        wrist.applyEuler(new THREE.Euler(0, 0, pose.hipRoll));
        expect(wrist.x * -side).toBeGreaterThan(0.2);
      }
    }
  });

  it("keeps preparation, contact and recovery finite and inside joint limits", () => {
    for (const action of actions)
      for (let frame = 0; frame <= 40; frame++) {
        const pose = clampPoseAnatomy(
          refineFootballAction(emptyPose(), action, frame / 40, p, "right"),
        );
        for (const joint of JOINTS) expect(Number.isFinite(pose[joint])).toBe(true);
        expect(pose.kneeL).toBeLessThanOrEqual(0.02);
        expect(pose.kneeR).toBeLessThanOrEqual(0.02);
      }
  });

  it("registers every rendered clip with descriptive tags and ordered markers", () => {
    for (const name of CLIP_NAMES) {
      const annotated = getAnnotatedClip(name);
      expect(annotated, name).toBeDefined();
      expect(annotated!.metadata.tags).toContain("anatomical-limits");
      expect(annotated!.metadata.support).toBeTruthy();
      const markers = annotated!.metadata.markers ?? [];
      expect(markers.map((marker) => marker.time)).toEqual(
        markers.map((marker) => marker.time).sort((a, b) => a - b),
      );
    }
  });
});
