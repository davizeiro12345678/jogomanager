import { describe, expect, it } from "vitest";

import { markNearestGrassChunks } from "./grass-chunk-visibility";

const chunks = [
  { x: -10, z: 0 },
  { x: 0, z: 0 },
  { x: 10, z: 0 },
  { x: 30, z: 0 },
];

describe("grass chunk visibility", () => {
  it("keeps only the closest chunks and retains stable ordering for ties", () => {
    const active = new Uint8Array(chunks.length);
    const indices = new Int32Array(chunks.length);
    const distances = new Float64Array(chunks.length);
    const byChunk = new Float64Array(chunks.length);

    markNearestGrassChunks(
      chunks,
      { x: 0, y: 4, z: 0 },
      4,
      4,
      2,
      active,
      indices,
      distances,
      byChunk,
    );

    expect([...active]).toEqual([1, 1, 0, 0]);
    expect(byChunk[1]).toBeLessThan(byChunk[0]!);
    expect(byChunk[2]).toBeLessThan(byChunk[3]!);
  });

  it("retains a nearby old sector until a replacement is clearly closer", () => {
    const active = new Uint8Array(chunks.length);
    const previous = new Uint8Array(chunks.length);
    const indices = new Int32Array(chunks.length);
    const distances = new Float64Array(chunks.length);
    const real = new Float64Array(chunks.length);
    // Initially, the first sector is closer than the middle one.
    markNearestGrassChunks(
      chunks,
      { x: -7, y: 0, z: 0 },
      4,
      4,
      1,
      active,
      indices,
      distances,
      real,
      previous,
      2.5,
    );
    expect([...active]).toEqual([1, 0, 0, 0]);
    previous.set(active);
    // The middle sector becomes slightly closer, but not by 2.5m.
    markNearestGrassChunks(
      chunks,
      { x: -4.5, y: 0, z: 0 },
      4,
      4,
      1,
      active,
      indices,
      distances,
      real,
      previous,
      2.5,
    );
    expect([...active]).toEqual([1, 0, 0, 0]);
    expect(real[1]).toBeLessThan(real[0]!);
    previous.set(active);
    markNearestGrassChunks(
      chunks,
      { x: 0, y: 0, z: 0 },
      4,
      4,
      1,
      active,
      indices,
      distances,
      real,
      previous,
      2.5,
    );
    expect([...active]).toEqual([0, 1, 0, 0]);
  });

  it("clears a prior selection when no grass chunks are budgeted", () => {
    const active = new Uint8Array([1, 1, 1, 1]);
    markNearestGrassChunks(
      chunks,
      { x: 0, y: 4, z: 0 },
      4,
      4,
      0,
      active,
      new Int32Array(chunks.length),
      new Float64Array(chunks.length),
    );

    expect([...active]).toEqual([0, 0, 0, 0]);
  });
});
