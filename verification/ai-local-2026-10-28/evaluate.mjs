import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import path from "node:path";

const [action, root, fixturePath, outputPath, amount = "24"] = process.argv.slice(2);
const load = (file) => import(pathToFileURL(path.join(root, file)).href);
if (action === "fixture") {
  const { buildTeamSetup } = await load("src/game/quickMatch.ts");
  const fixture = {
    home: buildTeamSetup("fla", "4-3-3", 2, 1),
    away: buildTeamSetup("pal", "4-4-2", 3, 2),
  };
  await writeFile(fixturePath, JSON.stringify(fixture));
  console.log("Identical match fixture created.");
} else if (action === "evaluate") {
  const { MatchSim, MATCH_SIMULATION_STEP, LIVE_MATCH_CLOCK_SCALE, MATCH_SIMULATION_TICK_LIMIT } =
    await load("src/game/sim.ts");
  const source = await readFile(fixturePath, "utf8");
  const fixture = JSON.parse(source);
  const count = Number(amount);
  if (!Number.isInteger(count) || count < 1 || count > 200) throw Error("Invalid seed count");
  const cases = [];
  for (let i = 0; i < count; i++) {
    const seed = `ai-tactical-comparison-${String(i).padStart(3, "0")}`;
    const sim = new MatchSim(structuredClone(fixture.home), structuredClone(fixture.away), seed);
    let ticks = 0;
    while (!sim.finished && ticks < MATCH_SIMULATION_TICK_LIMIT) {
      sim.step(MATCH_SIMULATION_STEP, LIVE_MATCH_CLOCK_SCALE);
      ticks++;
    }
    if (!sim.finished) throw Error(`Match failed to finish: ${seed}`);
    cases.push({ seed, ticks, home: { ...sim.stats.home }, away: { ...sim.stats.away } });
    sim.dispose();
  }
  const totals = Object.fromEntries(
    ["goals", "shots", "onTarget", "passes", "passesOk", "xg", "offsides", "interceptions"].map(
      (k) => [k, cases.reduce((sum, item) => sum + item.home[k] + item.away[k], 0)],
    ),
  );
  const result = {
    fixtureSha256: createHash("sha256").update(source).digest("hex"),
    fixture: "fla 4-3-3 vs pal 4-4-2 (dificil)",
    step: MATCH_SIMULATION_STEP,
    clockScale: LIVE_MATCH_CLOCK_SCALE,
    count,
    totals,
    cases,
  };
  await writeFile(outputPath, JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify({ count, fixtureSha256: result.fixtureSha256, totals }));
} else throw Error("Expected fixture or evaluate");
