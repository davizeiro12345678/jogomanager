import { describe, expect, it } from "vitest";
import { emptyPose } from "./animation-core";
import { gaitCadence, gaitPoseAt, locomotionWeight, solveLegTarget } from "./gait-kinematics";
import {
  airborneFactor,
  clampPoseAnatomy,
  soleHeightFor,
  solveGroundContact,
} from "./ground-contact";
import { lookFor, proportionsFor } from "./player-model";
import { refineFootballAction } from "./football-action";
import { visualMotionFor } from "./visual-motion";

const p = proportionsFor(lookFor("gait-regression", "MF"));
const legEnd = (pitch: number, knee: number) => ({
  z: -p.thigh * Math.sin(pitch) - p.shin * Math.sin(pitch - knee),
  down: p.thigh * Math.cos(pitch) + p.shin * Math.cos(pitch - knee),
});

describe("physical player movement", () => {
  it.each([-0.3, 0, 0.35])("reaches a target at %s m with a knee that bends anatomically", (z) => {
    const target = solveLegTarget(z, p.thigh + p.shin - 0.16, p.thigh, p.shin);
    const end = legEnd(target.pitch, target.knee);
    expect(end.z).toBeCloseTo(z, 6);
    expect(end.down).toBeCloseTo(p.thigh + p.shin - 0.16, 6);
    expect(target.knee).toBeLessThan(0);
    expect(target.pitch - target.knee + target.ankle).toBeCloseTo(0, 6);
  });

  it.each([1.6, 5.5, 8])("holds the supporting foot in world space at %s m/s", (speed) => {
    const cadence = gaitCadence(speed, p.thigh + p.shin);
    const duty = 0.64 - Math.min(1, speed / 6.8) * 0.38;
    const worldFoot = (u: number) => {
      const phase = u * duty * Math.PI * 2;
      const sample = gaitPoseAt(phase, speed, p);
      expect(sample.contactL).toBe(1);
      return (speed * u * duty) / cadence + legEnd(sample.pose.legLPitch, sample.pose.kneeL).z;
    };
    expect(worldFoot(0.15)).toBeCloseTo(worldFoot(0.8), 5);
  });

  it("keeps both feet above the turf for a full stride across player sizes", () => {
    for (const role of ["GK", "DF", "MF", "FW"]) {
      const body = proportionsFor(lookFor(`contact-${role}`, role));
      let rootY = 0;
      for (let frame = 0; frame < 120; frame++) {
        const pose = clampPoseAnatomy(gaitPoseAt((frame / 120) * Math.PI * 2, 5.5, body).pose);
        const input = {
          P: body,
          pose,
          hipShiftX: 0,
          leanX: 0.08,
          leanZ: 0.03,
          airborne: 0,
          previousRootY: rootY,
          dt: 1 / 60,
        };
        const result = solveGroundContact(input);
        rootY = result.rootY;
        expect(soleHeightFor(input, true).y + rootY).toBeGreaterThanOrEqual(0.0079);
        expect(soleHeightFor(input, false).y + rootY).toBeGreaterThanOrEqual(0.0079);
        expect(Object.values(pose).every(Number.isFinite)).toBe(true);
      }
    }
  });

  it("retains stride phase at LOD handoff and after a long frame", () => {
    const player = { id: "athlete", x: 0, z: 0, vx: 0, vz: 5.5 };
    const ball = { x: 0, z: 5 };
    const owner = {};
    const start = visualMotionFor(owner, player, ball, 12, p.thigh + p.shin, 0).phase;
    const hero = visualMotionFor(owner, player, ball, 12, p.thigh + p.shin, 0.8);
    const phase = hero.phase;
    const distant = visualMotionFor(owner, player, ball, 12, p.thigh + p.shin, 0.8);
    expect(distant).toBe(hero);
    expect(distant.phase).toBe(phase);
    expect(phase).toBeCloseTo(
      (start + 0.8 * gaitCadence(5.5, p.thigh + p.shin) * Math.PI * 2) % (Math.PI * 2),
      6,
    );
  });

  it("gives the same stride clock at 30 and 120 frames per second", () => {
    const player = { id: "clock", x: 0, z: 0, vx: 0, vz: 8 };
    const run = (fps: number) => {
      const owner = {};
      let result = visualMotionFor(owner, player, { x: 0, z: 5 }, 89, p.thigh + p.shin, 0);
      for (let frame = 1; frame <= fps * 2; frame++)
        result = visualMotionFor(owner, player, { x: 0, z: 5 }, 89, p.thigh + p.shin, frame / fps);
      return result.phase;
    };
    expect(run(30)).toBeCloseTo(run(120), 5);
  });

  it("switches the striking foot while preserving the planted support", () => {
    const right = refineFootballAction(emptyPose(), "shotPower", 0.58, p, "right");
    const left = refineFootballAction(emptyPose(), "shotPower", 0.58, p, "left");
    expect(right.legRPitch).toBeCloseTo(left.legLPitch, 6);
    expect(right.kneeL).toBeCloseTo(left.kneeR, 6);
    expect(legEnd(right.legRPitch, right.kneeR).z).toBeGreaterThan(0.35);
    expect(Math.abs(legEnd(right.legLPitch, right.kneeL).z)).toBeLessThan(0.06);
    expect(locomotionWeight(8, "shotPower", "kickHard")).toBe(0);
    expect(airborneFactor("gkDiveLeft", 0.2)).toBe(1);
    expect(airborneFactor("headerJump", 0.2)).toBe(1);
    expect(airborneFactor("run", 0.2)).toBe(0);
  });

  it("uses distinct side steps, backward movement, dribbling and fatigue", () => {
    const direction = { forward: 2, lateral: 0, turnRate: 0, stamina: 100, hasBall: false };
    const front = gaitPoseAt(0.2, 2, p, emptyPose(), direction).pose;
    const side = gaitPoseAt(0.2, 2, p, emptyPose(), { ...direction, forward: 0, lateral: 2 }).pose;
    const back = gaitPoseAt(0.2, 2, p, emptyPose(), { ...direction, forward: -2 }).pose;
    const tired = gaitPoseAt(0.2, 2, p, emptyPose(), {
      ...direction,
      stamina: 15,
      hasBall: true,
    }).pose;
    expect(Math.abs(side.legLRoll)).toBeGreaterThan(0.05);
    expect(back.spine).toBeLessThan(front.spine);
    expect(tired.spine).toBeGreaterThan(front.spine);
    expect(tired.armLRoll).toBeGreaterThan(front.armLRoll);
  });
});
