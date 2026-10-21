import { readFileSync } from "node:fs";

const reportPath = process.argv[2];
if (!reportPath) throw new Error("Usage: node scripts/verify-stress-report.mjs REPORT.json");
const report = JSON.parse(readFileSync(reportPath, "utf8"));
const stress = report.testResults?.find((suite) => /[/\\]sim\.stress\.test\.ts$/.test(suite.name));
const assertions = stress?.assertionResults ?? [];
if (
  !report.success ||
  !stress ||
  stress.status !== "passed" ||
  !assertions.length ||
  assertions.some((assertion) => assertion.status !== "passed") ||
  !assertions.some((assertion) => assertion.fullName?.includes("finishes 200 seeded matches"))
) {
  throw new Error(
    "The complete 200-match stress suite must execute and pass; skipped, empty or missing reports fail the gate",
  );
}
console.log(
  `Stress gate passed: ${assertions.length} executed assertion(s), 200 seeds and independent deterministic replays.`,
);
