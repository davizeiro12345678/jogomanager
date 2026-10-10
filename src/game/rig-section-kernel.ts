/** Presentation-only flat ABI. Five floats per vertex: x,y,z,u,v. */
export interface RigSectionInput {
  rings: Float64Array;
  radial: number;
  roundness: number;
  /** 0:none, 1:bottom, 2:top, 3:both */
  caps: number;
}
export const MAX_SECTION_RINGS = 256;
export const MAX_SECTION_RADIAL = 128;
export function validRigSection(input: RigSectionInput): boolean {
  if (
    !(input.rings instanceof Float64Array) ||
    input.rings.length < 8 ||
    input.rings.length % 4 ||
    input.rings.length > MAX_SECTION_RINGS * 4 ||
    !Number.isInteger(input.radial) ||
    input.radial < 3 ||
    input.radial > MAX_SECTION_RADIAL ||
    !Number.isFinite(input.roundness) ||
    input.roundness < 0.25 ||
    input.roundness > 4 ||
    !Number.isInteger(input.caps) ||
    input.caps < 0 ||
    input.caps > 3
  )
    return false;
  for (let i = 0; i < input.rings.length; i++) {
    const value = input.rings[i]!;
    if (!Number.isFinite(value) || Math.abs(value) > 100) return false;
  }
  return true;
}
export function rigSectionVertexCount(input: RigSectionInput): number {
  const caps = Number((input.caps & 1) !== 0) + Number((input.caps & 2) !== 0);
  return (input.rings.length / 4) * (input.radial + 1) + caps * (input.radial + 2);
}
export function generateRigSectionFallback(input: RigSectionInput): Float32Array {
  if (!validRigSection(input)) throw new RangeError("Invalid rig section");
  const { rings, radial, roundness, caps } = input;
  const rows = rings.length / 4;
  const output = new Float32Array(rigSectionVertexCount(input) * 5);
  const bottom = rings[0]!;
  const span = Math.max(0.001, rings[(rows - 1) * 4]! - bottom);
  let cursor = 0;
  const write = (x: number, y: number, z: number, u: number, v: number) => {
    output.set([x, y, z, u, v], cursor);
    cursor += 5;
  };
  for (let row = 0; row < rows; row++) {
    const offset = row * 4;
    for (let side = 0; side <= radial; side++) {
      const u = side / radial;
      const angle = u * Math.PI * 2;
      const sine = Math.sin(angle);
      const cosine = Math.cos(angle);
      write(
        Math.sign(sine) * Math.abs(sine) ** roundness * rings[offset + 1]!,
        rings[offset]!,
        Math.sign(cosine) * Math.abs(cosine) ** roundness * rings[offset + 2]! + rings[offset + 3]!,
        u,
        (rings[offset]! - bottom) / span,
      );
    }
  }
  for (const [row, mask] of [
    [0, 1],
    [rows - 1, 2],
  ]) {
    if (!(caps & mask!)) continue;
    const offset = row! * 4;
    const v = mask === 1 ? 0 : 1;
    write(0, rings[offset]!, rings[offset + 3]!, 0.5, v);
    for (let side = 0; side <= radial; side++) {
      const source = (row! * (radial + 1) + side) * 5;
      write(output[source]!, output[source + 1]!, output[source + 2]!, side / radial, v);
    }
  }
  return output;
}
export function rigSectionIndices(input: RigSectionInput): Uint32Array {
  const { radial, caps } = input;
  const rows = input.rings.length / 4;
  const capsCount = Number((caps & 1) !== 0) + Number((caps & 2) !== 0);
  const output = new Uint32Array((rows - 1) * radial * 6 + capsCount * radial * 3);
  let cursor = 0;
  for (let row = 0; row < rows - 1; row++)
    for (let side = 0; side < radial; side++) {
      const a = row * (radial + 1) + side;
      const b = a + radial + 1;
      output.set([a, a + 1, b, a + 1, b + 1, b], cursor);
      cursor += 6;
    }
  let center = rows * (radial + 1);
  for (const mask of [1, 2])
    if (caps & mask) {
      for (let side = 0; side < radial; side++) {
        const a = center + 1 + side;
        output.set([center, mask === 1 ? a + 1 : a, mask === 1 ? a : a + 1], cursor);
        cursor += 3;
      }
      center += radial + 2;
    }
  return output;
}
