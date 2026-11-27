import { describe, expect, it } from "vitest";
import { Euler, Matrix4, Quaternion, Vector3 } from "three";
import { placeRotatedInstanceJoint, placeScaledInstancePart } from "./instance-transform";

describe("rotated instanced joint transform", () => {
  it("preserves XYZ poses, zero rotations, reflections and aliased output", () => {
    for (let index = 0; index < 240; index++) {
      const parent = new Matrix4().compose(
        new Vector3(index / 11, -index / 7, index - 100),
        new Quaternion().setFromEuler(new Euler(index / 13, index / 17, index / 29, "YXZ")),
        new Vector3(index % 2 ? -0.7 : 0.8, 0.9, 1.2),
      );
      const x = index / 41,
        y = -index / 73,
        z = index / 59;
      const pitch = index % 5 ? index / 19 : 0;
      const yaw = index % 5 ? -index / 23 : 0;
      const roll = index % 5 ? index / 37 : 0;
      const local = new Matrix4().compose(
        new Vector3(x, y, z),
        new Quaternion().setFromEuler(new Euler(pitch, yaw, roll, "XYZ")),
        new Vector3(1, 1, 1),
      );
      const expected = parent.clone().multiply(local);
      for (const output of [new Matrix4(), parent]) {
        placeRotatedInstanceJoint(output, parent, x, y, z, pitch, yaw, roll);
        output.elements.forEach((value, offset) =>
          expect(value).toBeCloseTo(expected.elements[offset]!, 10),
        );
      }
    }
  });
  it("retains a non-affine parent homogeneous row", () => {
    const parent = new Matrix4().set(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 0.1, 0.2, 0.3, 2);
    const local = new Matrix4().compose(
      new Vector3(1, -2, 3),
      new Quaternion().setFromEuler(new Euler(0.7, -0.3, 0.9)),
      new Vector3(1, 1, 1),
    );
    const expected = parent.clone().multiply(local);
    placeRotatedInstanceJoint(parent, parent, 1, -2, 3, 0.7, -0.3, 0.9);
    parent.elements.forEach((value, offset) =>
      expect(value).toBeCloseTo(expected.elements[offset]!, 11),
    );
  });
});

describe("scaled instanced body transform", () => {
  it("matches general composition and multiplication for body poses and scales", () => {
    const result = new Matrix4();
    for (let index = 0; index < 100; index += 1) {
      const parent = new Matrix4().compose(
        new Vector3(index - 50, index / 7, -index / 9),
        new Quaternion().setFromEuler(new Euler(index / 17, index / 31, index / 41, "YXZ")),
        new Vector3(0.7 + index / 101, 0.8, 1.2),
      );
      const x = (index % 7) / 11,
        y = -index / 43,
        z = index / 71;
      const sx = index / 200,
        sy = 0.8,
        sz = 0.17;
      const local = new Matrix4().compose(
        new Vector3(x, y, z),
        new Quaternion(),
        new Vector3(sx, sy, sz),
      );
      const expected = new Matrix4().multiplyMatrices(parent, local);
      placeScaledInstancePart(result, parent, x, y, z, sx, sy, sz);
      result.elements.forEach((value, offset) =>
        expect(value).toBeCloseTo(expected.elements[offset]!, 11),
      );
      placeScaledInstancePart(parent, parent, x, y, z, sx, sy, sz);
      parent.elements.forEach((value, offset) =>
        expect(value).toBeCloseTo(expected.elements[offset]!, 11),
      );
    }
  });
  it("keeps the homogeneous row of a general matrix", () => {
    const parent = new Matrix4().set(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 0.1, 0.2, 0.3, 2);
    const result = new Matrix4();
    placeScaledInstancePart(result, parent, 2, 3, 4, 0.5, 2, -1);
    const expected = parent
      .clone()
      .multiply(new Matrix4().makeTranslation(2, 3, 4))
      .multiply(new Matrix4().makeScale(0.5, 2, -1));
    result.elements.forEach((value, offset) =>
      expect(value).toBeCloseTo(expected.elements[offset]!, 11),
    );
  });
});
