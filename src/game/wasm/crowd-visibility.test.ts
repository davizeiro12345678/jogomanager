import { describe, expect, it, vi } from "vitest";

import {
  createCrowdVisibilityLayout,
  CrowdFallbackBuffers,
  decodeCrowdSelection,
  selectCrowdFallback,
} from "./crowd-visibility";

const boxFrustum = (extent: number) =>
  new Float64Array([
    1,
    0,
    0,
    extent,
    -1,
    0,
    0,
    extent,
    0,
    1,
    0,
    extent,
    0,
    -1,
    0,
    extent,
    0,
    0,
    1,
    extent,
    0,
    0,
    -1,
    extent,
  ]);

describe("crowd visibility kernel contract", () => {
  const positions = [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 8, y: 0, z: 0 },
    { x: 26, y: 0, z: 0 },
  ];
  const layout = createCrowdVisibilityLayout(positions, [
    { indices: [0, 1], center: { x: 0.5, y: 0, z: 0 }, radius: 1.5 },
    { indices: [2], center: { x: 8, y: 0, z: 0 }, radius: 1 },
    { indices: [3], center: { x: 26, y: 0, z: 0 }, radius: 1 },
  ]);

  it("keeps the visible tiles closest to the camera and assigns the same LOD thresholds", () => {
    const result = selectCrowdFallback({
      layout,
      frustumPlanes: boxFrustum(5),
      camera: { x: 0, y: 0, z: 5 },
      projectedScale: 100,
      perspective: true,
      maxTiles: 2,
      maxInstances: 3,
      detailedPixels: 25,
      meshPixels: 15,
    });

    expect([...result.indices]).toEqual([0, 1]);
    expect([...result.tiers]).toEqual([1, 1]);
    expect([...result.counts]).toEqual([0, 2, 0]);
  });

  it("uses the stable first tiles when a camera looks away from every stand", () => {
    const result = selectCrowdFallback({
      layout,
      frustumPlanes: boxFrustum(-100),
      camera: { x: 0, y: 0, z: 0 },
      projectedScale: 80,
      perspective: false,
      maxTiles: 2,
      maxInstances: 3,
      detailedPixels: 52,
      meshPixels: 34,
    });

    expect([...result.indices]).toEqual([0, 1, 2]);
    expect([...result.tiers]).toEqual([0, 0, 0]);
    expect([...result.counts]).toEqual([3, 0, 0]);
  });

  it("decodes the compact Rust transport without allocating object records", () => {
    const result = decodeCrowdSelection(new Uint32Array([(512 << 2) | 2, (7 << 2) | 0]));

    expect([...result.indices]).toEqual([512, 7]);
    expect([...result.tiers]).toEqual([2, 0]);
    expect([...result.counts]).toEqual([1, 0, 1]);
  });

  it("reuses response buffers and resets counts on the next selection", () => {
    const first = decodeCrowdSelection(new Uint32Array([2, 4]));
    const next = decodeCrowdSelection(new Uint32Array([9, 13]), first);
    expect(next).toBe(first);
    expect([...next.indices]).toEqual([2, 3]);
    expect([...next.tiers]).toEqual([1, 1]);
    expect([...next.counts]).toEqual([0, 2, 0]);
  });

  it("retains fallback capacity across camera changes and clears an empty result", () => {
    const scratch = new CrowdFallbackBuffers(layout);
    const input = {
      layout,
      frustumPlanes: boxFrustum(100),
      camera: { x: 0, y: 0, z: 0 },
      projectedScale: 100,
      perspective: true,
      maxTiles: 3,
      maxInstances: 4,
      detailedPixels: 42,
      meshPixels: 28,
    };
    const first = selectCrowdFallback(input, scratch);
    const buffer = first.indices.buffer;
    const firstCopy = [...first.indices];
    const next = selectCrowdFallback({ ...input, camera: { x: 25, y: 0, z: 0 } }, scratch);
    expect(next.indices.buffer).toBe(buffer);
    expect([...next.indices]).not.toEqual(firstCopy);
    const independent = selectCrowdFallback(input);
    const saved = [...independent.indices];
    expect(selectCrowdFallback({ ...input, maxInstances: 0 }, scratch).indices.length).toBe(0);
    expect([...scratch.counts]).toEqual([0, 0, 0]);
    selectCrowdFallback(input, scratch);
    expect([...independent.indices]).toEqual(saved);
  });

  it("resizes reused transport safely without stale seats or counts", () => {
    const first = decodeCrowdSelection(new Uint32Array([2, 4]));
    const empty = decodeCrowdSelection(new Uint32Array(), first);
    expect(empty).not.toBe(first);
    expect(empty.indices).toHaveLength(0);
    expect([...empty.counts]).toEqual([0, 0, 0]);
    const grown = decodeCrowdSelection(new Uint32Array([0, 5, 10]), empty);
    expect([...grown.indices]).toEqual([0, 1, 2]);
    expect([...grown.tiers]).toEqual([0, 1, 2]);
    expect([...grown.counts]).toEqual([1, 1, 1]);
    expect([...first.counts]).toEqual([1, 0, 1]);
  });
  it("bounds large all-tile ordering work and preserves distance/index ties", () => {
    const count = 512;
    const positions = Array.from({ length: count }, (_, index) => ({
      x: Math.floor((count - 1 - index) / 2),
      y: 0,
      z: 0,
    }));
    const large = createCrowdVisibilityLayout(
      positions,
      positions.map((center, index) => ({
        center,
        indices: [index],
        radius: 1,
      })),
    );
    const scratch = new CrowdFallbackBuffers(large);
    const comparisons = vi.spyOn(scratch, "compareTiles");
    const selected = selectCrowdFallback(
      {
        layout: large,
        frustumPlanes: new Float64Array(),
        camera: { x: 0, y: 0, z: 0 },
        projectedScale: 1,
        perspective: false,
        maxTiles: count,
        maxInstances: count,
        detailedPixels: 2,
        meshPixels: 1,
      },
      scratch,
    );
    expect([...selected.indices.slice(0, 8)]).toEqual([510, 511, 508, 509, 506, 507, 504, 505]);
    expect(selected.indices).toHaveLength(count);
    expect(comparisons.mock.calls.length).toBeLessThan(count * Math.ceil(Math.log2(count)) * 4);
  });
});
