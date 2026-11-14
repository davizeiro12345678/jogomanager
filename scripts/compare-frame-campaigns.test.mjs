import assert from "node:assert/strict";
import { test } from "node:test";
import { compareFrameCampaigns, summarizeCampaignRun } from "./compare-frame-campaigns.mjs";

const REQ = { repetitions: 2, warmupMs: 20, measuredMs: 100, thermalWindowMs: 30 };
const SHA1 = "0123456789abcdef0123456789abcdef01234567";
const SHA2 = "fedcba9876543210fedcba9876543210fedcba98";
const setup = {
  device: "physical-laptop-1",
  gpu: "test-gpu",
  driver: "test-driver",
  browser: "edge-test",
  renderer: "webgl2",
  viewport: { width: 1280, height: 720, dpr: 1 },
  quality: "alta",
  scene: "broadcast-match",
  camera: "broadcast",
  weather: "rain",
  timeOfDay: "night",
  seed: "scenario-fixed",
};
function fixture(revision = SHA1, delay = 10, key = "unique-open-1") {
  const rawFrameMs = Array.from({ length: 20 }, () => delay);
  return {
    revision,
    setup: { ...setup, viewport: { ...setup.viewport } },
    headless: false,
    recordVideo: false,
    report: {
      context: { phase: "match", key, quality: "alta" },
      interruptions: 0,
      quantilesScope: "whole-campaign",
      summary: { coverage: { completeDistribution: true } },
      captureDroppedFrames: 0,
      rawFrameMs,
    },
  };
}

test("computes statistics from raw completed renders and refuses invented sensor readings", () => {
  const result = summarizeCampaignRun(fixture(), REQ);
  assert.equal(result.stats.fps, 100);
  assert.equal(result.stats.p95Ms, 10);
  assert.equal(result.stats.onePercentLowFps, 100);
  assert.equal(result.drift.p95IncreaseMs, 0);
  assert.match(result.thermal.status, /sensor-data-unavailable/);
});

test("compares two revisions on identical physical hardware despite unique mount timestamps", () => {
  const base = { runs: [fixture(SHA1, 10, "open-1"), fixture(SHA1, 10, "open-2")] };
  const head = { runs: [fixture(SHA2, 8, "new-1"), fixture(SHA2, 8, "new-2")] };
  const result = compareFrameCampaigns(base, head, REQ);
  assert.equal(result.comparable, true);
  assert.equal(result.summary.fps.baseMedian, 100);
  assert.equal(result.summary.fps.headMedian, 125);
  assert.equal(result.repetitions, 2);
});

test("rejects a different GPU, DPR or sample scene instead of reporting a fake speedup", () => {
  const base = { runs: [fixture(), fixture()] };
  for (const changed of [
    { gpu: "another-gpu" },
    { viewport: { width: 1280, height: 720, dpr: 2 } },
    { scene: "another-match" },
  ]) {
    const candidate = fixture(SHA2);
    candidate.setup = { ...candidate.setup, ...changed };
    assert.throws(
      () => compareFrameCampaigns(base, { runs: [candidate, fixture(SHA2)] }, REQ),
      /mismatch/,
    );
  }
});

test("rejects hidden-tab interruption, dropped frames, incomplete evidence and video overhead", () => {
  for (const mutate of [
    (run) => {
      run.report.interruptions = 1;
    },
    (run) => {
      run.report.captureDroppedFrames = 5;
    },
    (run) => {
      run.report.quantilesScope = "newest-retained-intervals-only";
    },
    (run) => {
      run.report.summary.coverage.completeDistribution = false;
    },
    (run) => {
      run.headless = true;
    },
    (run) => {
      run.recordVideo = true;
    },
  ]) {
    const candidate = fixture();
    mutate(candidate);
    assert.throws(() => summarizeCampaignRun(candidate, REQ));
  }
});

test("enforces duration, repeated runs, revision identity and finite intervals", () => {
  assert.throws(
    () => summarizeCampaignRun(fixture(), { ...REQ, measuredMs: 600_000 }),
    /Insufficient active/,
  );
  assert.throws(
    () => compareFrameCampaigns({ runs: [fixture()] }, { runs: [fixture(SHA2)] }, REQ),
    /repetitions/,
  );
  const invalid = fixture();
  invalid.report.rawFrameMs[5] = Number.NaN;
  assert.throws(() => summarizeCampaignRun(invalid, REQ), /Invalid frame interval/);
  const mixed = fixture(SHA1);
  assert.throws(
    () =>
      compareFrameCampaigns(
        { runs: [fixture(), fixture()] },
        { runs: [fixture(SHA2), mixed] },
        REQ,
      ),
    /Mixed commit revisions/,
  );
});
