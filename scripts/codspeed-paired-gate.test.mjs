import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluatePairedReport } from "./codspeed-paired-gate.mjs";

function pairedReport() {
  const sample = (medianMs, p99Ms = 3, samples = 512) => ({ medianMs, p99Ms, samples });
  return {
    protocol: "CodSpeed Walltime, ABBA, one runner, same Node and shared node_modules",
    base: "a".repeat(40),
    head: "b".repeat(40),
    node: "v24.22.0",
    cpu: "Test Intel Xeon CPU",
    benchmarks: Array.from({ length: 16 }, (_, index) => ({
      name: `bench-${index}`,
      rounds: {
        "base-a": sample(1),
        "base-b": sample(1),
        "head-a": sample(0.9),
        "head-b": sample(0.9),
      },
    })),
  };
}

describe("same-runner paired-walltime release gate", () => {
  it("accepts all 16 benchmarks when median and tails improve", () => {
    const result = evaluatePairedReport(pairedReport());
    assert.equal(result.failures.length, 0);
    assert.equal(result.benchmarks, 16);
  });

  it("accepts the provenance string of the stabilised harness", () => {
    const report = pairedReport();
    report.protocol =
      "CodSpeed Walltime, ABBA, one runner, same Node and shared node_modules, fresh process per suite, mirrored suite order, equalised burn and warm-up per slot";
    report.measurement = {
      timeMs: 400,
      warmupTimeMs: 600,
      burnMs: 1500,
      slotOrder: ["base-a:match,season,rig", "head-a:rig,season,match"],
    };
    const result = evaluatePairedReport(report);
    assert.equal(result.failures.length, 0);
  });

  it("blocks a confirmed 4% regression regardless of headline labels", () => {
    const report = pairedReport();
    report.benchmarks[3].rounds["head-a"].medianMs = 1.04;
    report.benchmarks[3].rounds["head-b"].medianMs = 1.04;
    const result = evaluatePairedReport(report);
    assert.ok(result.failures.some((failure) => failure.includes("bench-3")));
  });

  it("rejects missing benchmarks and malformed measurements", () => {
    const incomplete = pairedReport();
    incomplete.benchmarks.pop();
    assert.throws(() => evaluatePairedReport(incomplete), /16/);

    const invalid = pairedReport();
    invalid.benchmarks[0].rounds["head-a"].medianMs = 0;
    assert.throws(() => evaluatePairedReport(invalid), /positive/);
  });

  it("warns when severe p99 spikes lack enough samples", () => {
    const report = pairedReport();
    report.benchmarks[2].rounds["head-a"] = { medianMs: 0.9, p99Ms: 11, samples: 64 };
    report.benchmarks[2].rounds["head-b"] = { medianMs: 0.9, p99Ms: 17, samples: 64 };
    const result = evaluatePairedReport(report);
    assert.ok(result.warnings.some((warning) => warning.includes("bench-2")));
    assert.equal(result.failures.length, 0);
  });

  it("blocks repeatable material p99 regressions with enough samples", () => {
    const report = pairedReport();
    report.benchmarks[2].rounds["head-a"].p99Ms = 11;
    report.benchmarks[2].rounds["head-b"].p99Ms = 17;
    const result = evaluatePairedReport(report);
    assert.ok(result.failures.some((failure) => failure.includes("bench-2")));
  });

  it("does not fail on runner noise that identical code reproduces", () => {
    const report = pairedReport();
    // The two base rounds of the same commit already differ by 12%.
    report.benchmarks[5].rounds["base-a"].medianMs = 1;
    report.benchmarks[5].rounds["base-b"].medianMs = 1.12;
    report.benchmarks[5].rounds["head-a"].medianMs = 1.05;
    report.benchmarks[5].rounds["head-b"].medianMs = 1.08;
    const result = evaluatePairedReport(report);
    assert.equal(result.failures.length, 0);
    assert.ok(result.warnings.some((warning) => warning.includes("bench-5")));
  });

  it("requires a regression to appear in both head rounds", () => {
    const report = pairedReport();
    report.benchmarks[7].rounds["head-a"].medianMs = 1.09;
    report.benchmarks[7].rounds["head-b"].medianMs = 0.98;
    const result = evaluatePairedReport(report);
    assert.equal(result.failures.length, 0);
    assert.ok(
      result.warnings.some(
        (warning) => warning.includes("bench-7") && warning.includes("not confirmed"),
      ),
    );
  });
});
