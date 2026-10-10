import type { Matrix4 } from "three";

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
