import { performance } from "node:perf_hooks";
import { writeFileSync } from "node:fs";
import { cpus } from "node:os";
const root = "/workspace/scratch/";
const paths = ["bench-base-ac3aa", "bench-candidate-72389"];
const modules = await Promise.all(
  paths.map(async (path) => ({
    contact: await import(root + path + "/src/game/ground-contact.ts"),
    core: await import(root + path + "/src/game/animation-core.ts"),
    model: await import(root + path + "/src/game/player-model.ts"),
    gait: await import(root + path + "/src/game/gait-kinematics.ts"),
  })),
);
// One baseline-generated immutable fixture feeds both implementations.
const m = modules[0],
  P = m.model.proportionsFor(m.model.lookFor("bench-presentation-MF", "MF", true));
const fixtures = Array.from({ length: 22 }, (_, i) => ({
  P,
  pose: m.gait.gaitPoseAt((i / 22) * Math.PI * 2, i % 3 === 0 ? 0 : 5.5, P).pose,
  hipShiftX: Math.sin(i) * 0.015,
  hipRollOffset: 0.015,
  leanX: 0.04,
  leanZ: Math.cos(i) * 0.025,
  airborne: 0,
  previousRootY: 0.01,
  dt: 1 / 60,
  plantedFoot: i % 2 === 0 ? "left" : "right",
}));
const loops = 5000;
function run(index, n = loops) {
  const solve = modules[index].contact.solveGroundContact;
  let checksum = 0;
  const start = performance.now();
  for (let j = 0; j < n; j++)
    for (const f of fixtures) {
      const r = solve(f);
      checksum += r.rootY + r.ankleLFix + r.ankleRFix;
    }
  return { index, ms: performance.now() - start, checksum, calls: n * 22 };
}
let maxDelta = 0;
for (const f of fixtures) {
  const a = modules[0].contact.solveGroundContact(f),
    b = modules[1].contact.solveGroundContact(f);
  for (const k of Object.keys(a)) maxDelta = Math.max(maxDelta, Math.abs(a[k] - b[k]));
}
for (let i = 0; i < 4; i++) {
  run(0, 100);
  run(1, 100);
}
const samples = [];
for (let i = 0; i < 7; i++) for (const index of i % 2 ? [1, 0] : [0, 1]) samples.push(run(index));
const median = (a) => a.toSorted((x, y) => x - y)[Math.floor(a.length / 2)];
const medians = [0, 1].map((i) => median(samples.filter((s) => s.index === i).map((s) => s.ms)));
const output = {
  baseline: "ac3aa26987317c3ee6b2b9fdbc68aed7b5e1f3e7",
  candidate: "72389e6434a54c0cd80d63539a953675e7d9c8eb",
  node: process.version,
  cpu: cpus()[0].model,
  workload:
    "22 static grounded athlete fixtures × 5000 batches/run;7 runs/revision;alternating AB/BA;4 warmups/revision",
  maxDelta,
  samples,
  medians,
  percent: (medians[1] / medians[0] - 1) * 100,
};
writeFileSync(root + "contact-comparison.json", JSON.stringify(output, null, 2));
console.log(JSON.stringify(output));
