import { describe, expect, it } from "vitest";

import {
  generateRigSectionFallback,
  rigSectionIndices,
  rigSectionVertexCount,
  validRigSection,
} from "./rig-section-kernel";

describe("bounded rig-section presentation kernel", () => {
  it("keeps the hero ring shape finite when shoulders and hips curve inward", () => {
    const input = {
      rings: new Float64Array([
        0, 0.22, 0.16, 0, 0.24, 0.34, 0.23, 0.01, 0.62, 0.42, 0.2, -0.015, 0.84, 0.31, 0.17, 0.005,
      ]),
      radial: 80,
      roundness: 1.2,
      caps: 3,
    };
    const packed = generateRigSectionFallback(input);
    const indices = rigSectionIndices(input);
    expect(validRigSection(input)).toBe(true);
    expect(packed).toHaveLength(rigSectionVertexCount(input) * 5);
    expect(packed.every(Number.isFinite)).toBe(true);
    expect(indices.every((index) => index >= 0 && index < packed.length / 5)).toBe(true);
  });

  it("rejects values outside the shared TypeScript/Rust ABI budget", () => {
    expect(
      validRigSection({
        rings: new Float64Array(8),
        radial: 129,
        roundness: 1,
        caps: 3,
      }),
    ).toBe(false);
    expect(
      validRigSection({
        rings: new Float64Array([0, 0.2, 0.2, 0, 1, 0.2, 0.2, 0]),
        radial: 12,
        roundness: Number.NaN,
        caps: 3,
      }),
    ).toBe(false);
  });
});
