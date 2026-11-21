import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const EXPECTED_BENCHMARKS = 16;
const MAX_MEDIAN_REGRESSION_PERCENT = 3;
const P99_SPIKE_MULTIPLIER = 3;
const MATERIAL_P99_MS = 5;
const MIN_P99_ROUNDS = 250;

function measurement(row, key) {
  const sample = row.rounds?.[key];
  assert.ok(sample, `Missing paired sample ${row.name}: ${key}`);
  assert.ok(
    Number.isFinite(sample.medianMs) && sample.medianMs > 0,
    `${row.name} ${key}: median must be positive`,
  );
  assert.ok(
    Number.isFinite(sample.p99Ms) && sample.p99Ms > 0,
    `${row.name} ${key}: p99 must be positive`,
  );
  assert.ok(
    Number.isInteger(sample.samples) && sample.samples >= 64,
    `${row.name} ${key}: insufficient samples`,
  );
  return sample;
}

/** Gate real same-runner ABBA measurements, not cross-machine CodSpeed badges. */
export function evaluatePairedReport(report) {
  assert.ok(report && typeof report === "object", "Missing paired report");
  assert.match(report.protocol ?? "", /CodSpeed Walltime, ABBA, one runner/);
  assert.match(report.base ?? "", /^[0-9a-f]{40}$/);
  assert.match(report.head ?? "", /^[0-9a-f]{40}$/);
  assert.ok(report.base !== report.head, "Base and head must differ");
  assert.ok(
    typeof report.node === "string" && report.node.startsWith("v"),
    "Missing Node version",
  );
  assert.ok(typeof report.cpu === "string" && report.cpu.length > 4, "Missing runner CPU");
  assert.ok(
    Array.isArray(report.benchmarks) && report.benchmarks.length === EXPECTED_BENCHMARKS,
    `Expected all ${EXPECTED_BENCHMARKS} benchmarks`,
  );

  const names = new Set();
  const failures = [];
  const warnings = [];
  for (const row of report.benchmarks) {
    assert.ok(typeof row.name === "string" && row.name.length > 0, "Missing benchmark name");
    assert.ok(!names.has(row.name), `Duplicate benchmark ${row.name}`);
    names.add(row.name);
    const baseA = measurement(row, "base-a");
    const baseB = measurement(row, "base-b");
    const headA = measurement(row, "head-a");
    const headB = measurement(row, "head-b");
    const baseMedian = (baseA.medianMs + baseB.medianMs) / 2;
    const headMedian = (headA.medianMs + headB.medianMs) / 2;
    const regression = 100 * (headMedian / baseMedian - 1);
    if (regression > MAX_MEDIAN_REGRESSION_PERCENT) {
      failures.push(
        `${row.name}: median regression +${regression.toFixed(2)}% ` +
          `(${baseMedian.toFixed(6)} → ${headMedian.toFixed(6)} ms)`,
      );
    } else if (regression > 0) {
      warnings.push(
        `${row.name}: small median increase +${regression.toFixed(2)}% ` +
          `(<${MAX_MEDIAN_REGRESSION_PERCENT}% noise gate)`,
      );
    }

    const spikeA = headA.p99Ms / baseA.p99Ms;
    const spikeB = headB.p99Ms / baseB.p99Ms;
    const severeP99 =
      spikeA >= P99_SPIKE_MULTIPLIER &&
      spikeB >= P99_SPIKE_MULTIPLIER &&
      Math.max(headA.p99Ms, headB.p99Ms) >= MATERIAL_P99_MS;
    if (severeP99) {
      const message =
        `${row.name}: repeated p99 spike (${spikeA.toFixed(1)}x/${spikeB.toFixed(1)}x; ` +
        `head ${headA.p99Ms.toFixed(3)}/${headB.p99Ms.toFixed(3)} ms)`;
      if (headA.samples >= MIN_P99_ROUNDS && headB.samples >= MIN_P99_ROUNDS) {
        failures.push(message);
      } else {
        warnings.push(
          `${message}; too few samples to certify p99 (${headA.samples}/${headB.samples})`,
        );
      }
    }
  }
  return { benchmarks: names.size, failures, warnings };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  assert.ok(process.argv[2], "Usage: node codspeed-paired-gate.mjs REPORT.json");
  const report = JSON.parse(readFileSync(process.argv[2], "utf8"));
  const result = evaluatePairedReport(report);
  console.log(`CodSpeed same-runner ABBA gate: ${result.benchmarks}/${EXPECTED_BENCHMARKS}`);
  for (const warning of result.warnings) console.warn(`WARNING ${warning}`);
  for (const failure of result.failures) console.error(`REGRESSION ${failure}`);
  if (result.failures.length) process.exitCode = 1;
}
