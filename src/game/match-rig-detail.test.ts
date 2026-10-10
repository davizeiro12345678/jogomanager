import { describe, expect, it } from "vitest";
import { denseMatchRig, legacyMatchRigRequested, matchRigSegments } from "./match-rig-detail";
import { segmentsFor } from "./player-model";

describe("match rig screen detail", () => {
  it("restricts the legacy comparison to the isolated fixture", () => {
    expect(legacyMatchRigRequested("/graphics-benchmark.html", "?rigTopology=legacy")).toBe(true);
    expect(legacyMatchRigRequested("/partida-rapida", "?rigTopology=legacy")).toBe(false);
    expect(legacyMatchRigRequested("/graphics-benchmark.html", "")).toBe(false);
  });
  it("retains dense closeups with a stable hysteresis band", () => {
    expect(denseMatchRig(0.2)).toBe(true);
    expect(denseMatchRig(0.18)).toBe(false);
    expect(denseMatchRig(0.18, true)).toBe(true);
    expect(denseMatchRig(0.139, true)).toBe(false);
    expect(denseMatchRig(Number.NaN, true)).toBe(false);
    expect(denseMatchRig(Infinity)).toBe(false);
  });
  it("keeps studio/close geometry and lower quality profiles unchanged", () => {
    expect(matchRigSegments("alta", true)).toEqual(segmentsFor(0));
    expect(matchRigSegments("alta", false)).toEqual({ radial: 16, cap: 6 });
    expect(matchRigSegments("media", false)).toEqual(segmentsFor(1));
    expect(matchRigSegments("baixa", false)).toEqual(segmentsFor(2));
    expect(matchRigSegments("alta", true, true)).toEqual(matchRigSegments("alta", false, true));
  });
});
