import { describe, expect, it } from "vitest";
import { emptyPose, JOINTS } from "./animation-core";
import { SOLE_CONTACT_PROFILE } from "./boot-profile";
import {
  clampPoseAnatomy,
  soleHeightFor,
  solveGroundContact,
  type GroundContactResult,
  type GroundContactInput,
} from "./ground-contact";

// Original point-by-point FK, deliberately independent of the optimized row.
type Point = { x: number; y: number; z: number };
/** Same XYZ order as the skeleton's local rotations. */
function rotate(v: Point, pitch: number, yaw: number, roll: number): Point {
  const x1 = v.x * Math.cos(roll) - v.y * Math.sin(roll);
  const y1 = v.x * Math.sin(roll) + v.y * Math.cos(roll);
  const x2 = x1 * Math.cos(yaw) + v.z * Math.sin(yaw);
  const z2 = -x1 * Math.sin(yaw) + v.z * Math.cos(yaw);
  return {
    x: x2,
    y: y1 * Math.cos(pitch) - z2 * Math.sin(pitch),
    z: y1 * Math.sin(pitch) + z2 * Math.cos(pitch),
  };
}

/** FK for sole, ankle and toe. Includes pelvis shift, hip roll, leg abduction
 * and the root lean, so side steps and goalkeeping do not use a flat guess. */
function referenceSoleHeightFor(input: GroundContactInput, left: boolean, ankleDelta = 0) {
  const { P, pose } = input;
  const pitch = left ? pose.legLPitch : pose.legRPitch;
  const roll = left ? pose.legLRoll : pose.legRRoll;
  const knee = left ? pose.kneeL : pose.kneeR;
  const ankle = (left ? pose.ankleL : pose.ankleR) + ankleDelta;
  const footH = P.footH ?? 0.07;
  const footLen = P.footLen ?? 0.26;
  const transform = (point: Point) => {
    let v = rotate(point, ankle, 0, 0);
    v.y -= P.shin;
    v = rotate(v, -knee, 0, 0);
    v.y -= P.thigh;
    v = rotate(v, pitch, 0, roll);
    v.x += (left ? 1 : -1) * (P.hipW ?? 0.255) * 0.36;
    v.y -= P.hipH * 0.4;
    v = rotate(v, pose.hipPitch, pose.hipYaw, pose.hipRoll + (input.hipRollOffset ?? 0));
    v.x += input.hipShiftX;
    v.y += P.hipY + pose.hipY;
    // YXZ root yaw has no effect on height: roll then pitch are sufficient.
    return rotate(v, input.leanX, 0, input.leanZ).y;
  };
  const origin = transform({ x: 0, y: 0, z: 0 });
  const axisX = transform({ x: 1, y: 0, z: 0 }) - origin;
  const axisY = transform({ x: 0, y: 1, z: 0 }) - origin;
  const axisZ = transform({ x: 0, y: 0, z: 1 }) - origin;
  const lateralScale = axisX * footH;
  const depthSquared = (axisY * footH * 0.045) ** 2;
  const centreY = origin - axisY * footH * 0.64;
  let lowest = Infinity;
  // Project each real elliptical sole section. This includes its outer edge
  // during lateral roll and its full toe reach during a planted kick.
  for (const section of SOLE_CONTACT_PROFILE) {
    const centre = centreY + axisZ * section.z * footLen;
    const radius = Math.sqrt((lateralScale * section.width) ** 2 + depthSquared);
    lowest = Math.min(lowest, centre - radius);
  }
  const angle = input.leanX + pose.hipPitch + pitch - knee;
  return { y: lowest, footAngle: angle };
}

const clamp = (v: number, lo: number, hi: number) =>
  Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : 0;
function referenceSolveGroundContact(input: GroundContactInput): GroundContactResult {
  const { pose, airborne, previousRootY, dt } = input;
  const l = referenceSoleHeightFor(input, true);
  const r = referenceSoleHeightFor(input, false);
  const lowest = Math.min(l.y, r.y);
  const planted = clamp(0.008 - lowest, -0.6, 0.6);
  const air = clamp(airborne, 0, 1);
  // Authored jump height already lives in pose.hipY. Accumulating the old
  // root offset in flight made repeated headers drift upwards.
  const bodyContact = clamp(input.bodyContact ?? 0, 0, 1);
  const pelvisBottom = (side: number) => {
    const point = rotate(
      { x: side * (input.P.hipW ?? 0.255) * 0.6, y: -input.P.hipH * 0.7, z: 0 },
      pose.hipPitch,
      pose.hipYaw,
      pose.hipRoll + (input.hipRollOffset ?? 0),
    );
    point.x += input.hipShiftX;
    point.y += input.P.hipY + pose.hipY;
    return rotate(point, input.leanX, 0, input.leanZ).y;
  };
  const bodyPlanted =
    bodyContact > 0
      ? clamp(0.012 - Math.min(pelvisBottom(-1), pelvisBottom(1)), -1.2, 0.6)
      : planted;
  // Feet remain protected against penetration while the seat/side of the
  // pelvis becomes the support surface. Flight remains an authored offset.
  const supported = planted + (Math.max(planted, bodyPlanted) - planted) * bodyContact;
  const target = supported * (1 - air);
  const k = 1 - Math.exp(-20 * Math.max(0, dt));
  const eased = previousRootY + (target - previousRootY) * k;
  // Ground penetration must be corrected immediately; upward/downward
  // suspension can settle smoothly when the sole has clearance.
  let rootY = air < 0.1 ? Math.max(eased, supported) : eased;

  const band = 0.05;
  const contactL =
    clamp(1 - Math.max(0, l.y + rootY - 0.008) / band, 0, 1) *
    (1 - air) *
    (input.plantedFoot === "right" ? 0 : 1);
  const contactR =
    clamp(1 - Math.max(0, r.y + rootY - 0.008) / band, 0, 1) *
    (1 - air) *
    (input.plantedFoot === "left" ? 0 : 1);

  const ankleLFix = clamp(-l.footAngle - pose.ankleL, -0.6, 0.6) * contactL * 0.5;
  const ankleRFix = clamp(-r.footAngle - pose.ankleR, -0.6, 0.6) * contactR * 0.5;
  // Flattening the sole changes toe/heel clearance. Measure the final ankle
  // angle after its anatomical clamp, before placing the root.
  if (air < 0.1) {
    const finalL = referenceSoleHeightFor(
      input,
      true,
      clamp(pose.ankleL + ankleLFix, -0.9, 0.9) - pose.ankleL,
    );
    const finalR = referenceSoleHeightFor(
      input,
      false,
      clamp(pose.ankleR + ankleRFix, -0.9, 0.9) - pose.ankleR,
    );
    rootY = Math.max(rootY, clamp(0.008 - Math.min(finalL.y, finalR.y), -0.6, 0.6));
  }

  return {
    rootY: Number.isFinite(rootY) ? rootY : 0,
    contactL,
    contactR,
    ankleLFix,
    ankleRFix,
    stanceSpread: clamp(Math.abs(pose.legLPitch - pose.legRPitch) / 1.2, 0, 1),
  };
}

describe("ground contact affine FK", () => {
  it("matches original sole projection across 2048 asymmetric poses and ankle corrections", () => {
    let state = 0x12345678;
    const random = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    };
    for (let i = 0; i < 2048; i++) {
      const pose = emptyPose();
      for (const key of JOINTS) pose[key] = (random() - 0.5) * 4;
      clampPoseAnatomy(pose);
      const input: GroundContactInput = {
        P: {
          hipY: 0.65 + random() * 0.5,
          hipH: 0.13 + random() * 0.15,
          hipW: 0.18 + random() * 0.2,
          thigh: 0.28 + random() * 0.3,
          shin: 0.28 + random() * 0.3,
          footH: 0.04 + random() * 0.07,
          footLen: 0.18 + random() * 0.2,
        },
        pose,
        hipShiftX: (random() - 0.5) * 0.3,
        hipRollOffset: (random() - 0.5) * 0.4,
        leanX: (random() - 0.5) * 1.6,
        leanZ: (random() - 0.5) * 1.6,
        airborne: random(),
        previousRootY: (random() - 0.5) * 0.8,
        plantedFoot: i % 3 === 0 ? "left" : i % 3 === 1 ? "right" : undefined,
        bodyContact: i % 4 === 0 ? random() : 0,
        dt: 1 / 60,
      };
      const expectedGround = referenceSolveGroundContact(input);
      const actualGround = solveGroundContact(input);
      for (const key of Object.keys(expectedGround) as (keyof GroundContactResult)[]) {
        expect(actualGround[key]).toBeCloseTo(expectedGround[key], 11);
      }
      for (const left of [false, true])
        for (const ankleDelta of [0, -0.6, 0.6]) {
          const expected = referenceSoleHeightFor(input, left, ankleDelta);
          const actual = soleHeightFor(input, left, ankleDelta);
          expect(actual.y).toBeCloseTo(expected.y, 12);
          expect(actual.footAngle).toBe(expected.footAngle);
        }
    }
  });
  it("clamps every canonical channel and sanitizes invalid values in place", () => {
    const pose = emptyPose();
    for (const key of JOINTS) pose[key] = Number.NaN;
    expect(clampPoseAnatomy(pose)).toBe(pose);
    expect(Object.values(pose).every((value) => value === 0)).toBe(true);
    pose.kneeL = -100;
    pose.armRPitch = Infinity;
    pose.hipY = 100;
    clampPoseAnatomy(pose);
    expect(pose.kneeL).toBe(-2.4);
    expect(pose.armRPitch).toBe(0);
    expect(pose.hipY).toBe(0.6);
  });
});
