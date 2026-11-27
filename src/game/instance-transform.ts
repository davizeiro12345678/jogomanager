import type { Matrix4 } from "three";

/** parent × translation × XYZ rotation, without a quaternion, a composed
 * temporary matrix or a general 4×4 multiplication. The homogeneous row and
 * aliased output remain valid, including scaled/reflected parent matrices. */
export function placeRotatedInstanceJoint(
  out: Matrix4,
  parent: Matrix4,
  x: number,
  y: number,
  z: number,
  pitch = 0,
  yaw = 0,
  roll = 0,
): void {
  if (pitch === 0 && yaw === 0 && roll === 0) {
    placeScaledInstancePart(out, parent, x, y, z, 1, 1, 1);
    return;
  }
  const a = Math.cos(pitch),
    b = Math.sin(pitch);
  const c = Math.cos(yaw),
    d = Math.sin(yaw);
  const e = Math.cos(roll),
    f = Math.sin(roll);
  const ae = a * e,
    af = a * f,
    be = b * e,
    bf = b * f;
  const r00 = c * e,
    r01 = -c * f,
    r02 = d;
  const r10 = af + be * d,
    r11 = ae - bf * d,
    r12 = -b * c;
  const r20 = bf - ae * d,
    r21 = be + af * d,
    r22 = a * c;
  const source = parent.elements;
  const target = out.elements;
  // Cache a row before writing it so out === parent stays safe.
  for (let row = 0; row < 4; row++) {
    const p0 = source[row]!,
      p1 = source[row + 4]!,
      p2 = source[row + 8]!,
      p3 = source[row + 12]!;
    target[row] = p0 * r00 + p1 * r10 + p2 * r20;
    target[row + 4] = p0 * r01 + p1 * r11 + p2 * r21;
    target[row + 8] = p0 * r02 + p1 * r12 + p2 * r22;
    target[row + 12] = p0 * x + p1 * y + p2 * z + p3;
  }
}

/** parent × translation × scale, without allocating/composing a temporary
 * matrix or multiplying its known-zero/identity rotation entries. Alias-safe.
 * General Matrix4 formula also preserves the homogeneous row. */
export function placeScaledInstancePart(
  out: Matrix4,
  parent: Matrix4,
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
): void {
  const source = parent.elements;
  const target = out.elements;
  const tx = source[0]! * x + source[4]! * y + source[8]! * z + source[12]!;
  const ty = source[1]! * x + source[5]! * y + source[9]! * z + source[13]!;
  const tz = source[2]! * x + source[6]! * y + source[10]! * z + source[14]!;
  const tw = source[3]! * x + source[7]! * y + source[11]! * z + source[15]!;
  for (let row = 0; row < 4; row += 1) {
    target[row] = source[row]! * sx;
    target[row + 4] = source[row + 4]! * sy;
    target[row + 8] = source[row + 8]! * sz;
  }
  target[12] = tx;
  target[13] = ty;
  target[14] = tz;
  target[15] = tw;
}
