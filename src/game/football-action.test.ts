import { describe, expect, it } from "vitest";
import { emptyPose, JOINTS } from "./animation-core";
import type { PlayerAction } from "./animation";
import { footballSupportFor, refineFootballAction, refineBallFootContact } from "./football-action";
import { footballContactAt } from "./motion-metadata";
import { clampPoseAnatomy, soleHeightFor, solveGroundContact } from "./ground-contact";
import { lookFor, proportionsFor } from "./player-model";

const proportions = { thigh: 0.44, shin: 0.43 };
const sample = (action: PlayerAction, u: number, foot: "left" | "right" = "right") =>
  refineFootballAction(emptyPose(), action, u, proportions, foot);

describe("football choreography", () => {
  it("adjusts only the striking boot toward a reachable ball during contact", () => {
    const p = proportionsFor(lookFor("foot-contact", "MF"));
    const contact = footballContactAt("shotPower");
    for (const foot of ["left", "right"] as const) {
      const pose = sample("shotPower", contact, foot);
      const support = foot === "left" ? pose.legRPitch : pose.legLPitch;
      const strike = foot === "left" ? pose.legLPitch : pose.legRPitch;
      refineBallFootContact(pose, "shotPower", contact, p, foot, {
        x: foot === "left" ? 0.14 : -0.14,
        z: 0.48,
        height: 0.12,
      });
      expect(foot === "left" ? pose.legRPitch : pose.legLPitch).toBe(support);
      expect(foot === "left" ? pose.legLPitch : pose.legRPitch).not.toBe(strike);
      expect(pose.kneeL).toBeLessThanOrEqual(0);
      expect(pose.kneeR).toBeLessThanOrEqual(0);
      const before = { ...pose };
      refineBallFootContact(pose, "shotPower", contact, p, foot, { x: 3, z: 5, height: 0.12 });
      expect(pose).toEqual(before);
    }
  });
  it("keeps a slide near the turf instead of balancing it like a standing kick", () => {
    for (const foot of ["left", "right"] as const) {
      const p = proportionsFor(lookFor("sliding-athlete", "DF"));
      const pose = clampPoseAnatomy(refineFootballAction(emptyPose(), "slide", 0.5, p, foot));
      const support = footballSupportFor("slide", 0.5, p.hipW, foot);
      const input = {
        P: p,
        pose,
        hipShiftX: support.shiftX,
        leanX: 0,
        leanZ: 0,
        airborne: 0,
        previousRootY: 0,
        dt: 1,
        bodyContact: support.bodyContact,
      };
      const ground = solveGroundContact(input);
      expect(p.hipY + pose.hipY + ground.rootY).toBeLessThan(0.35);
      expect(
        Math.min(soleHeightFor(input, true).y, soleHeightFor(input, false).y) + ground.rootY,
      ).toBeGreaterThanOrEqual(0.0079);
    }
  });
  it("transfers weight to the opposite foot even during a stationary kick", () => {
    const contact = footballContactAt("shotPower");
    const right = footballSupportFor("shotPower", contact, 0.27, "right");
    const left = footballSupportFor("shotPower", contact, 0.27, "left");
    expect(right.shiftX).toBeGreaterThan(0.04);
    expect(right.plantedFoot).toBe("left");
    expect(left.shiftX).toBeCloseTo(-right.shiftX, 6);
    expect(left.plantedFoot).toBe("right");
    expect(footballSupportFor("shotPower", 1, 0.27, "right").shiftX).toBeCloseTo(0, 6);
    expect(footballSupportFor("diveLeft", 0.5, 0.27, "right").bodyContact).toBe(0);
    expect(footballSupportFor("diveLeft", 0.77, 0.27, "right").bodyContact).toBeGreaterThan(0.9);
    expect(footballSupportFor("slide", 0.5, 0.27, "right").bodyContact).toBe(1);
  });
  it.each<PlayerAction>([
    "shotPower",
    "shotPlaced",
    "chip",
    "volley",
    "firstTime",
    "passLong",
    "header",
    "headClear",
    "diveLeft",
    "diveRight",
    "saveHigh",
    "save",
    "slide",
    "stepover",
    "feint",
    "cut",
    "elastico",
    "catch",
  ])("keeps %s continuous with finite joints and forward-bending knees", (action) => {
    let previous = sample(action, 0);
    for (let frame = 1; frame <= 240; frame++) {
      const pose = sample(action, frame / 240);
      for (const joint of JOINTS) {
        expect(Number.isFinite(pose[joint])).toBe(true);
        expect(Math.abs(pose[joint] - previous[joint])).toBeLessThan(0.19);
      }
      expect(pose.kneeL).toBeLessThanOrEqual(0.02);
      expect(pose.kneeR).toBeLessThanOrEqual(0.02);
      previous = pose;
    }
  });

  it("loads before an aerial header and cushions its landing before recovery", () => {
    expect(sample("header", 0.12).hipY).toBeLessThan(0);
    expect(sample("header", 0.5).hipY).toBeGreaterThan(0.25);
    expect(sample("header", 0.86).hipY).toBeLessThan(0);
    expect(sample("header", 1).hipY).toBeCloseTo(0, 6);
    const left = sample("diveLeft", 0.5),
      right = sample("diveRight", 0.5);
    expect(left.hipRoll).toBeCloseTo(-right.hipRoll, 6);
    expect(left.armLPitch).toBeCloseTo(right.armRPitch, 6);
    expect(left.kneeL).toBeCloseTo(right.kneeR, 6);
  });

  it.each<PlayerAction>(["diveLeft", "diveRight", "saveHigh"])(
    "loads, extends at contact and absorbs the landing of %s before resetting",
    (action) => {
      const preparation = sample(action, 0.12);
      const contact = sample(action, footballContactAt(action));
      const continuation = sample(action, 0.7);
      const landing = sample(action, 0.86);
      const reset = sample(action, 1);
      expect(preparation.hipY).toBeLessThan(-0.05);
      expect(preparation.kneeL).toBeLessThan(-0.45);
      expect(contact.hipY).toBeGreaterThan(0.25);
      expect(Math.min(contact.armLPitch, contact.armRPitch)).toBeLessThan(-2.6);
      expect(continuation.elbowL).toBeLessThan(contact.elbowL - 0.15);
      expect(landing.hipY).toBeLessThan(-0.04);
      expect(landing.kneeL).toBeLessThan(-0.45);
      expect(Math.abs(reset.hipY)).toBeLessThan(1e-6);
      expect(Math.abs(reset.hipRoll)).toBeLessThan(1e-6);
    },
  );

  it("applies the same frontal parry used by the match, with a planted load and elbow absorption", () => {
    const load = sample("save", 0.12);
    const contact = sample("save", footballContactAt("save"));
    const continuation = sample("save", 0.7);
    expect(load.hipY).toBeLessThan(-0.03);
    expect(load.kneeL).toBeLessThan(-0.5);
    expect(contact.armLPitch).toBeLessThan(-1.3);
    expect(contact.armLPitch).toBe(contact.armRPitch);
    expect(contact.hipY).toBeCloseTo(0, 6);
    expect(continuation.elbowL).toBeLessThan(contact.elbowL - 0.5);
    expect(continuation.spine).toBeGreaterThan(contact.spine + 0.08);
    expect(sample("save", 1).hipY).toBeCloseTo(0, 6);
  });

  it("distinguishes placed shots, lifted chips and elevated volleys at contact", () => {
    const power = sample("shotPower", footballContactAt("shotPower"));
    const placed = sample("shotPlaced", footballContactAt("shotPlaced"));
    const chip = sample("chip", footballContactAt("chip"));
    const volley = sample("volley", footballContactAt("volley"));
    expect(Math.abs(placed.legRRoll)).toBeGreaterThan(Math.abs(power.legRRoll));
    expect(volley.kneeR).toBeLessThan(power.kneeR);
    expect(chip.ankleR).not.toBeCloseTo(power.ankleR, 2);
    const mirrored = sample("shotPlaced", 0.4, "left");
    expect(mirrored.legLPitch).toBeCloseTo(placed.legRPitch, 6);
    expect(mirrored.legLRoll).toBeCloseTo(-placed.legRRoll, 6);
  });
});
