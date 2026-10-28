// Descriptive, deterministic simulation comparison. It never calls OpenAI.
import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";

const [baseline, candidate, output] = process.argv.slice(2);
if (!baseline || !candidate || !output) throw new Error("baseline candidate output required");

async function run(root, withInstructions) {
  const { buildTeamSetup } = await import(pathToFileURL(path.join(root, "src/game/quickMatch.ts")));
  const { MatchSim, MATCH_SIMULATION_STEP, LIVE_MATCH_CLOCK_SCALE, MATCH_SIMULATION_TICK_LIMIT } =
    await import(pathToFileURL(path.join(root, "src/game/sim.ts")));
  const records = [];
  for (let index = 0; index < 10; index++) {
    const home = buildTeamSetup("fla");
    const away = buildTeamSetup("pal");
    if (withInstructions) {
      home.tactics.playerInstructions = {
        GK: "cautious",
        DF: "balanced",
        MF: "balanced",
        FW: "attacking",
      };
      away.tactics.playerInstructions = {
        GK: "cautious",
        DF: "balanced",
        MF: "attacking",
        FW: "attacking",
      };
    }
    const sim = new MatchSim(home, away, `role-plan-evaluation-${index}`);
    let steps = 0;
    while (!sim.finished && steps++ < MATCH_SIMULATION_TICK_LIMIT)
      sim.step(MATCH_SIMULATION_STEP, LIVE_MATCH_CLOCK_SCALE);
    if (!sim.finished) throw new Error(`unfinished fixture ${index}`);
    records.push({
      seed: `role-plan-evaluation-${index}`,
      steps,
      home: { ...sim.stats.home },
      away: { ...sim.stats.away },
    });
    sim.dispose();
  }
  return records;
}

const before = await run(baseline, false);
const afterWithoutInstructions = await run(candidate, false);
const afterWithInstructions = await run(candidate, true);
if (JSON.stringify(before) !== JSON.stringify(afterWithoutInstructions))
  throw new Error("default simulation changed when no instructions were supplied");
const total = (rows, key) => rows.reduce((sum, row) => sum + row.home[key] + row.away[key], 0);
const result = {
  source: "fixed fixture, no OpenAI request",
  clubs: ["fla", "pal"],
  seeds: 10,
  defaultSimulationIdentical: true,
  totals: {
    baseline: {
      shots: total(before, "shots"),
      passes: total(before, "passes"),
      goals: total(before, "goals"),
    },
    fixedPlan: {
      shots: total(afterWithInstructions, "shots"),
      passes: total(afterWithInstructions, "passes"),
      goals: total(afterWithInstructions, "goals"),
    },
  },
  baseline: before,
  defaultCandidate: afterWithoutInstructions,
  candidateFixedPlan: afterWithInstructions,
};
await writeFile(output, JSON.stringify(result, null, 2) + "\n");
console.log(
  JSON.stringify({ seeds: result.seeds, defaultSimulationIdentical: true, totals: result.totals }),
);
