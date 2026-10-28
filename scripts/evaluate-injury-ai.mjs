import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";
const [root, out] = process.argv.slice(2);
const { buildTeamSetup } = await import(pathToFileURL(path.join(root, "src/game/quickMatch.ts")));
const { MatchSim, MATCH_SIMULATION_STEP, LIVE_MATCH_CLOCK_SCALE, MATCH_SIMULATION_TICK_LIMIT } =
  await import(pathToFileURL(path.join(root, "src/game/sim.ts")));
const rows = [];
for (let i = 0; i < 20; i++) {
  const seed = `injury-natural-eval-${i}`;
  const sim = new MatchSim(buildTeamSetup("fla"), buildTeamSetup("pal"), seed);
  let ticks = 0,
    last = 0;
  const events = [];
  while (!sim.finished && ticks++ < MATCH_SIMULATION_TICK_LIMIT) {
    sim.step(MATCH_SIMULATION_STEP, LIVE_MATCH_CLOCK_SCALE);
    const count = sim.lastEventId - last;
    if (count > 0) {
      events.push(
        ...sim.events
          .slice(-count)
          .filter((e) => (e.type === "injury" || e.type === "sub") && e.minute < 50),
      );
      last = sim.lastEventId;
    }
  }
  rows.push({
    seed,
    finished: sim.finished,
    score: [sim.stats.home.goals, sim.stats.away.goals],
    earlyInjuries: events.filter((e) => e.type === "injury").length,
    earlyInjurySubs: events.filter((e) => e.type === "sub" && e.text.includes("(lesão)")).length,
    subs: [sim.subsUsed.home, sim.subsUsed.away],
  });
  sim.dispose();
}
writeFileSync(out, JSON.stringify({ clubPair: ["fla", "pal"], matches: rows }, null, 2));
