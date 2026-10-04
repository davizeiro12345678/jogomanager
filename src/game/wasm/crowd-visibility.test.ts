import { describe, expect, it } from "vitest";

import {
  createCrowdVisibilityLayout,
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
});
