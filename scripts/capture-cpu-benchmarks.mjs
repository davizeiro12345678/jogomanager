/** Capture the existing 16 workloads without changing their fixtures or limits.
 * Local wall-clock telemetry is diagnostic; CodSpeed CI remains the CPU instrument.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import os from "node:os";
import { Bench } from "tinybench";
import { withCodSpeed } from "@codspeed/tinybench-plugin";

const [rootArg, outputArg, label = "diagnostic"] = process.argv.slice(2);
if (!rootArg || !outputArg)
  throw new Error("Usage: node --import tsx scripts/capture-cpu-benchmarks.mjs ROOT OUTPUT LABEL");
const root = path.resolve(rootArg);
const output = path.resolve(outputArg);
const bench = withCodSpeed(new Bench({ time: 200, warmupTime: 50 }));
for (const [file, register] of [
  ["match", "registerMatchBenchmarks"],
  ["season", "registerSeasonBenchmarks"],
  ["rig", "registerRigBenchmarks"],
]) {
  const module = await import(pathToFileURL(path.join(root, `src/game/benchmarks/${file}.ts`)));
  module[register](bench);
}
await bench.run();
const metrics = bench.tasks.map((task) => {
  const result = task.result;
  if (!result || result.error || result.aborted)
    throw new Error(`Benchmark did not complete: ${task.name}`);
  return {
    name: task.name,
    latencyMs: {
      mean: result.latency.mean,
      median: result.latency.p50,
      min: result.latency.min,
      max: result.latency.max,
      p99: result.latency.p99,
      relativeMarginOfErrorPercent: result.latency.rme,
      sampleCount: result.latency.samples.length,
    },
    opsPerSecond: result.throughput.mean,
  };
});
if (metrics.length !== 16) throw new Error(`Expected 16 benchmarks; found ${metrics.length}`);
const hash = async (name) =>
  createHash("sha256")
    .update(await readFile(path.join(root, name)))
    .digest("hex");
const report = {
  label,
  capturedAt: new Date().toISOString(),
  instrument: process.env.CODSPEED ? "codspeed-runtime-present" : "local-wall-clock",
  physicalDeviceFpsCertification: false,
  node: process.version,
  platform: `${os.platform()} ${os.release()} ${os.arch()}`,
  cpu: os.cpus()[0]?.model ?? "unknown",
  parallelism: os.availableParallelism(),
  timeMs: 200,
  warmupMs: 50,
  lockfileSha256: await hash("package-lock.json"),
  wasmSha256: await hash("src/game/wasm/pkg/crowd_visibility_wasm_bg.wasm"),
  benchmarkSources: await Promise.all(
    ["match", "season", "rig"].map(async (name) => ({
      name,
      sha256: await hash(`src/game/benchmarks/${name}.ts`),
    })),
  ),
  metrics,
  limitations: [
    "Wall-clock results can be affected by shared-runner contention and JIT/GC.",
    "These are CPU workloads, not rendered match or cutscene FPS.",
    "A single run is descriptive; compare equivalent repetitions and CodSpeed CI.",
  ],
};
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(
  JSON.stringify({ label, output, benchmarks: metrics.length, instrument: report.instrument }),
);
