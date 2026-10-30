import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";

const [baselineFile, candidateFile] = process.argv.slice(2);
if (!baselineFile || !candidateFile) {
  throw new Error("Usage: node scripts/compare-rig-wasm.mjs BASELINE.wasm CANDIDATE.wasm");
}
const binding = pathToFileURL(path.resolve("src/game/wasm/pkg/crowd_visibility_wasm.js")).href;
const baseline = await import(`${binding}?baseline`);
const candidate = await import(`${binding}?candidate`);
baseline.initSync({ module: readFileSync(baselineFile) });
candidate.initSync({ module: readFileSync(candidateFile) });

let cases = 0;
for (const rows of [2, 5, 16, 40]) {
  const rings = new Float64Array(rows * 4);
  for (let row = 0; row < rows; row++) {
    rings[row * 4] = row === 0 ? -0 : (row - 3) * 0.071;
    rings[row * 4 + 1] = ((row % 3) - 1) * 0.15;
    rings[row * 4 + 2] = 0.04 + row * 0.01;
    rings[row * 4 + 3] = row % 2 ? 0 : -0;
  }
  for (const radial of [3, 4, 7, 16, 64, 128]) {
    for (const roundness of [0.25, 0.5, 1, 1.2, 4]) {
      for (const caps of [0, 1, 2, 3]) {
        const before = baseline.generate_rig_section(rings, radial, roundness, caps);
        const after = candidate.generate_rig_section(rings, radial, roundness, caps);
        assert.deepStrictEqual(
          Buffer.from(before.buffer),
          Buffer.from(after.buffer),
          `Output changed: rows=${rows} radial=${radial} roundness=${roundness} caps=${caps}`,
        );
        cases++;
      }
    }
  }
}
const rings = new Float64Array(
  Array.from({ length: 64 }, (_, index) => {
    const row = Math.floor(index / 4);
    switch (index % 4) {
      case 0:
        return row * 0.05;
      case 1:
        return 0.35 + row * 0.002;
      case 2:
        return 0.24 + row * 0.001;
      default:
        return 0;
    }
  }),
);
const median = (values) => {
  const sorted = values.toSorted((a, b) => a - b);
  return (sorted[3] + sorted[4]) / 2;
};
const measurements = [];
let sink = 0;
for (const radial of [16, 64]) {
  const iterations = radial === 16 ? 4000 : 1500;
  const sample = (module) => {
    const start = process.hrtime.bigint();
    for (let i = 0; i < iterations; i++) {
      const output = module.generate_rig_section(rings, radial, 1.2, 3);
      sink += output.length;
    }
    return Number(process.hrtime.bigint() - start) / iterations / 1e3;
  };
  sample(baseline);
  sample(candidate);
  const before = [],
    after = [];
  for (let pass = 0; pass < 4; pass++) {
    before.push(sample(baseline));
    after.push(sample(candidate));
    after.push(sample(candidate));
    before.push(sample(baseline));
  }
  const baselineUs = median(before),
    candidateUs = median(after);
  measurements.push({
    radial,
    baselineUs,
    candidateUs,
    speedup: baselineUs / candidateUs,
    durationReduction: 1 - candidateUs / baselineUs,
    baselineSamplesUs: before,
    candidateSamplesUs: after,
  });
}
console.log(JSON.stringify({ cases, byteIdentical: true, measurements, sink }, null, 2));
