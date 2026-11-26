import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import os from "node:os";
import { getCodspeedRunnerMode } from "@codspeed/core";
import { withCodSpeed } from "@codspeed/tinybench-plugin";
import { Bench } from "tinybench";

assert.equal(getCodspeedRunnerMode(), "walltime", "Run through the CodSpeed Walltime instrument");

const workloads = {
  match: ["registerMatchBenchmarks", 8],
  season: ["registerSeasonBenchmarks", 4],
  rig: ["registerRigBenchmarks", 4],
};
const minimumSamples = 250;
// The replay codec measures ~13 microseconds per operation, so a 50 ms warm-up
// left the first task of every slot compiling and optimising inside the sample
// window. CodSpeed reported the same commit at +10.79% and +22.26% on two
// consecutive runs while `base-a` and `base-b` themselves differed by 7% and
// 29%. A longer unmeasured warm-up plus a fixed burn is measurement hygiene,
// not a looser limit: the gate below still rejects any confirmed regression.
const measurementTimeMs = 400;
const warmupTimeMs = 600;
const burnMs = 1_500;

/** Equalise the CPU boost/thermal state every slot starts from. The first suite
 * of the first slot used to run on a cold, boosted CPU and always looked
 * faster, which biased every CPU-bound benchmark against the candidate. */
function burnCpu(milliseconds) {
  const deadline = performance.now() + milliseconds;
  let sink = 0;
  let step = 0;
  while (performance.now() < deadline) {
    for (let inner = 0; inner < 20_000; inner += 1) sink += Math.sqrt((step += 1) % 997);
  }
  assert.ok(Number.isFinite(sink), "CPU burn must not be optimised away");
}

async function measureSuite(directory, label, file, output) {
  assert.ok(Object.hasOwn(workloads, file), `Unknown benchmark suite: ${file}`);
  const [register, expectedCount] = workloads[file];
  const bench = withCodSpeed(
    new Bench({ time: measurementTimeMs, warmupTime: warmupTimeMs, iterations: minimumSamples }),
  );
  const namespaced = {
    add(name, fn, options) {
      bench.add(label + "/" + name, fn, options);
      return namespaced;
    },
  };
  const suite = await import(pathToFileURL(join(directory, "src/game/benchmarks", file + ".ts")));
  suite[register](namespaced);
  burnCpu(burnMs);
  bench.runSync();
  assert.equal(bench.tasks.length, expectedCount, `Missing ${file} benchmarks`);
  const rows = bench.tasks.map(({ name, result }) => {
    assert.ok(result && !result.error && !result.aborted, name);
    assert.ok(Number.isFinite(result.latency.p50) && result.latency.p50 > 0, name);
    assert.ok(result.latency.samples.length >= minimumSamples, `Too few samples for ${name}`);
    return {
      name: name.slice(label.length + 1),
      medianMs: result.latency.p50,
      p99Ms: result.latency.p99,
      samples: result.latency.samples.length,
    };
  });
  await writeFile(output, JSON.stringify(rows));
}

if (process.argv[2] === "--suite") {
  await measureSuite(...process.argv.slice(3));
  process.exit(0);
}

const [basePath, headPath, output] = process.argv.slice(2);
assert.ok(basePath && headPath && output, "Usage: BASE HEAD OUTPUT");
const base = resolve(basePath);
const head = resolve(headPath);
const results = new Map();
const scratch = await mkdtemp(join(os.tmpdir(), "codspeed-abba-"));
const suiteOrder = Object.keys(workloads);
// Each side gets one forward and one reversed slot so a thermal ramp inside a
// slot cannot systematically favour base (or head) for the suite it runs first.
const slots = [
  { label: "base-a", directory: base, order: suiteOrder },
  { label: "head-a", directory: head, order: [...suiteOrder].reverse() },
  { label: "head-b", directory: head, order: suiteOrder },
  { label: "base-b", directory: base, order: [...suiteOrder].reverse() },
];
try {
  for (const { label, directory, order } of slots) {
    for (const file of order) {
      // Give each suite its own V8 heap. Large replay allocations must not
      // influence the later geometry measurements through GC or JIT state.
      const sample = join(scratch, `${label}-${file}.json`);
      execFileSync(
        process.execPath,
        [...process.execArgv, import.meta.filename, "--suite", directory, label, file, sample],
        { stdio: "inherit" },
      );
      for (const { name, ...row } of JSON.parse(await readFile(sample, "utf8"))) {
        const comparison = results.get(name) ?? {};
        assert.ok(!comparison[label], `Duplicate benchmark: ${label}/${name}`);
        comparison[label] = row;
        results.set(name, comparison);
      }
    }
  }
} finally {
  await rm(scratch, { recursive: true, force: true });
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
  protocol:
    "CodSpeed Walltime, ABBA, one runner, same Node and shared node_modules, fresh process per suite, mirrored suite order, equalised burn and warm-up per slot",
  minimumSamples,
  measurement: {
    timeMs: measurementTimeMs,
    warmupTimeMs,
    burnMs,
    slotOrder: slots.map(({ label, order }) => `${label}:${order.join(",")}`),
  },
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
