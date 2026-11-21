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
// Repeated player sections share only the immutable angular coefficients,
// never their vertex buffers. The FIFO budget bounds retained scratch data
// when untrusted or procedurally generated shapes vary their roundness.
const ANGULAR_PROFILE_CACHE_LIMIT = 16;
const rigSectionAngles = new Map<string, Float64Array>();

function cachedRigSectionAngles(radial: number, roundness: number): Float64Array {
  const key = `${radial}:${roundness}`;
  const existing = rigSectionAngles.get(key);
  if (existing) return existing;

  const angular = new Float64Array((radial + 1) * 3);
  for (let side = 0; side <= radial; side++) {
    const u = side / radial;
    const angle = u * Math.PI * 2;
    const sine = Math.sin(angle);
    const cosine = Math.cos(angle);
    angular[side * 3] = Math.sign(sine) * Math.abs(sine) ** roundness;
    angular[side * 3 + 1] = Math.sign(cosine) * Math.abs(cosine) ** roundness;
    angular[side * 3 + 2] = u;
  }

  if (rigSectionAngles.size >= ANGULAR_PROFILE_CACHE_LIMIT) {
    const oldest = rigSectionAngles.keys().next().value;
    if (oldest !== undefined) rigSectionAngles.delete(oldest);
  }
  rigSectionAngles.set(key, angular);
  return angular;
}

export function generateRigSectionFallback(input: RigSectionInput): Float32Array {
  if (!validRigSection(input)) throw new RangeError("Invalid rig section");
  const { rings, radial, roundness, caps } = input;
  const rows = rings.length / 4;
  const output = new Float32Array(rigSectionVertexCount(input) * 5);
  const bottom = rings[0]!;
  const span = Math.max(0.001, rings[(rows - 1) * 4]! - bottom);
  // Reuse the immutable angular profile for repeated athlete rigs. The
  // Float32 vertex buffer remains independently owned by every caller.
  const angular = cachedRigSectionAngles(radial, roundness);
  let cursor = 0;
  // Write to the owned typed buffer directly. Allocating a temporary five-
  // element array for every 3D vertex creates unnecessary GC pressure.
  const write = (x: number, y: number, z: number, u: number, v: number) => {
    output[cursor++] = x;
    output[cursor++] = y;
    output[cursor++] = z;
    output[cursor++] = u;
    output[cursor++] = v;
  };
  for (let row = 0; row < rows; row++) {
    const offset = row * 4;
    const y = rings[offset]!;
    const width = rings[offset + 1]!;
    const depth = rings[offset + 2]!;
    const center = rings[offset + 3]!;
    const v = (y - bottom) / span;
    for (let direction = 0; direction < angular.length; direction += 3) {
      output[cursor++] = angular[direction]! * width;
      output[cursor++] = y;
      output[cursor++] = angular[direction + 1]! * depth + center;
      output[cursor++] = angular[direction + 2]!;
      output[cursor++] = v;
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
