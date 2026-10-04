import { describe, expect, it } from "vitest";

import { emptyPose } from "./animation-core";
import { gaitPoseAt } from "./gait-kinematics";
import { soleHeightFor, solveGroundContact } from "./ground-contact";
import {
  anatomyMeasurements,
  lodForDistance,
  lookFor,
  lookWithPhysique,
  proportionsFor,
} from "./player-model";
import { anatomicalLimb, forearmTattooSurface, type LimbProfile } from "./rig-geometry";
import { tattooAlphaMask } from "./rig-materials";

describe("adult player anatomy", () => {
  it("changes stature and mass without rerolling the athlete's identity", () => {
    const original = lookFor("fixed-athlete-identity", "FW", true);
    const lean = lookWithPhysique(original, { height: 174, weight: 64 });
    const strong = lookWithPhysique(original, { height: 192, weight: 99 });
    for (const look of [lean, strong]) {
      expect(look.seed).toBe(original.seed);
      expect(look.skin).toBe(original.skin);
      expect(look.hairStyle).toBe(original.hairStyle);
      expect(look.eyeColor).toBe(original.eyeColor);
      expect(look.beard).toBe(original.beard);
      expect(anatomyMeasurements(proportionsFor(look)).height).toBeCloseTo(look.height * 1.8, 6);
    }
    expect(proportionsFor(strong).legR).toBeGreaterThan(proportionsFor(lean).legR);
    expect(lookWithPhysique(original, { height: NaN, weight: Infinity })).toBe(original);
    expect(lookWithPhysique(original, { height: 190 }).girth).toBe(original.girth);
  });
  it("keeps stature, limb proportions and head scale consistent across roles and seeds", () => {
    for (const role of ["GK", "DF", "MF", "FW"]) {
      for (let seed = 0; seed < 80; seed++) {
        const id = `anatomy-${role}-${seed}`;
        const look = lookFor(id, role);
        const p = proportionsFor(look);
        const m = anatomyMeasurements(p);
        expect(lookFor(id, role)).toEqual(look);
        expect(m.height).toBeCloseTo(1.8 * look.height, 6);
        expect(m.heads).toBeGreaterThan(7.1);
        expect(m.heads).toBeLessThan(8.7);
        expect(m.inseam / m.height).toBeGreaterThan(0.46);
        expect(m.inseam / m.height).toBeLessThan(0.54);
        expect(m.shoulderWidth / m.height).toBeGreaterThan(0.24);
        expect(m.shoulderWidth / m.height).toBeLessThan(0.36);
        expect(m.wristHeight).toBeLessThan(p.hipY);
        expect(m.wristHeight).toBeGreaterThan(p.hipY - p.thigh * 0.6);
        // LOD head and the detailed skull use the same neck and crown.
        const headCenter =
          p.hipY + p.hipH * 0.5 + p.spineLen + p.chestLen + p.neckLen + p.headR * 0.82;
        expect(headCenter + p.headH * 0.5).toBeCloseTo(m.height, 6);
      }
    }
  });

  it("builds closed tapered limbs with finite, smooth seam normals", () => {
    for (const kind of ["upperArm", "forearm", "thigh", "calf"] satisfies LimbProfile[]) {
      const geometry = anatomicalLimb(kind, 0.4, 0.05, 12);
      const positions = geometry.getAttribute("position");
      const normals = geometry.getAttribute("normal");
      expect(geometry.index).toBeTruthy();
      for (let i = 0; i < positions.count; i++) {
        expect(Number.isFinite(positions.getX(i) + positions.getY(i) + positions.getZ(i))).toBe(
          true,
        );
        expect(Math.hypot(normals.getX(i), normals.getY(i), normals.getZ(i))).toBeCloseTo(1, 4);
      }
      for (let row = 0; row < 13; row++) {
        const first = row * 13;
        const last = first + 12;
        expect(normals.getX(first)).toBeCloseTo(normals.getX(last), 6);
        expect(normals.getY(first)).toBeCloseTo(normals.getY(last), 6);
        expect(normals.getZ(first)).toBeCloseTo(normals.getZ(last), 6);
      }
      geometry.dispose();
    }
  });

  it("fits seeded tattoos to the back of the forearm instead of wrapping around it", () => {
    const p = proportionsFor(lookFor("tattoo-surface", "MF"));
    const left = forearmTattooSurface(p.foreArm, p.armR, 12, 1);
    const right = forearmTattooSurface(p.foreArm, p.armR, 12, -1);
    const leftPositions = left.getAttribute("position");
    const rightPositions = right.getAttribute("position");
    const columns = 16;
    const rows = 16;
    for (let row = 0; row <= rows; row++)
      for (let column = 0; column <= columns; column++) {
        const index = row * (columns + 1) + column;
        const mirrored = row * (columns + 1) + (columns - column);
        expect(Math.abs(leftPositions.getX(index) + rightPositions.getX(mirrored))).toBeLessThan(
          0.0001,
        );
        expect(Math.abs(leftPositions.getZ(index) - rightPositions.getZ(mirrored))).toBeLessThan(
          0.003,
        );
        expect(leftPositions.getZ(index)).toBeLessThan(0);
      }
    const angles = Array.from({ length: leftPositions.count }, (_, index) => {
      const angle = Math.atan2(leftPositions.getX(index), leftPositions.getZ(index));
      return angle < 0 ? angle + Math.PI * 2 : angle;
    });
    const span = Math.max(...angles) - Math.min(...angles);
    expect(span).toBeGreaterThan(1.8);
    expect(span).toBeLessThan(Math.PI);
    expect(left.getIndex()!.count).toBe(rows * columns * 6);
    expect(Array.from(left.getAttribute("normal").array).every(Number.isFinite)).toBe(true);
    left.dispose();
    right.dispose();
  });

  it("generates deterministic tattoo ink with tapered UV edges and broken vertical motifs", () => {
    const a = tattooAlphaMask(4182);
    const b = tattooAlphaMask(4182);
    expect(a).toEqual(b);
    const maximum = Math.max(...a);
    expect(maximum).toBeGreaterThan(140);
    for (let y = 0; y < 64; y++) {
      expect(a[y * 64]).toBe(0);
      expect(a[y * 64 + 63]).toBe(0);
    }
    const fullestRow = Math.max(
      ...Array.from(
        { length: 64 },
        (_, y) => a.slice(y * 64, (y + 1) * 64).filter((alpha) => alpha > 0).length,
      ),
    );
    expect(fullestRow).toBeLessThan(40);
  });

  it("uses LOD hysteresis so small camera movement cannot flash face and hand detail", () => {
    const near = Array.from({ length: 10000 }, (_, index) => index / 100).find(
      (distance) => lodForDistance(distance, "alta") > 0,
    )!;
    const middle = Array.from({ length: 10000 }, (_, index) => index / 100).find(
      (distance) => lodForDistance(distance, "alta") === 2,
    )!;
    const nearBand = Math.max(0.9, near * 0.06);
    const middleBand = Math.max(1.25, (middle - near) * 0.045);
    expect(lodForDistance(near + nearBand * 0.5, "alta", 0)).toBe(0);
    expect(lodForDistance(near + nearBand + 0.1, "alta", 0)).toBe(1);
    expect(lodForDistance(near, "alta", 1)).toBe(1);
    expect(lodForDistance(near - nearBand - 0.1, "alta", 1)).toBe(0);
    expect(lodForDistance(middle + middleBand * 0.5, "alta", 1)).toBe(1);
    expect(lodForDistance(middle + middleBand + 0.1, "alta", 1)).toBe(2);
    expect(lodForDistance(middle - middleBand * 0.5, "alta", 2)).toBe(2);
    expect(lodForDistance(middle - middleBand - 0.1, "alta", 2)).toBe(1);
  });
});

describe("three dimensional sole contact", () => {
  const p = proportionsFor(lookFor("ground-anatomy", "DF"));

  it("keeps heel and toe above turf during root lean, pelvis roll and lateral steps", () => {
    for (const leanZ of [-0.16, 0, 0.16]) {
      for (let frame = 0; frame < 32; frame++) {
        const pose = gaitPoseAt((frame / 32) * Math.PI * 2, 4, p).pose;
        pose.hipRoll += 0.08;
        pose.legLRoll += 0.07;
        const input = {
          P: p,
          pose,
          hipShiftX: 0.025,
          hipRollOffset: 0.06,
          leanX: 0.09,
          leanZ,
          airborne: 0,
          previousRootY: 0,
          dt: 1 / 60,
        };
        const contact = solveGroundContact(input);
        const lowest = Math.min(soleHeightFor(input, true).y, soleHeightFor(input, false).y);
        expect(lowest + contact.rootY).toBeGreaterThanOrEqual(0.0079);
        const finalSole = Math.min(
          soleHeightFor(input, true, contact.ankleLFix).y,
          soleHeightFor(input, false, contact.ankleRFix).y,
        );
        expect(finalSole + contact.rootY).toBeGreaterThanOrEqual(0.0079);
        expect(Number.isFinite(contact.ankleLFix + contact.ankleRFix)).toBe(true);
      }
    }
  });

  it("does not accumulate suspension height over repeated airborne frames", () => {
    const pose = emptyPose();
    pose.hipY = 0.28;
    let previousRootY = 0.2;
    for (let frame = 0; frame < 180; frame++) {
      previousRootY = solveGroundContact({
        P: p,
        pose,
        hipShiftX: 0,
        leanX: 0,
        leanZ: 0,
        airborne: 1,
        previousRootY,
        dt: 1 / 60,
      }).rootY;
    }
    expect(Math.abs(previousRootY)).toBeLessThan(0.001);
    expect(pose.hipY).toBe(0.28);
  });

  it("preserves the striking ankle when the other foot supports a kick", () => {
    const pose = emptyPose();
    pose.legRPitch = -0.35;
    pose.kneeR = -0.45;
    pose.ankleR = -0.2;
    const contact = solveGroundContact({
      P: p,
      pose,
      hipShiftX: 0.045,
      leanX: 0,
      leanZ: 0,
      airborne: 0,
      previousRootY: 0,
      dt: 1 / 60,
      plantedFoot: "left",
    });
    expect(contact.contactR).toBe(0);
    expect(contact.ankleRFix).toBe(0);
    expect(contact.contactL).toBeGreaterThan(0.9);
  });
});
