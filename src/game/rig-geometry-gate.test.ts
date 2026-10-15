import { describe, expect, it } from "vitest";

import { evaluateGeometryReleaseGate, RUST_GEOMETRY_RELEASE } from "./rig-geometry-gate";

describe("Rust rig-geometry release gate", () => {
  it("does not enable a worker path without comparable full-flow evidence", () => {
    expect(evaluateGeometryReleaseGate([])).toMatchObject({
      enabled: false,
      reason: "incomplete-full-flow-evidence",
    });
    expect(RUST_GEOMETRY_RELEASE.enabled).toBe(false);
  });

  it("requires a 20 percent median gain and preserves first image", () => {
    expect(
      evaluateGeometryReleaseGate([
        { typescriptMs: 10, rustMs: 7, firstImageTypescriptMs: 22, firstImageRustMs: 22 },
        { typescriptMs: 20, rustMs: 14, firstImageTypescriptMs: 18, firstImageRustMs: 18 },
        { typescriptMs: 15, rustMs: 12, firstImageTypescriptMs: 17, firstImageRustMs: 17 },
      ]),
    ).toMatchObject({ enabled: true, reason: "accepted" });
  });

  it("refuses a faster worker when it delays the first rendered image", () => {
    expect(
      evaluateGeometryReleaseGate([
        { typescriptMs: 10, rustMs: 5, firstImageTypescriptMs: 20, firstImageRustMs: 21 },
        { typescriptMs: 10, rustMs: 5, firstImageTypescriptMs: 20, firstImageRustMs: 20 },
        { typescriptMs: 10, rustMs: 5, firstImageTypescriptMs: 20, firstImageRustMs: 20 },
      ]),
    ).toMatchObject({ enabled: false, reason: "first-image-regressed" });
  });
});
