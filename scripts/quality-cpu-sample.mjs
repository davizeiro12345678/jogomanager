import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";

// Uses the unmodified CodSpeed registrations. These local timer samples are
// deliberately separate from CodSpeed's instrumented CI simulation results.
const [sourceArg, outputArg, tag = "sample"] = process.argv.slice(2);
if (!sourceArg || !outputArg || !/^[a-zA-Z0-9_-]+$/.test(tag))
  throw new Error("Usage: node --import tsx scripts/quality-cpu-sample.mjs SOURCE OUTPUT TAG");
const root = path.resolve(sourceArg);
const output = path.resolve(outputArg);
const pinned = (await readFile(path.join(root, ".nvmrc"), "utf8")).trim().replace(/^v/, "");
if (process.version !== `v${pinned}`) throw new Error(`Use pinned Node ${pinned}`);
await mkdir(output, { recursive: true });
const require = createRequire(path.join(root, "package.json"));
const { Bench } = await import(pathToFileURL(require.resolve("tinybench")));
const load = (file) => import(pathToFileURL(path.join(root, file)));
const [{ registerMatchBenchmarks }, { registerSeasonBenchmarks }, { registerRigBenchmarks }] =
  await Promise.all([
    load("src/game/benchmarks/match.ts"),
    load("src/game/benchmarks/season.ts"),
    load("src/game/benchmarks/rig.ts"),
  ]);
const timeMs = Number(process.env["QA_CPU_TIME_MS"] ?? 200);
const warmupMs = Number(process.env["QA_CPU_WARMUP_MS"] ?? 50);
if (
  !Number.isFinite(timeMs) ||
  timeMs < 200 ||
  timeMs > 5000 ||
  !Number.isFinite(warmupMs) ||
  warmupMs < 50 ||
  warmupMs > 2000
)
  throw new Error("CPU measurement windows must be bounded: 200–5000ms and 50–2000ms warmup");
const bench = new Bench({ time: timeMs, warmupTime: warmupMs });
registerMatchBenchmarks(bench);
registerSeasonBenchmarks(bench);
registerRigBenchmarks(bench);
await bench.run();
const cases = [];
for (const [index, task] of bench.tasks.entries()) {
  const result = task.result;
  if (!result || result.error)
    throw new Error(`${task.name}: ${result?.error ?? "missing result"}`);
  const samples = Float64Array.from(result.latency.samples);
  const raw = Buffer.from(samples.buffer);
  const file = `${tag}-${index}.f64.gz`;
  await writeFile(path.join(output, file), gzipSync(raw));
  const statistics = Object.fromEntries(
    Object.entries(result.latency).filter(([key]) => key !== "samples"),
  );
  cases.push({
    name: task.name,
    runs: task.runs,
    latencyMs: statistics,
    raw: {
      file,
      encoding: "gzip Float64 native little endian, milliseconds",
      count: samples.length,
      sha256: createHash("sha256").update(raw).digest("hex"),
    },
  });
}
const { MatchSim, MATCH_SIMULATION_STEP } = await load("src/game/sim.ts");
const { buildTeamSetup } = await load("src/game/quickMatch.ts");
const checkpoints = [];
const fixture = { home: buildTeamSetup("fla"), away: buildTeamSetup("pal") };
for (const seed of ["bench-setup", "setup-parity-1", "setup-parity-2"]) {
  const sim = new MatchSim(fixture.home, fixture.away, seed);
  for (let tick = 0; tick <= 1800; tick++) {
    if (tick % 300 === 0)
      checkpoints.push({
        seed,
        tick,
        sha256: createHash("sha256").update(JSON.stringify(sim.checkpoint())).digest("hex"),
      });
    if (tick < 1800) sim.step(MATCH_SIMULATION_STEP, 6);
  }
  sim.dispose();
}
const report = {
  tag,
  root,
  capturedAt: new Date().toISOString(),
  sourceSha: execFileSync("git", ["-C", root, "rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  sourceDiffSha256: createHash("sha256")
    .update(
      execFileSync("git", ["-C", root, "diff", "HEAD", "--", "src/game", "wasm"], {
        maxBuffer: 20 * 1024 * 1024,
      }),
    )
    .digest("hex"),
  lockSha256: createHash("sha256")
    .update(await readFile(path.join(root, "package-lock.json")))
    .digest("hex"),
  fixtureSha256: createHash("sha256").update(JSON.stringify(fixture)).digest("hex"),
  environment: {
    node: process.version,
    v8: process.versions.v8,
    platform: process.platform,
    arch: process.arch,
    kernel: os.release(),
    cpu: os.cpus()[0]?.model,
    logicalProcessors: os.cpus().length,
  },
  protocol: {
    registrations: "existing CodSpeed match, season and rig fixtures",
    timeMs,
    warmupMs,
    instrument: "local Tinybench performance timer; not CodSpeed CI simulation, GPU or FPS",
  },
  checkpoints,
  cases,
};
await writeFile(path.join(output, `${tag}.json`), JSON.stringify(report, null, 2) + "\n");
console.log(
  JSON.stringify({
    tag,
    cases: cases.map((item) => ({
      name: item.name,
      meanMs: item.latencyMs.mean,
      p50Ms: item.latencyMs.p50,
      samples: item.raw.count,
    })),
    checkpoints: checkpoints.length,
  }),
);
