import { describe, expect, it } from "vitest";
import { Matrix4 } from "three";
import { CrowdSelectionCameraCache, crowdSectorTeam } from "./crowd-sector";
import {
  CrowdFallbackBuffers,
  createCrowdVisibilityLayout,
  selectCrowdFallback,
} from "./wasm/crowd-visibility";

describe("crowd team sectors", () => {
  it("keeps home/away/neutral sections independent of shirt tint", () => {
    expect(crowdSectorTeam(0, 1)).toBe(1);
    expect(crowdSectorTeam(11, 1)).toBe(-1);
    expect(crowdSectorTeam(5, 1)).toBe(0);
    expect(crowdSectorTeam(4, -1)).toBe(-1);
    expect(crowdSectorTeam(7, -1)).toBe(1);
  });
});

describe("exact fallback camera cache", () => {
  it("avoids repeated real visibility work while keeping the selected seats", () => {
    const positions = Array.from({ length: 200 }, (_, i) => ({ x: i / 10, y: 0, z: 0 }));
    const layout = createCrowdVisibilityLayout(positions, [
      { indices: positions.map((_, i) => i), center: { x: 10, y: 0, z: 0 }, radius: 20 },
    ]);
    const buffers = new CrowdFallbackBuffers(layout);
    const input = {
      layout,
      frustumPlanes: new Float64Array(24),
      camera: { x: 0, y: 0, z: 10 },
      projectedScale: 500,
      perspective: true,
      maxTiles: 1,
      maxInstances: 200,
      detailedPixels: 42,
      meshPixels: 28,
    };
    const matrix = new Matrix4().elements;
    const cache = new CrowdSelectionCameraCache();
    let calls = 0;
    let seats: Uint32Array | undefined;
    for (let i = 0; i < 100; i++) {
      if (cache.unchanged(matrix, matrix, 720, 200, 1, 42, 28, true)) continue;
      seats = selectCrowdFallback(input, buffers).indices;
      calls++;
    }
    expect(calls).toBe(1);
    expect(Array.from(seats!)).toEqual(Array.from(selectCrowdFallback(input, buffers).indices));
  });
  it("invalidates for camera, projection, viewport, budget, LOD and backend changes", () => {
    for (let channel = 0; channel < 38; channel++) {
      const cache = new CrowdSelectionCameraCache();
      const view = new Matrix4().elements;
      const projection = new Matrix4().elements;
      const parameters = [720, 200, 12, 42, 28, 1];
      const sample = () =>
        cache.unchanged(
          view,
          projection,
          parameters[0]!,
          parameters[1]!,
          parameters[2]!,
          parameters[3]!,
          parameters[4]!,
          parameters[5] === 1,
        );
      expect(sample()).toBe(false);
      expect(sample()).toBe(true);
      if (channel < 16) view[channel]! += 1e-12;
      else if (channel < 32) projection[channel - 16]! += 1e-12;
      else parameters[channel - 32]! += 1;
      expect(sample()).toBe(false);
      expect(sample()).toBe(true);
      cache.invalidate();
      expect(sample()).toBe(false);
    }
  });
});
