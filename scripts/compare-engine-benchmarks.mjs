import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { assertBenchmarkSource, benchmarkSource } from "./benchmark-source.mjs";

const script = fileURLToPath(import.meta.url);
const hash = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
const registrations = [
  ["match", "registerMatchBenchmarks"],
  ["season", "registerSeasonBenchmarks"],
  ["rig", "registerRigBenchmarks"],
];

if (process.argv[2] === "--sample") {
  const root = realpathSync(process.argv[3]);
  const require = createRequire(path.join(root, "package.json"));
  const { Bench } = await import(pathToFileURL(require.resolve("tinybench")));
  // Match the existing benchmark protocol; use the unmodified registrations.
  const bench = new Bench({ time: 200, warmupTime: 50 });
  for (const [file, register] of registrations) {
    const module = await import(pathToFileURL(path.join(root, `src/game/benchmarks/${file}.ts`)));
    module[register](bench);
  }
  await bench.run();
  const results = bench.tasks.map(({ name, result }) => {
    assert.ok(result && !result.error && !result.aborted, `${name} did not complete`);
    const { p50, p99, mean, rme, samples } = result.latency;
    return { name, p50Ms: p50, p99Ms: p99, meanMs: mean, rme, samples: samples.length };
  });
  const { buildTeamSetup } = await import(pathToFileURL(path.join(root, "src/game/quickMatch.ts")));
  const fixture = JSON.stringify([buildTeamSetup("fla"), buildTeamSetup("pal")]);
  writeFileSync(
    process.argv[4],
    JSON.stringify({
      environment: {
        node: process.version,
        platform: process.platform,
        architecture: process.arch,
        cpu: os.cpus()[0].model,
        cpuCount: os.cpus().length,
      },
      fixtureSha256: createHash("sha256").update(fixture).digest("hex"),
      results,
    }),
  );
} else {
  const [baseArg, candidateArg, outputArg] = process.argv.slice(2);
  assert.ok(
    baseArg && candidateArg && outputArg,
    "Usage: node scripts/compare-engine-benchmarks.mjs BASE CANDIDATE OUTPUT",
  );
  const baseline = realpathSync(baseArg);
  const candidate = realpathSync(candidateArg);
  const output = path.resolve(outputArg);
  const sources = { baseline: benchmarkSource(baseline), candidate: benchmarkSource(candidate) };
  const assertSources = () => {
    assertBenchmarkSource(baseline, sources.baseline);
    assertBenchmarkSource(candidate, sources.candidate);
  };
  const pinnedNode = readFileSync(path.join(candidate, ".nvmrc"), "utf8").trim();
  assert.equal(process.version, `v${pinnedNode}`, "Use the pinned Node for both revisions");
  assert.equal(
    realpathSync(path.join(baseline, "node_modules")),
    realpathSync(path.join(candidate, "node_modules")),
    "Use one installed dependency tree",
  );
  const benchmarkSha256 = Object.fromEntries(
    ["index", ...registrations.map(([file]) => file)].map((file) => {
      const relative = `src/game/benchmarks/${file}.ts`;
      const digest = hash(path.join(candidate, relative));
      assert.equal(digest, hash(path.join(baseline, relative)), `${relative} changed workload`);
      return [relative, digest];
    }),
  );
  mkdirSync(output, { recursive: true });
  const require = createRequire(path.join(candidate, "package.json"));
  const loader = pathToFileURL(require.resolve("tsx")).href;
  const passes = [];
  for (const [index, revision] of ["baseline", "candidate", "candidate", "baseline"].entries()) {
    assertSources();
    const root = revision === "baseline" ? baseline : candidate;
    const target = path.join(output, `pass-${index}-${revision}.json`);
    const child = spawnSync(
      process.execPath,
      ["--import", loader, script, "--sample", root, target],
      {
        cwd: root,
        env: { ...process.env, TSX_TSCONFIG_PATH: path.join(root, "tsconfig.json") },
        encoding: "utf8",
        timeout: 180_000,
      },
    );
    assert.equal(child.status, 0, child.error?.message ?? child.stderr);
    assertSources();
    passes.push({ revision, ...JSON.parse(readFileSync(target, "utf8")) });
    console.log(`Completed ${revision} pass ${index + 1}/4`);
  }
  const names = passes[0].results.map(({ name }) => name);
  assert.equal(names.length, 16, "Expected every benchmark from the reference PR");
  assert.equal(new Set(names).size, names.length, "Duplicate benchmark names");
  for (const pass of passes) {
    assert.deepEqual(pass.environment, passes[0].environment, "Environment changed");
    assert.equal(pass.fixtureSha256, passes[0].fixtureSha256, "Team fixture changed");
    assert.deepEqual(
      pass.results.map(({ name }) => name),
      names,
      "Missing or reordered benchmarks",
    );
    assert.ok(
      pass.results.every(
        ({ p50Ms, samples }) => Number.isFinite(p50Ms) && p50Ms > 0 && samples > 0,
      ),
      "Missing or invalid measurement",
    );
  }
  const comparisons = names.map((name, index) => {
    const samples = (revision) =>
      passes.filter((pass) => pass.revision === revision).map((pass) => pass.results[index].p50Ms);
    const base = samples("baseline");
    const head = samples("candidate");
    const baselineMs = (base[0] + base[1]) / 2;
    const candidateMs = (head[0] + head[1]) / 2;
    const durationReduction = 1 - candidateMs / baselineMs;
    return {
      name,
      baselineMs,
      candidateMs,
      baselineSamplesMs: base,
      candidateSamplesMs: head,
      speedup: baselineMs / candidateMs,
      durationReduction,
      meets96PercentSpeedup: baselineMs / candidateMs >= 1.96,
    };
  });
  const report = {
    protocol:
      "Same-runner ABBA Walltime diagnostic; pinned Node; one installed dependency tree; unchanged 16 benchmark callbacks; revision and source digests checked before/after every pass; 200 ms measurement and 50 ms warm-up. Independent of CodSpeed CPU simulation. Two pass medians per revision do not provide a confidence interval.",
    baseline,
    candidate,
    sources,
    environment: passes[0].environment,
    fixtureSha256: passes[0].fixtureSha256,
    dependencyLockSha256: hash(path.join(candidate, "package-lock.json")),
    benchmarkSha256,
    target: { requiredSpeedup: 1.96, equivalentDurationReduction: 1 - 1 / 1.96 },
    allBenchmarksMeetTarget: comparisons.every(
      ({ meets96PercentSpeedup }) => meets96PercentSpeedup,
    ),
    comparisons,
  };
  writeFileSync(path.join(output, "comparison.json"), JSON.stringify(report, null, 2) + "\n");
  console.table(
    comparisons.map(({ name, speedup, durationReduction, meets96PercentSpeedup }) => ({
      name,
      speedup,
      durationReduction,
      meets96PercentSpeedup,
    })),
  );
}
