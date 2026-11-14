/**
 * Compare complete per-frame evidence, not averages of Lighthouse scores or
 * one-second p95 windows. No hardware measurements are invented here.
 *
 * Input: {runs:[{revision,setup,report,temperatureC?}, ...]} for baseline/head.
 * report is a single captured FrameCampaign.snapshot(true), including the
 * complete chronological rawFrameMs array. "setup" records device/GPU/driver/
 * browser/viewport, scene/camera/weather/seed/preset and capture protocol.
 *
 * CLI: node scripts/compare-frame-campaigns.mjs baseline.json candidate.json
 * The full acceptance protocol requires three runs on the SAME device/software,
 * 30s warmup and 10m active render time each. FPS drift is NOT a temperature
 * measurement; temperatureC needs a separately captured hardware sensor.
 */
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const REQUIRED_SETUP = [
  "device", "gpu", "driver", "browser", "renderer", "viewport",
  "quality", "scene", "camera", "weather", "timeOfDay", "seed",
];
const DEFAULT_REQUIREMENTS = Object.freeze({
  repetitions: 3,
  warmupMs: 30_000,
  measuredMs: 600_000,
  thermalWindowMs: 60_000,
});

function assert(condition, reason) {
  if (!condition) throw new Error(reason);
}

function quantile(sorted, p) {
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * p) - 1))];
}

function intervalsByTime(raw, start, end) {
  const taken = [];
  let time = 0;
  for (const interval of raw) {
    const middle = time + interval * 0.5;
    if (middle >= start && middle < end) taken.push(interval);
    time += interval;
  }
  return taken;
}

function frameStats(intervals) {
  assert(intervals.length >= 2, "Insufficient completed renders in frame interval window");
  const sorted = intervals.slice().sort((a, b) => a - b);
  const total = intervals.reduce((sum, x) => sum + x, 0);
  const slow = sorted.slice(-Math.max(1, Math.ceil(sorted.length * 0.01)));
  const slowMean = slow.reduce((sum, x) => sum + x, 0) / slow.length;
  return {
    frames: intervals.length,
    fps: (1000 * intervals.length) / total,
    p50Ms: quantile(sorted, 0.5),
    p95Ms: quantile(sorted, 0.95),
    p99Ms: quantile(sorted, 0.99),
    onePercentLowFps: 1000 / slowMean,
    framesOver50Ms: intervals.filter((x) => x > 50).length,
  };
}

function setupFingerprint(setup) {
  assert(setup && typeof setup === "object" && !Array.isArray(setup), "Missing setup");
  for (const field of REQUIRED_SETUP)
    assert(setup[field] !== undefined && setup[field] !== null && setup[field] !== "", `Missing setup.${field}`);
  const viewport = setup.viewport;
  assert(
    viewport && Number.isFinite(viewport.width) && viewport.width > 0 &&
    Number.isFinite(viewport.height) && viewport.height > 0 &&
    Number.isFinite(viewport.dpr) && viewport.dpr > 0,
    "Invalid physical render viewport",
  );
  const ordered = Object.fromEntries(REQUIRED_SETUP.map((key) => [key, setup[key]]));
  return JSON.stringify(ordered);
}

export function summarizeCampaignRun(run, requirements = DEFAULT_REQUIREMENTS) {
  assert(/^[a-f0-9]{40}$/.test(run?.revision ?? ""), "Full immutable SHA required");
  const fingerprint = setupFingerprint(run.setup);
  assert(run.recordVideo !== true, "Recorded video captures cannot certify FPS");
  assert(run.headless !== true, "Headless captures cannot certify physical GPU FPS");
  const report = run.report;
  assert(report?.context?.phase === "match" || report?.context?.phase === "cutscene", "Invalid campaign phase");
  assert(report?.quantilesScope === "whole-campaign", "Truncated quantile scope");
  assert(report?.summary?.coverage?.completeDistribution === true, "Incomplete frame distribution");
  assert(report?.interruptions === 0, "Paused or hidden campaign is not comparable");
  assert(report?.captureDroppedFrames === undefined || report.captureDroppedFrames === 0, "Dropped captured frames");
  assert(Array.isArray(report.rawFrameMs), "Missing chronological rawFrameMs");
  const raw = report.rawFrameMs;
  assert(raw.length > 2 && raw.length <= 90_000, "Frame evidence outside bounded retention");
  assert(raw.every((x) => typeof x === "number" && Number.isFinite(x) && x > 0 && x <= 1000), "Invalid frame interval");
  const measuredTotal = raw.reduce((sum, x) => sum + x, 0);
  const afterWarmup = measuredTotal - requirements.warmupMs;
  assert(afterWarmup >= requirements.measuredMs, "Insufficient active measurement after warmup");
  const measured = intervalsByTime(raw, requirements.warmupMs, measuredTotal);
  const first = intervalsByTime(raw, requirements.warmupMs, requirements.warmupMs + requirements.thermalWindowMs);
  const last = intervalsByTime(raw, measuredTotal - requirements.thermalWindowMs, measuredTotal);
  const early = frameStats(first);
  const late = frameStats(last);
  const temperature = run.temperatureC;
  const sensorRecorded = temperature &&
    typeof temperature === "object" &&
    Number.isFinite(temperature.start) && Number.isFinite(temperature.end) &&
    typeof temperature.sensor === "string" && temperature.sensor.trim().length > 0;
  return {
    revision: run.revision,
    setup: run.setup,
    fingerprint,
    phase: report.context.phase,
    campaignKey: report.context.key,
    seconds: afterWarmup / 1000,
    stats: frameStats(measured),
    drift: {
      first60sP95Ms: early.p95Ms,
      last60sP95Ms: late.p95Ms,
      p95IncreaseMs: late.p95Ms - early.p95Ms,
      first60sFps: early.fps,
      last60sFps: late.fps,
      fpsLossPct: early.fps > 0 ? (100 * (early.fps - late.fps)) / early.fps : null,
    },
    thermal: sensorRecorded
      ? { sensor: temperature.sensor, startC: temperature.start, endC: temperature.end, deltaC: temperature.end - temperature.start }
      : { status: "sensor-data-unavailable; FPS drift is not a thermal reading" },
  };
}

function median(values) {
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
}

export function compareFrameCampaigns(baseManifest, headManifest, requirements = DEFAULT_REQUIREMENTS) {
  const base = baseManifest?.runs;
  const head = headManifest?.runs;
  assert(
    Array.isArray(base) && Array.isArray(head) &&
    base.length === requirements.repetitions &&
    head.length === requirements.repetitions,
    "Exactly the required paired repetitions must be present",
  );
  const pair = base.map((run, i) => ({
    base: summarizeCampaignRun(run, requirements),
    head: summarizeCampaignRun(head[i], requirements),
  }));
  const fingerprint = pair[0].base.fingerprint;
  const campaignKey = pair[0].base.campaignKey;
  const phase = pair[0].base.phase;
  const baseRevision = pair[0].base.revision;
  const headRevision = pair[0].head.revision;
  for (const p of pair) {
    assert(p.base.fingerprint === fingerprint && p.head.fingerprint === fingerprint, "Hardware/software/scene mismatch: comparisons refused");
    assert(p.base.campaignKey === campaignKey && p.head.campaignKey === campaignKey && p.base.phase === phase && p.head.phase === phase, "Mismatched campaign context");
    assert(p.base.revision === baseRevision && p.head.revision === headRevision, "Mixed commit revisions");
  }
  const metrics = ["fps", "p95Ms", "p99Ms", "onePercentLowFps", "framesOver50Ms"];
  const summary = Object.fromEntries(metrics.map((key) => [key, {
    baseMedian: median(pair.map((p) => p.base.stats[key])),
    headMedian: median(pair.map((p) => p.head.stats[key])),
  }]));
  return {
    comparable: true,
    deviceAndScene: pair[0].base.setup,
    baseRevision,
    headRevision,
    repetitions: pair.length,
    sampleScope: "median of each complete run's raw-frame statistics, not a pooled/global percentile",
    thermalScope: "10-minute observed FPS drift; temperature requires explicit sensor data",
    summary,
    runs: pair,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [a, b] = process.argv.slice(2);
    assert(a && b, "Usage: node scripts/compare-frame-campaigns.mjs base.json head.json");
    const [baseline, candidate] = await Promise.all([a, b].map(async (p) => JSON.parse(await readFile(p, "utf8"))));
    console.log(JSON.stringify(compareFrameCampaigns(baseline, candidate), null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
