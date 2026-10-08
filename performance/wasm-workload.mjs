/** Whole-process workload for CodSpeed's exec harness. No local timing data. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as wasm from "./wasm-snapshot/pkg/crowd_visibility_wasm.js";
import * as crowd from "./wasm-snapshot/crowd-visibility.ts";
const { initSync, select_crowd } = wasm;
const { createCrowdVisibilityLayout, decodeCrowdSelection, selectCrowdFallback } = crowd;
const [mode = "production", budgetArg = "4096"] = process.argv.slice(2);
const verify = mode === "verify";
if (!verify && !["production", "stateless", "fallback"].includes(mode))
  throw new Error("Unknown WASM workload");
const budget = Number(budgetArg);
if (![768, 4096, 5120].includes(budget)) throw new Error("Unknown crowd budget");
initSync({
  module: readFileSync(
    new URL("./wasm-snapshot/pkg/crowd_visibility_wasm_bg.wasm", import.meta.url),
  ),
});
const positions = Array.from({ length: 8640 }, (_, seat) => {
  const tile = Math.floor(seat / 240);
  const angle = ((tile % 12) * Math.PI) / 6 + (seat % 20) * 0.006;
  const radius = 64 + Math.floor(tile / 12) * 6 + Math.floor((seat % 240) / 20) * 0.3;
  return {
    x: Math.cos(angle) * radius,
    y: 4 + Math.floor(tile / 12) * 6,
    z: Math.sin(angle) * radius,
  };
});
const layout = createCrowdVisibilityLayout(
  positions,
  Array.from({ length: 36 }, (_, tile) => ({
    indices: Array.from({ length: 240 }, (_, seat) => tile * 240 + seat),
    center: positions[tile * 240 + 115],
    radius: 8,
  })),
);
const planes = new Float64Array([
  1, 0, 0, 100, -1, 0, 0, 100, 0, 1, 0, 100, 0, -1, 0, 100, 0, 0, 1, 100, 0, 0, -1, 100,
]);
const camera = new Float64Array([60, 12, 10]);
const selector = wasm.CrowdSelector ? new wasm.CrowdSelector(
  layout.positions,
  layout.tiles,
  layout.tileOffsets,
  layout.tileIndices,
) : null;
const scratch = crowd.CrowdFallbackBuffers ? new crowd.CrowdFallbackBuffers(layout) : undefined;
let selection = null;
function select(kind, maxInstances) {
  if (kind === "fallback")
    return selectCrowdFallback(
      {
        layout,
        frustumPlanes: planes,
        camera: { x: camera[0], y: camera[1], z: camera[2] },
        projectedScale: 640,
        perspective: true,
        maxTiles: 18,
        maxInstances,
        detailedPixels: 42,
        meshPixels: 28,
      },
      scratch,
    );
  const packed =
    kind === "production" && selector
      ? selector.select(planes, camera, 640, true, 18, maxInstances, 42, 28)
      : select_crowd(
          layout.positions,
          layout.tiles,
          layout.tileOffsets,
          layout.tileIndices,
          planes,
          camera,
          640,
          true,
          18,
          maxInstances,
          42,
          28,
        );
  selection = decodeCrowdSelection(packed, selection);
  return selection;
}
try {
  if (verify) {
    for (const count of [768, 4096, 5120]) {
      const expected = select("fallback", count);
      assert.deepEqual(select("production", count), expected);
      assert.deepEqual(select("stateless", count), expected);
    }
    console.log("CodSpeed workloads: WASM/fallback parity verified (no timing measurement)");
  } else {
    let checksum = 0;
    for (let step = 0; step < 256; step++) {
      camera[0] = 60 + (step % 5);
      const result = select(mode, budget);
      checksum += result.indices.length + result.indices[0];
    }
    console.log(JSON.stringify({ mode, budget, checksum, calls: 256 }));
  }
} finally {
  selector?.free();
}
