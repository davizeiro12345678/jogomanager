import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import {
  CrowdSelector,
  initSync,
  select_crowd,
  wasm_abi_version,
  wasm_capabilities,
  crowd_max_seats,
  crowd_max_tiles,
  crowd_max_references,
} from "./pkg/crowd_visibility_wasm";
import {
  createCrowdVisibilityLayout,
  CrowdFallbackBuffers,
  decodeCrowdSelection,
  selectCrowdFallback,
  type CrowdVisibilityInput,
} from "./crowd-visibility";

let wasmMemory: WebAssembly.Memory;
beforeAll(() => {
  wasmMemory = initSync({
    module: readFileSync(new URL("./pkg/crowd_visibility_wasm_bg.wasm", import.meta.url)),
  }).memory;
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
  it("exports the versioned ABI, capabilities and bounded layout contract", () => {
    expect(wasm_abi_version()).toBe(1);
    // Additive capabilities may grow without changing the major ABI.
    expect(wasm_capabilities() & 127).toBe(127);
    expect(wasm_capabilities() & 128).toBe(128);
    expect(crowd_max_seats()).toBe(262_144);
    expect(crowd_max_tiles()).toBe(65_536);
    expect(crowd_max_references()).toBe(1_048_576);
  });

  it("writes into JS-owned buffers with capacity bounds and preserved ownership", () => {
    const selector = new CrowdSelector(
      layout.positions,
      layout.tiles,
      layout.tileOffsets,
      layout.tileIndices,
    );
    const planes = new Float64Array();
    const eye = new Float64Array([60, 12, 10]);
    try {
      for (const capacity of [0, 1, 768, 4096, 5120]) {
        const output = new Uint32Array(capacity + 3).fill(0xdeadbeef);
        const target = output.subarray(0, capacity);
        const expected = selector.select(planes, eye, 640, true, 18, capacity, 42, 28);
        const length = selector.select_into(planes, eye, 640, true, 18, 5120, 42, 28, target);
        expect(output.subarray(0, length)).toEqual(expected);
        expect(Array.from(output.subarray(capacity))).toEqual([0xdeadbeef, 0xdeadbeef, 0xdeadbeef]);
        const saved = output.slice();
        selector.select(planes, eye, 100, false, 4, 10, 42, 28);
        expect(output).toEqual(saved);
      }
    } finally {
      selector.free();
    }
  });

  it("rejects oversized direct layouts before copying them into WASM memory", () => {
    const base = [
      new Float64Array(3),
      new Float64Array([0, 0, 0, 1]),
      new Uint32Array([0, 1]),
      new Uint32Array([0]),
    ] as const;
    const replacements = [
      new Float64Array(crowd_max_seats() * 3 + 1),
      new Float64Array(crowd_max_tiles() * 4 + 1),
      new Uint32Array(crowd_max_tiles() + 2),
      new Uint32Array(crowd_max_references() + 1),
    ];
    for (let field = 0; field < 4; field++) {
      const args = [...base];
      args[field] = replacements[field]!;
      const [positions, tiles, offsets, references] = args;
      const bytesBefore = wasmMemory.buffer.byteLength;
      expect(
        select_crowd(
          positions as Float64Array,
          tiles as Float64Array,
          offsets as Uint32Array,
          references as Uint32Array,
          new Float64Array(),
          new Float64Array(3),
          1,
          false,
          1,
          1,
          2,
          1,
        ),
      ).toHaveLength(0);
      // wasm-bindgen may initialize its externref bookkeeping on the first
      // direct call (one 64 KiB page). Even the smallest rejected buffer would
      // require four pages if copied; the rejected data must stay in JS.
      expect(wasmMemory.buffer.byteLength - bytesBefore).toBeLessThanOrEqual(65_536);
      const selector = new CrowdSelector(
        positions as Float64Array,
        tiles as Float64Array,
        offsets as Uint32Array,
        references as Uint32Array,
      );
      try {
        expect(
          selector.select(new Float64Array(), new Float64Array(3), 1, false, 1, 1, 2, 1),
        ).toHaveLength(0);
      } finally {
        selector.free();
      }
    }
  });

  it("copies only the camera/frustum prefix and preserves incomplete-frustum visibility", () => {
    const one = createCrowdVisibilityLayout(
      [{ x: 0, y: 0, z: 0 }],
      [{ indices: [0], center: { x: 0, y: 0, z: 0 }, radius: 1 }],
    );
    const selector = new CrowdSelector(one.positions, one.tiles, one.tileOffsets, one.tileIndices);
    try {
      const short = new Float64Array([1, 0, 0, -100]);
      expect([...selector.select(short, new Float64Array(3), 1, false, 1, 1, 2, 1)]).toEqual([1]);
      const oversizedPlanes = new Float64Array(1_000_000).fill(NaN);
      for (let plane = 0; plane < 6; plane++) oversizedPlanes.set([0, 0, 0, 1], plane * 4);
      const oversizedCamera = new Float64Array(1_000_000).fill(NaN);
      oversizedCamera.set([0, 0, 0]);
      const bytesBefore = wasmMemory.buffer.byteLength;
      expect([...selector.select(oversizedPlanes, oversizedCamera, 1, false, 1, 1, 2, 1)]).toEqual([
        1,
      ]);
      expect(wasmMemory.buffer.byteLength).toBe(bytesBefore);
      expect([
        ...select_crowd(
          one.positions,
          one.tiles,
          one.tileOffsets,
          one.tileIndices,
          short,
          oversizedCamera,
          1,
          false,
          1,
          1,
          2,
          1,
        ),
      ]).toEqual([1]);
    } finally {
      selector.free();
    }
  });

  it("does not trap on 2048 mixed NaN tile distances and matches the TypeScript order", () => {
    const points = Array.from({ length: 2048 }, (_, i) => ({ x: i, y: 0, z: 0 }));
    const malformed = createCrowdVisibilityLayout(
      points,
      points.map((center, i) => ({
        center,
        radius: 1,
        indices: [i],
      })),
    );
    let seed = 0x12345678;
    for (let i = 0; i < 2048; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      malformed.tiles[i * 4] = (seed & 3) === 0 ? NaN : seed % 1000;
    }
    for (const x of [0, NaN, Infinity]) {
      const input: CrowdVisibilityInput = {
        layout: malformed,
        camera: { x, y: 0, z: 0 },
        perspective: false,
        frustumPlanes: new Float64Array(),
        maxTiles: 2048,
        maxInstances: 2048,
        projectedScale: 1,
        detailedPixels: 2,
        meshPixels: 1,
      };
      expect(selectRust(input)).toEqual(selectCrowdFallback(input));
    }
  });

  it("bounds corrupted overlapping references identically in Rust and TypeScript", () => {
    const malformed = createCrowdVisibilityLayout(
      [{ x: 0, y: 0, z: 0 }],
      [
        { center: { x: 0, y: 0, z: 0 }, radius: 1, indices: [0, 0] },
        { center: { x: 1, y: 0, z: 0 }, radius: 1, indices: [] },
        { center: { x: 2, y: 0, z: 0 }, radius: 1, indices: [] },
      ],
    );
    malformed.tileOffsets.set([0, 2, 0, 2]);
    const input: CrowdVisibilityInput = {
      layout: malformed,
      camera: { x: 0, y: 0, z: 0 },
      perspective: false,
      frustumPlanes: new Float64Array(),
      maxTiles: 3,
      maxInstances: 0xffffffff,
      projectedScale: 1,
      detailedPixels: 2,
      meshPixels: 1,
    };
    expect(selectRust(input)).toEqual(selectCrowdFallback(input));
    expect(selectRust(input).indices).toHaveLength(2);
  });

  it("retains one Rust layout across camera changes without changing selection", () => {
    const selector = new CrowdSelector(
      layout.positions,
      layout.tiles,
      layout.tileOffsets,
      layout.tileIndices,
    );
    try {
      for (const x of [0, 60, -80]) {
        const input: CrowdVisibilityInput = {
          layout,
          camera: { x, y: 8, z: 10 },
          perspective: true,
          frustumPlanes: new Float64Array(),
          maxInstances: 5120,
          maxTiles: 18,
          projectedScale: 640,
          detailedPixels: 42,
          meshPixels: 28,
        };
        const result = selector.select(
          input.frustumPlanes,
          new Float64Array([x, 8, 10]),
          640,
          true,
          18,
          5120,
          42,
          28,
        );
        expect(decodeCrowdSelection(result)).toEqual(selectRust(input));
      }
    } finally {
      selector.free();
    }
  });
  it("matches TypeScript on wide, close, orthographic and look-away camera fixtures", () => {
    const scratch = new CrowdFallbackBuffers(layout);
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
            const expected = selectCrowdFallback(input, scratch);
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
