import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import os from "node:os";
import { getCodspeedRunnerMode } from "@codspeed/core";
import { withCodSpeed } from "@codspeed/tinybench-plugin";
import { Bench } from "tinybench";

const [basePath, headPath, output] = process.argv.slice(2);
assert.ok(basePath && headPath && output, "Usage: BASE HEAD OUTPUT");
assert.equal(getCodspeedRunnerMode(), "walltime", "Run through the CodSpeed Walltime instrument");

const base = resolve(basePath);
const head = resolve(headPath);
const bench = withCodSpeed(new Bench({ time: 200, warmupTime: 50 }));
const workloads = [
  ["match", "registerMatchBenchmarks"],
  ["season", "registerSeasonBenchmarks"],
  ["rig", "registerRigBenchmarks"],
];

for (const [label, directory] of [
  ["base-a", base],
  ["head-a", head],
  ["head-b", head],
  ["base-b", base],
]) {
  const namespaced = {
    add(name, fn, options) {
      bench.add(label + "/" + name, fn, options);
      return namespaced;
    },
  };
  for (const [file, register] of workloads) {
    const suite = await import(pathToFileURL(join(directory, "src/game/benchmarks", file + ".ts")));
    suite[register](namespaced);
  }
}

await bench.run();
assert.equal(bench.tasks.length, 64, "The run must include every benchmark in all four rounds");
const results = new Map();
for (const task of bench.tasks) {
  assert.ok(task.result && !task.result.error && !task.result.aborted, task.name);
  assert.ok(Number.isFinite(task.result.latency.p50) && task.result.latency.p50 > 0, task.name);
  const separator = task.name.indexOf("/");
  assert.ok(separator > 0, task.name);
  const round = task.name.slice(0, separator);
  const name = task.name.slice(separator + 1);
  const comparison = results.get(name) ?? {};
  comparison[round] = {
    medianMs: task.result.latency.p50,
    p99Ms: task.result.latency.p99,
    samples: task.result.latency.samples.length,
  };
  results.set(name, comparison);
}
assert.equal(results.size, 16);

const benchmarks = [...results.entries()].map(([name, rounds]) => {
  assert.equal(Object.keys(rounds).length, 4, name);
  const baseMs = (rounds["base-a"].medianMs + rounds["base-b"].medianMs) / 2;
  const headMs = (rounds["head-a"].medianMs + rounds["head-b"].medianMs) / 2;
  return { name, baseMs, headMs, latencyChangePercent: 100 * (headMs / baseMs - 1), rounds };
});
const commit = (cwd) =>
  execFileSync("git", ["rev-parse", "HEAD"], { cwd, encoding: "utf8" }).trim();
const report = {
  protocol: "CodSpeed Walltime, ABBA, one runner, same Node and shared node_modules",
  base: commit(base),
  head: commit(head),
  node: process.version,
  cpu: os.cpus()[0]?.model,
  benchmarks,
};
await mkdir(dirname(resolve(output)), { recursive: true });
await writeFile(output, JSON.stringify(report, null, 2) + "\n");
console.table(
  benchmarks.map(({ name, baseMs, headMs, latencyChangePercent }) => ({
    name,
    baseMs,
    headMs,
    latencyChangePercent,
  })),
);
