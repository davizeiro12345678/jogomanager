import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { verifySuiteReport } from "./verify-pr132-suite.mjs";

const file = "src/example.test.ts";
const valid = () => ({
  success: true,
  numTotalTests: 2,
  numPassedTests: 2,
  numFailedTests: 0,
  numPendingTests: 0,
  numTodoTests: 0,
  testResults: [
    {
      name: resolve(file),
      status: "passed",
      assertionResults: [{ status: "passed" }, { status: "passed" }],
    },
  ],
});

test("accepts a complete passing report", () => {
  assert.doesNotThrow(() => verifySuiteReport(valid(), [file]));
});

test("rejects skipped and todo cases even when Vitest succeeds", () => {
  for (const key of ["numPendingTests", "numTodoTests"]) {
    const report = valid();
    report[key] = 1;
    assert.throws(() => verifySuiteReport(report, [file]), /pending|todo/i);
  }
});

test("rejects missing, empty, and non-passing test files", () => {
  assert.throws(() => verifySuiteReport(valid(), [file, "src/missing.test.ts"]), /missing/i);
  const empty = valid();
  empty.testResults[0].assertionResults = [];
  assert.throws(() => verifySuiteReport(empty, [file]), /assertion/i);
  const skipped = valid();
  skipped.testResults[0].assertionResults[0].status = "pending";
  assert.throws(() => verifySuiteReport(skipped, [file]), /assertion/i);
});

test("rejects inconsistent totals and failures", () => {
  const report = valid();
  report.numPassedTests = 1;
  assert.throws(() => verifySuiteReport(report, [file]), /total/i);
  const failed = valid();
  failed.success = false;
  assert.throws(() => verifySuiteReport(failed, [file]), /success/i);
});
