import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { initSync, select_crowd } from "./pkg/crowd_visibility_wasm";
import {
  createCrowdVisibilityLayout,
  decodeCrowdSelection,
  selectCrowdFallback,
  type CrowdVisibilityInput,
} from "./crowd-visibility";

beforeAll(() => {
  initSync({
    module: readFileSync(new URL("./pkg/crowd_visibility_wasm_bg.wasm", import.meta.url)),
  });
});

function selectRust(input: CrowdVisibilityInput) {
  return decodeCrowdSelection(
    select_crowd(
      input.layout.positions,
      input.layout.tiles,
      input.layout.tileOffsets,
      input.layout.tileIndices,
      input.frustumPlanes,
      new Float64Array([input.camera.x, input.camera.y, input.camera.z]),
      input.projectedScale,
      input.perspective,
      input.maxTiles,
      input.maxInstances,
      input.detailedPixels,
      input.meshPixels,
    ),
  );
}

const positions = Array.from({ length: 4320 }, (_, seat) => {
  const tile = Math.floor(seat / 120);
  const angle = ((tile % 12) * Math.PI) / 6 + (seat % 10) * 0.008;
  const radius = 64 + Math.floor(tile / 12) * 6 + Math.floor((seat % 120) / 10) * 0.3;
  return {
    x: Math.cos(angle) * radius,
    y: 4 + Math.floor(tile / 12) * 6,
    z: Math.sin(angle) * radius,
  };
});
const layout = createCrowdVisibilityLayout(
  positions,
  Array.from({ length: 36 }, (_, tile) => ({
    indices: Array.from({ length: 120 }, (_, seat) => tile * 120 + seat),
    center: positions[tile * 120 + 55]!,
    radius: 7,
  })),
);

describe("compiled Rust/WASM crowd parity", () => {
  it("matches TypeScript on wide, close, orthographic and look-away camera fixtures", () => {
    for (const camera of [
      { x: 0, y: 20, z: 0 },
      { x: 60, y: 8, z: 10 },
      { x: -80, y: 30, z: 0 },
    ]) {
      for (const perspective of [true, false]) {
        for (const maxInstances of [0, 1, 768, 4096, 5120]) {
          for (const extent of [100, 25, -200]) {
            const input: CrowdVisibilityInput = {
              layout,
              camera,
              perspective,
              maxInstances,
              maxTiles: 18,
              projectedScale: 640,
              detailedPixels: 42,
              meshPixels: 28,
              frustumPlanes: new Float64Array([
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
              ]),
            };
            const expected = selectCrowdFallback(input);
            const actual = selectRust(input);
            expect(actual.indices).toEqual(expected.indices);
            expect(actual.tiers).toEqual(expected.tiers);
            expect(actual.counts).toEqual(expected.counts);
          }
        }
      }
    }
  });

  it("keeps deterministic tile ties and LOD threshold boundaries", () => {
    const tiedLayout = createCrowdVisibilityLayout(
      [
        { x: 1, y: 0, z: 0 },
        { x: -1, y: 0, z: 0 },
      ],
      [
        { indices: [0], center: { x: 1, y: 0, z: 0 }, radius: 1 },
        { indices: [1], center: { x: -1, y: 0, z: 0 }, radius: 1 },
      ],
    );
    for (const projectedScale of [27.999, 28, 41.999, 42]) {
      const input: CrowdVisibilityInput = {
        layout: tiedLayout,
        camera: { x: 0, y: 0, z: 0 },
        perspective: true,
        frustumPlanes: new Float64Array(),
        maxTiles: 2,
        maxInstances: 2,
        projectedScale,
        detailedPixels: 42,
        meshPixels: 28,
      };
      expect(selectRust(input)).toEqual(selectCrowdFallback(input));
    }
  });
});
