import { readFileSync } from "node:fs";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { generate_rig_section, initSync } from "./wasm/pkg/crowd_visibility_wasm";
import { rigSectionGeometry } from "./rig-geometry";

import {
  generateRigSectionFallback,
  rigSectionIndices,
  rigSectionVertexCount,
  validRigSection,
} from "./rig-section-kernel";

describe("bounded rig-section presentation kernel", () => {
import { generate_rig_section, initSync } from "./wasm/pkg/crowd_visibility_wasm";
import { rigSectionGeometry } from "./rig-geometry";

import {
  generateRigSectionFallback,
  rigSectionIndices,
  rigSectionVertexCount,
  validRigSection,
} from "./rig-section-kernel";

describe("bounded rig-section presentation kernel", () => {
  it.each([3, 16, 64, 128])("preserves every Float32 vertex at %i radial segments", (radial) => {
    const rings = new Float64Array([
      0, 0.2, 0.22, 0, 0.35, 0.24, 0.25, 0.01, 0.8, 0.18, 0.19, 0, 1, 0.12, 0.13, -0.01,
    ]);
    for (const roundness of [0.25, 1, 1.2, 4]) {
      const input = { rings, radial, roundness, caps: 3 };
      const actual = generateRigSectionFallback(input);
      const independent = generateRigSectionFallback(input);
      expect(actual.buffer).not.toBe(independent.buffer);
      for (let row = 0; row < rings.length / 4; row++) {
        for (let side = 0; side <= radial; side++) {
          const u = side / radial,
            angle = u * Math.PI * 2;
          const s = Math.sin(angle),
            c = Math.cos(angle);
          const offset = row * 4;
          const expected = new Float32Array([
            Math.sign(s) * Math.abs(s) ** roundness * rings[offset + 1]!,
            rings[offset]!,
            Math.sign(c) * Math.abs(c) ** roundness * rings[offset + 2]! + rings[offset + 3]!,
            u,
            (rings[offset]! - rings[0]!) / Math.max(0.001, rings[rings.length - 4]! - rings[0]!),
          ]);
          const vertex = (row * (radial + 1) + side) * 5;
          expect(actual.slice(vertex, vertex + 5)).toEqual(expected);
        }
      }
      actual[0] = 99;
      expect(independent[0]).not.toBe(99);
    }
  });
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
  it("preserves baseline float32 vertices, UVs and cap winding across 256 bounded shapes", () => {
    // Digests captured from main c20036f, before the angular-table optimization.
    // Signed zero and every output byte are part of the parity check.
    const vertexHashes: string[] = [];
    const indexHashes: string[] = [];
    for (const rowCount of [2, 3, 16, 256])
      for (const radial of [3, 16, 64, 128])
        for (const roundness of [0.25, 1, 1.2, 4])
          for (const caps of [0, 1, 2, 3]) {
            const input = {
              rings: new Float64Array(
                Array.from({ length: rowCount * 4 }, (_, index) => {
                  const row = Math.floor(index / 4);
                  return [
                    row * 0.05,
                    0.35 + row * 0.002,
                    0.24 + row * 0.001,
                    row % 2 ? -0.01 : 0.01,
                  ][index % 4]!;
                }),
              ),
              radial,
              roundness,
              caps,
            };
            vertexHashes.push(
              createHash("sha256")
                .update(new Uint8Array(generateRigSectionFallback(input).buffer))
                .digest("hex"),
            );
            indexHashes.push(
              createHash("sha256")
                .update(new Uint8Array(rigSectionIndices(input).buffer))
                .digest("hex"),
            );
          }
    expect(createHash("sha256").update(vertexHashes.join("\n")).digest("hex")).toBe(
      "8d02d4b1b010908bbec4452c0e6dc862f94a4990efbee380df6fac78fb44b09c",
    );
    expect(createHash("sha256").update(indexHashes.join("\n")).digest("hex")).toBe(
      "45419337f2bb6bcc266d37d53ab2d2e755ee6f4259ab36c67fe957564a82e5bf",
    );
  });

  it("evaluates each angle once per section rather than once per ring", () => {
    const input = {
      rings: new Float64Array(
        Array.from({ length: 64 }, (_, index) => {
          const row = Math.floor(index / 4);
          return [row * 0.05, 0.35 + row * 0.002, 0.24 + row * 0.001, 0][index % 4]!;
        }),
      ),
      radial: 64,
      roundness: 1.2,
      caps: 3,
    };
    const sine = vi.spyOn(Math, "sin");
    const cosine = vi.spyOn(Math, "cos");
    try {
      const output = generateRigSectionFallback(input);
      expect(output.every(Number.isFinite)).toBe(true);
      expect(sine).toHaveBeenCalledTimes(input.radial + 1);
      expect(cosine).toHaveBeenCalledTimes(input.radial + 1);
    } finally {
      sine.mockRestore();
      cosine.mockRestore();
    }
  });

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
