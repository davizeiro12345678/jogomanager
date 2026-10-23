import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { assessMatchSetup } from "./match-setup-budget.mjs";

const [baselineArg, candidateArg, outputArg] = process.argv.slice(2);
if (!baselineArg || !candidateArg || !outputArg)
  throw new Error(
    "Usage: node scripts/compare-match-setup.mjs BASELINE_DIR CANDIDATE_DIR OUTPUT_DIR",
  );
const baseline = realpathSync(baselineArg);
const candidate = realpathSync(candidateArg);
const output = path.resolve(outputArg);
const expectedNode = readFileSync(path.join(candidate, ".nvmrc"), "utf8").trim().replace(/^v/, "");
if (process.version !== `v${expectedNode}`)
  throw new Error(`Use the pinned Node ${expectedNode} for both revisions`);
if (
  realpathSync(path.join(baseline, "node_modules")) !==
  realpathSync(path.join(candidate, "node_modules"))
)
  throw new Error(
    "Both revisions must use the same installed dependency tree (symlink baseline/node_modules to candidate/node_modules)",
  );
mkdirSync(output, { recursive: true });
const require = createRequire(path.join(candidate, "package.json"));
const tsx = pathToFileURL(require.resolve("tsx")).href;
const sampler = fileURLToPath(new URL("./match-setup-sample.mjs", import.meta.url));
const fixturePath = path.join(output, "match-fixture.json");
function sample(mode, root, target = "") {
  const run = spawnSync(
    process.execPath,
    ["--import", tsx, sampler, mode, root, fixturePath, target],
    {
      cwd: root,
      env: { ...process.env, TSX_TSCONFIG_PATH: path.join(root, "tsconfig.json") },
      encoding: "utf8",
      timeout: 180_000,
    },
  );
  if (run.status !== 0)
    throw new Error(`${mode} failed in ${root}: ${run.error?.message ?? run.stderr}`);
}
sample("fixture", candidate);
const reports = [];
// Reverse the order halfway through, reducing drift from process warm-up,
// CPU frequency and other work on a shared runner. Never compare two CI jobs.
for (const [index, revision] of ["baseline", "candidate", "candidate", "baseline"].entries()) {
  const file = path.join(output, `match-sample-${index}-${revision}.json`);
  sample("sample", revision === "baseline" ? baseline : candidate, file);
  reports.push({ revision, ...JSON.parse(readFileSync(file, "utf8")) });
  console.log(`Completed ${revision} pass ${index + 1}/4`);
}
const first = reports[0];
const violations = [];
for (const report of reports) {
  if (JSON.stringify(report.environment) !== JSON.stringify(first.environment))
    violations.push("Runtime or CPU changed between samples");
  if (report.fixtureSha256 !== first.fixtureSha256)
    violations.push("Team fixture changed between samples");
  if (JSON.stringify(report.checkpoints) !== JSON.stringify(first.checkpoints))
    violations.push(`${report.revision}: deterministic checkpoints differ`);
}
const cpuSamples = (revision) =>
  reports
    .filter((report) => report.revision === revision)
    .flatMap((report) => report.samples.map((value) => value.cpuMs));
const budget = assessMatchSetup(cpuSamples("baseline"), cpuSamples("candidate"));
if (budget.failed)
  violations.push("Constructor CPU regression exceeds 10% with 99% bootstrap confidence");
const result = {
  generatedAt: new Date().toISOString(),
  protocol:
    "same-runner ABBA, pinned Node and identical dependencies, shared serialized team fixture, 3000 warm-ups + 31 batches of 1000 constructions per pass",
  baseline,
  candidate,
  environment: first.environment,
  dependencyLockSha256: createHash("sha256")
    .update(readFileSync(path.join(candidate, "package-lock.json")))
    .digest("hex"),
  fixtureSha256: first.fixtureSha256,
  samplesPerRevision: 62,
  deterministicCheckpoints: first.checkpoints.length,
  budget,
  violations,
};
writeFileSync(path.join(output, "match-setup.json"), JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result, null, 2));
if (violations.length) process.exitCode = 1;
