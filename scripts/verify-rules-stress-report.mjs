import { readFileSync } from "node:fs";

const input = process.argv[2];
if (!input) throw new Error("Usage: node scripts/verify-rules-stress-report.mjs REPORT.json");
const report = JSON.parse(readFileSync(input, "utf8"));
const suites =
  report.testResults?.filter((suite) =>
    /[/\\]sim-rules-revision\.stress\.test\.ts$/.test(suite.name),
  ) ?? [];
const assertions = suites[0]?.assertionResults ?? [];
const seeds = new Set();
let complete =
  report.success === true &&
  suites.length === 1 &&
  suites[0].status === "passed" &&
  assertions.length === 200;
for (const assertion of assertions) {
  const match =
    /^MatchSim rules revision 2 stress rules-stress-(\d+) finishes and reproduces canonical state$/.exec(
      assertion.fullName ?? "",
    );
  const index = match ? Number(match[1]) : -1;
  if (
    assertion.status !== "passed" ||
    !Number.isInteger(index) ||
    index < 0 ||
    index >= 200 ||
    seeds.has(index)
  )
    complete = false;
  seeds.add(index);
}
if (!complete || seeds.size !== 200)
  throw new Error(
    "The complete revision 2 stress campaign must execute and pass: exactly 200 distinct seeds and independent replays; missing, skipped, failed or duplicate cases block release",
  );
console.log(
  "Revised-rules stress gate passed: 200 seeds and 200 independent replays, with per-seed canonical-state and bounded-state assertions.",
);
