import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { initSync, select_crowd } from "../src/game/wasm/pkg/crowd_visibility_wasm.js";
import {
  createCrowdVisibilityLayout,
  decodeCrowdSelection,
  selectCrowdFallback,
} from "../src/game/wasm/crowd-visibility.ts";

initSync({
  module: readFileSync(
    new URL("../src/game/wasm/pkg/crowd_visibility_wasm_bg.wasm", import.meta.url),
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

function rust(input) {
  return decodeCrowdSelection(
    select_crowd(
      layout.positions,
      layout.tiles,
      layout.tileOffsets,
      layout.tileIndices,
      planes,
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
function measure(select, input) {
  for (let step = 0; step < 300; step++) select(input);
  const samples = [];
  let checksum = 0;
  for (let step = 0; step < 2000; step++) {
    const begin = performance.now();
    const selection = select(input);
    samples.push(performance.now() - begin);
    checksum += selection.indices.length;
  }
  samples.sort((a, b) => a - b);
  return { p50Ms: samples[1000], p95Ms: samples[1900], checksum };
}
const scenarios = [];
for (const maxInstances of [768, 4096, 5120]) {
  const input = {
    layout,
    frustumPlanes: planes,
    camera: { x: 60, y: 12, z: 10 },
    projectedScale: 640,
    perspective: true,
    maxTiles: 18,
    maxInstances,
    detailedPixels: 42,
    meshPixels: 28,
  };
  const typescript = measure(selectCrowdFallback, input);
  const wasm = measure(rust, input);
  if (typescript.checksum !== wasm.checksum) throw new Error("Benchmark selection parity failed");
  scenarios.push({ maxInstances, typescript, wasm });
}
const report = {
  generatedAt: new Date().toISOString(),
  node: process.version,
  scope:
    "CPU microbenchmark including JS/WASM copies and decoding; excludes WebGL, frame rate and GPU",
  seats: positions.length,
  tiles: 36,
  iterations: 2000,
  scenarios,
};
await mkdir("verification/stack-wasm-2026-10-03", { recursive: true });
await writeFile(
  "verification/stack-wasm-2026-10-03/crowd-kernel.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report, null, 2));
