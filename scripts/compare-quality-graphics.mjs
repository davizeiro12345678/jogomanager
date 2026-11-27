import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const [beforeArg, afterArg, outputArg] = process.argv.slice(2);
if (!beforeArg || !afterArg || !outputArg)
  throw new Error("Usage: node scripts/compare-quality-graphics.mjs BEFORE_JSON AFTER_JSON OUTPUT");
const [before, after] = await Promise.all(
  [beforeArg, afterArg].map(async (file) => JSON.parse(await readFile(file, "utf8"))),
);
const mismatches = [];
for (const key of [
  "quality",
  "browser",
  "adaptive",
  "renderWidth",
  "renderHeight",
  "dpr",
  "warmupSeconds",
  "durationSeconds",
  "headless",
  "highPerformanceGpu",
])
  if (JSON.stringify(before.protocol?.[key]) !== JSON.stringify(after.protocol?.[key]))
    mismatches.push(`requested ${key}`);
const fixtureOptions = (record) => {
  const url = new URL(record.url);
  return { path: url.pathname, options: [...url.searchParams.entries()].sort() };
};
if (JSON.stringify(fixtureOptions(before)) !== JSON.stringify(fixtureOptions(after)))
  mismatches.push("fixture URL options");
for (const key of ["width", "height", "dpr", "scenario", "browser", "backend"])
  if (JSON.stringify(before.sample?.[key]) !== JSON.stringify(after.sample?.[key]))
    mismatches.push(key);
for (const record of [before, after]) {
  const protocol = record.sample?.protocol;
  if (
    record.protocol.quality !== "alta" ||
    record.protocol.browser !== "msedge" ||
    record.protocol.adaptive !== false ||
    record.protocol.renderWidth !== 1280 ||
    record.protocol.renderHeight !== 720 ||
    record.protocol.dpr !== 1
  )
    mismatches.push(`${record.tag}: requested high-quality contract`);
  if (!record.complete || !record.sample?.complete) mismatches.push(`${record.tag}: incomplete`);
  if (record.protocol.headless || record.protocol.videoRecording)
    mismatches.push(`${record.tag}: capture mode`);
  if (
    !protocol ||
    protocol.warmupMs < 60000 ||
    protocol.measurementMs < 300000 ||
    protocol.coveredMs < protocol.measurementMs - 1 ||
    protocol.interruptions ||
    protocol.contractChanged ||
    protocol.adaptive !== false
  )
    mismatches.push(`${record.tag}: protocol`);
  if (record.sample.backend.rendererClass !== "hardware")
    mismatches.push(`${record.tag}: hardware GPU`);
  if (record.errors.length) mismatches.push(`${record.tag}: JavaScript errors`);
}
for (const key of ["warmupMs", "measurementMs", "adaptive"])
  if (before.sample.protocol[key] !== after.sample.protocol[key])
    mismatches.push(`measured ${key}`);
const names = [
  "fps",
  "onePercentLow",
  "p50",
  "p95",
  "p99",
  "maxMs",
  "stalls",
  "draws",
  "maxDraws",
  "triangles",
  "heapUsedBytes",
  "geometries",
  "textures",
  "programs",
  "firstFrameMs",
  "longTasks",
  "longTaskMs",
];
const metrics = names.map((name) => {
  const baseline = before.sample[name],
    candidate = after.sample[name];
  return {
    name,
    baseline,
    candidate,
    changePercent:
      Number.isFinite(baseline) && baseline > 0 && Number.isFinite(candidate)
        ? (candidate / baseline - 1) * 100
        : null,
  };
});
const report = {
  before: path.resolve(beforeArg),
  after: path.resolve(afterArg),
  generatedAt: new Date().toISOString(),
  comparable: mismatches.length === 0,
  mismatches,
  device: after.sample.backend,
  protocol: after.sample.protocol,
  metrics,
  requestedMean60ReachedInThisRun: mismatches.length === 0 && after.sample.fps >= 60,
  peakDrawBudget: {
    limit: 260,
    observed: after.sample.maxDraws,
    passes: after.sample.maxDraws <= 260,
  },
  acceptedExtendedCampaign: false,
  limitation:
    "One matched 300-second NVIDIA pair. Three equivalent runs on both GPUs have not been completed. Whole-run long tasks include warmup; first-frame and resource changes are observations, not isolated causal attribution.",
};
await writeFile(path.resolve(outputArg), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
if (mismatches.length) process.exitCode = 1;
