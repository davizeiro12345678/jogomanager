import { describe, expect, it } from "vitest";

import { buildGrassInstanceBuffers } from "./grass-instance-data";

describe("grass instance preparation", () => {
  it("keeps deterministic compact attributes suitable for a transferable worker buffer", () => {
    const chunks = [
      { x: -4, z: 3 },
      { x: 7, z: -2 },
    ];
    const first = buildGrassInstanceBuffers(chunks, 3, 5, 4, 12);
    const second = buildGrassInstanceBuffers(chunks, 3, 5, 4, 12);

    expect(first).toHaveLength(2);
    expect(first[0]!.matrices).toHaveLength(3 * 16);
    expect(first[0]!.colors).toHaveLength(3 * 3);
    expect(first).toEqual(second);
    for (const entry of first)
      for (const value of [...entry.matrices, ...entry.colors])
        expect(Number.isFinite(value)).toBe(true);
  });

  it("puts the generated blade root at the stable field height", () => {
    const [entry] = buildGrassInstanceBuffers([{ x: 0, z: 0 }], 1, 0, 0, 52);
    expect(entry!.matrices[13]).toBeCloseTo(0.01);
    expect(entry!.matrices[15]).toBe(1);
  });
});
