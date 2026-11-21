import type { SeatBuffers } from "./wasm/shared-seat-transforms";

export type CrowdSeatSource = {
  positions: readonly { x: number; y: number; z: number }[];
  colors: readonly { r: number; g: number; b: number }[];
  skins: readonly { r: number; g: number; b: number }[];
};

export function packCrowdSeats({ positions, colors, skins }: CrowdSeatSource) {
  const values = new Float64Array(positions.length * 9);
  for (let seat = 0; seat < positions.length; seat++) {
    const { x, y, z } = positions[seat]!;
    const color = colors[seat]!;
    const skin = skins[seat]!;
    const offset = seat * 9;
    values[offset] = x;
    values[offset + 1] = y;
    values[offset + 2] = z;
    values[offset + 3] = color.r;
    values[offset + 4] = color.g;
    values[offset + 5] = color.b;
    values[offset + 6] = skin.r;
    values[offset + 7] = skin.g;
    values[offset + 8] = skin.b;
  }
  return values;
}

/** Preserve the Y-axis quaternion composition used by Three's Object3D. */
export function buildCrowdSeatUpload(values: Float64Array): SeatBuffers {
  const count = values.length / 9;
  // One allocation and one transferable for the four GPU attribute views.
  const bytes = Float32Array.BYTES_PER_ELEMENT;
  const buffer = new ArrayBuffer(count * 24 * bytes);
  const matrices = new Float32Array(buffer, 0, count * 16);
  const colors = new Float32Array(buffer, count * 16 * bytes, count * 3);
  const skins = new Float32Array(buffer, count * 19 * bytes, count * 3);
  const styles = new Float32Array(buffer, count * 22 * bytes, count * 2);
  for (let seat = 0; seat < count; seat++) {
    const source = seat * 9;
    const x = values[source]!;
    const y = values[source + 1]!;
    const z = values[source + 2]!;
    const height = 0.9 + (seat % 7) * 0.025;
    const width = height * (0.92 + (seat % 3) * 0.06);
    const halfYaw = Math.atan2(-x, -z) / 2;
    const sine = Math.sin(halfYaw);
    const doubledSine = sine + sine;
    const cosineYaw = 1 - sine * doubledSine;
    const sineYaw = Math.cos(halfYaw) * doubledSine;
    const matrix = seat * 16;
    matrices[matrix] = cosineYaw * width;
    matrices[matrix + 2] = (0 - sineYaw) * width;
    matrices[matrix + 5] = height;
    matrices[matrix + 8] = sineYaw * height;
    matrices[matrix + 10] = cosineYaw * height;
    matrices[matrix + 12] = x;
    matrices[matrix + 13] = y;
    matrices[matrix + 14] = z;
    matrices[matrix + 15] = 1;
    const color = seat * 3;
    colors[color] = values[source + 3]!;
    colors[color + 1] = values[source + 4]!;
    colors[color + 2] = values[source + 5]!;
    skins[color] = values[source + 6]!;
    skins[color + 1] = values[source + 7]!;
    skins[color + 2] = values[source + 8]!;
    styles[seat * 2] = (seat % 13) / 12;
    styles[seat * 2 + 1] = (seat % 11) / 10;
  }
  return { matrices, colors, skins, styles };
}
