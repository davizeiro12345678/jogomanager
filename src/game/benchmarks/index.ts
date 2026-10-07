/**
 * CPU benchmarks for the deterministic game engine, measured by CodSpeed.
 *
 * Run locally with `npm run bench`. In CI, the CodSpeed action runs the same
 * script under its CPU simulation instrument.
 */
import { withCodSpeed } from "@codspeed/tinybench-plugin";
import { Bench } from "tinybench";

import { registerMatchBenchmarks } from "./match";
import { registerSeasonBenchmarks } from "./season";

const bench = withCodSpeed(new Bench({ time: 200, warmupTime: 50 }));

registerMatchBenchmarks(bench);
registerSeasonBenchmarks(bench);

await bench.run();
console.table(bench.table());
