import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const [outputArg] = process.argv.slice(2);
if (!outputArg) throw new Error("Usage: node scripts/compare-quality-cpu.mjs SAMPLE_DIRECTORY");
const output = path.resolve(outputArg);
const filenames = (await readdir(output)).filter((name) =>
  /^(baseline|candidate)-\d+\.json$/.test(name),
);
const samples = await Promise.all(
  filenames.map(async (name) => JSON.parse(await readFile(path.join(output, name), "utf8"))),
);
const baseline = samples.filter((sample) => sample.tag.startsWith("baseline-"));
const candidate = samples.filter((sample) => sample.tag.startsWith("candidate-"));
if (!baseline.length || !candidate.length)
  throw new Error("Baseline and candidate samples are required");
const first = baseline[0];
const violations = [];
for (const sample of samples) {
  for (const key of ["environment", "protocol", "lockSha256", "fixtureSha256", "checkpoints"])
    if (JSON.stringify(sample[key]) !== JSON.stringify(first[key]))
      violations.push(`${sample.tag}: ${key} differs`);
  if (
    JSON.stringify(sample.cases.map((entry) => entry.name)) !==
    JSON.stringify(first.cases.map((entry) => entry.name))
  )
    violations.push(`${sample.tag}: benchmark registrations differ`);
}
for (const group of [baseline, candidate])
  if (new Set(group.map((sample) => `${sample.sourceSha}:${sample.sourceDiffSha256}`)).size !== 1)
    violations.push(`${group[0].tag}: source changed between repeated samples`);
const median = (values) => {
  const sorted = values.slice().sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const cases = first.cases.map((entry, index) => {
  const before = baseline.map((sample) => sample.cases[index].latencyMs.mean);
  const after = candidate.map((sample) => sample.cases[index].latencyMs.mean);
  const baselineMs = median(before),
    candidateMs = median(after);
  const ratio = baselineMs / candidateMs;
  return {
    name: entry.name,
    baselineMs,
    candidateMs,
    baselineRunsMs: before,
    candidateRunsMs: after,
    throughputGainPercent: (ratio - 1) * 100,
    elapsedTimeReductionPercent: (1 - candidateMs / baselineMs) * 100,
    fasterBy89Percent: ratio >= 1.89,
  };
});
const report = {
  generatedAt: new Date().toISOString(),
  environment: first.environment,
  protocol: first.protocol,
  baselineRuns: baseline.length,
  candidateRuns: candidate.length,
  pairedSourceParity: violations.length === 0,
  violations,
  cases,
  everyBenchmark89PercentFaster:
    violations.length === 0 && cases.every((entry) => entry.fasterBy89Percent),
  limitation:
    "Local Tinybench wall timing; not instrumented CodSpeed CI. Repetitions summarize observed variation and do not establish statistical significance or GPU/FPS gains.",
};
await writeFile(path.join(output, "comparison.json"), JSON.stringify(report, null, 2) + "\n");
const format = (value) => Number(value).toFixed(3);
const markdown = [
  "# Local CPU comparison",
  "",
  report.limitation,
  "",
  `Baseline runs: ${baseline.length}; candidate runs: ${candidate.length}; comparable: ${report.pairedSourceParity}.`,
  "",
  "| Existing benchmark | Before ms | After ms | Time reduction | Throughput gain | 89% faster target |",
  "| --- | ---: | ---: | ---: | ---: | --- |",
  ...cases.map(
    (entry) =>
      `| ${entry.name} | ${format(entry.baselineMs)} | ${format(entry.candidateMs)} | ${format(entry.elapsedTimeReductionPercent)}% | ${format(entry.throughputGainPercent)}% | ${entry.fasterBy89Percent ? "reached locally" : "not reached"} |`,
  ),
  "",
  ...violations.map((violation) => `- ${violation}`),
  "",
].join("\n");
await writeFile(path.join(output, "comparison.md"), markdown);
console.log(
  JSON.stringify({
    pairedSourceParity: report.pairedSourceParity,
    everyBenchmark89PercentFaster: report.everyBenchmark89PercentFaster,
    cases,
    violations,
  }),
);
if (violations.length) process.exitCode = 1;
