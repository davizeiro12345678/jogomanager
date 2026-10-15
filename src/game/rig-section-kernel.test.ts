import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { generate_rig_section, initSync } from "./wasm/pkg/crowd_visibility_wasm";
import { rigSectionGeometry } from "./rig-geometry";

import {
  generateRigSectionFallback,
  rigSectionIndices,
  rigSectionVertexCount,
  validRigSection,
} from "./rig-section-kernel";

describe("bounded rig-section presentation kernel", () => {
  it.each([16, 64])("matches bounded Rust/WASM output at %i radial segments", (radial) => {
    initSync({
      module: readFileSync(new URL("./wasm/pkg/crowd_visibility_wasm_bg.wasm", import.meta.url)),
    });
    const input = {
      rings: new Float64Array([
        0, 0.2, 0.22, 0, 0.35, 0.24, 0.25, 0.01, 0.8, 0.18, 0.19, 0, 1, 0.12, 0.13, -0.01,
      ]),
      radial,
      roundness: 1.2,
      caps: 3,
    };
    const rust = generate_rig_section(input.rings, input.radial, input.roundness, input.caps);
    const fallback = generateRigSectionFallback(input);
    const maximumDifference = rust.reduce(
      (maximum, value, index) => Math.max(maximum, Math.abs(value - fallback[index]!)),
      0,
    );

    expect(validRigSection(input)).toBe(true);
    expect(rust).toHaveLength(fallback.length);
    expect(rust.every(Number.isFinite)).toBe(true);
    expect(maximumDifference).toBeLessThanOrEqual(1e-6);
  });

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

  it("builds the same indexed geometry from validated section output", () => {
    const input = {
      rings: new Float64Array([0, 0.2, 0.2, 0, 1, 0.15, 0.14, 0]),
      radial: 16,
      roundness: 1.2,
      caps: 3,
    };
    const packed = generateRigSectionFallback(input);
    const geometry = rigSectionGeometry(input, packed);

    expect(geometry.getAttribute("position").count).toBe(packed.length / 5);
    expect(geometry.getAttribute("uv").count).toBe(packed.length / 5);
    expect(geometry.getIndex()?.count).toBe(rigSectionIndices(input).length);
    expect(geometry.userData["surfaceSeams"]).toEqual([
      [0, 16],
      [17, 33],
    ]);
    geometry.dispose();
    expect(() => rigSectionGeometry(input, new Float32Array(1))).toThrow(
      "Invalid rig section output",
    );
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
