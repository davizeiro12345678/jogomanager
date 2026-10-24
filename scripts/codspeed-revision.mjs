import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [rootArg, label] = process.argv.slice(2);
if (!rootArg || !["baseline", "candidate"].includes(label))
  throw new Error("Usage: codspeed-revision.mjs SOURCE_ROOT baseline|candidate");
const root = path.resolve(rootArg);
const require = createRequire(path.join(root, "package.json"));
const { getCodspeedRunnerMode } = await import(pathToFileURL(require.resolve("@codspeed/core")));
if (getCodspeedRunnerMode() === "disabled")
  throw new Error("Run paired benchmarks through CodSpeed; raw timings are not accepted");
const { withCodSpeed } = await import(pathToFileURL(require.resolve("@codspeed/tinybench-plugin")));
const { Bench } = await import(pathToFileURL(require.resolve("tinybench")));
const bench = withCodSpeed(new Bench({ time: 200, warmupTime: 50 }));
const add = bench.add.bind(bench);
bench.add = (name, fn, options) => add(`${label}: ${name}`, fn, options);
// Reuse all existing workloads without changing their fixtures, seeds or loops.
for (const [file, register] of [
  ["match", "registerMatchBenchmarks"],
  ["season", "registerSeasonBenchmarks"],
  ["rig", "registerRigBenchmarks"],
  ["presentation", "registerPresentationBenchmarks"],
]) {
  const module = await import(pathToFileURL(path.join(root, `src/game/benchmarks/${file}.ts`)));
  module[register](bench);
}
const { LEAGUES } = await import(pathToFileURL(path.join(root, "src/game/data/leagues.ts")));
const { catalogFacts } = await import(
  pathToFileURL(path.join(root, "src/game/data/catalog-facts.ts"))
);
let counts;
bench.add("selection catalogue: identity counts", () => {
  counts = catalogFacts(LEAGUES);
});
await bench.run();
console.log(JSON.stringify({ label, catalogue: counts, scenarios: bench.tasks.length }));
