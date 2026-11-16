import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Fail closed when a requested test file or any of its cases did not pass. */
export function verifySuiteReport(report, expectedFiles) {
  if (!report || report.success !== true) throw new Error("Vitest did not report success");
  if (!Array.isArray(expectedFiles) || expectedFiles.length === 0)
    throw new Error("Missing expected files");
  for (const key of [
    "numTotalTests",
    "numPassedTests",
    "numFailedTests",
    "numPendingTests",
    "numTodoTests",
  ]) {
    if (!Number.isSafeInteger(report[key]) || report[key] < 0) throw new Error(`Invalid ${key}`);
  }
  if (report.numPendingTests || report.numTodoTests)
    throw new Error("Pending or todo tests are not allowed");
  if (
    report.numFailedTests ||
    report.numTotalTests === 0 ||
    report.numPassedTests !== report.numTotalTests
  ) {
    throw new Error("Test totals are inconsistent or contain failures");
  }
  if (!Array.isArray(report.testResults)) throw new Error("Missing test file results");
  const expected = new Set(expectedFiles.map((file) => resolve(file)));
  const actual = new Map(report.testResults.map((result) => [resolve(result.name), result]));
  if (actual.size !== report.testResults.length || actual.size !== expected.size) {
    throw new Error("Missing, duplicate, or unexpected test file results");
  }
  let count = 0;
  for (const file of expected) {
    const result = actual.get(file);
    if (!result) throw new Error(`Missing test file: ${file}`);
    if (
      result.status !== "passed" ||
      !Array.isArray(result.assertionResults) ||
      !result.assertionResults.length ||
      result.assertionResults.some((assertion) => assertion.status !== "passed")
    ) {
      throw new Error(`Missing or non-passing assertions in ${file}`);
    }
    count += result.assertionResults.length;
  }
  if (count !== report.numTotalTests) throw new Error("Assertion count differs from test totals");
  return count;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [reportPath, ...expectedFiles] = process.argv.slice(2);
    if (!reportPath) throw new Error("Missing report path");
    const count = verifySuiteReport(JSON.parse(readFileSync(reportPath, "utf8")), expectedFiles);
    console.log(
      `Verified ${count} passing assertions across ${expectedFiles.length} requested file(s)`,
    );
  } catch (error) {
    console.error(`PR132 suite evidence rejected: ${error.message}`);
    process.exitCode = 1;
  }
}
