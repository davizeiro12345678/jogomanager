import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";
const [root, output] = process.argv.slice(2);
const { buildTeamSetup } = await import(pathToFileURL(path.join(root, "src/game/quickMatch.ts")));
const { MatchSim, MATCH_SIMULATION_STEP, LIVE_MATCH_CLOCK_SCALE } = await import(
  pathToFileURL(path.join(root, "src/game/sim.ts"))
);
const sim = new MatchSim(
  buildTeamSetup("fla"),
  buildTeamSetup("pal"),
  "controlled-injury-evidence-20261028",
);
let steps = 0;
while (sim.time < 900 && !sim.finished && steps++ < 10000)
  sim.step(MATCH_SIMULATION_STEP, LIVE_MATCH_CLOCK_SCALE);
const before = createHash("sha256").update(JSON.stringify(sim.checkpoint())).digest("hex");
const player = sim.players.find(
  (p) =>
    p.side === "home" &&
    p.pos === "FW" &&
    !p.sentOff &&
    p.injuryWeeks === 0 &&
    sim.home.bench?.some(
      (b) => b.pos === p.pos && !b.suspended && b.injuryWeeks === 0 && b.condition > 40,
    ),
);
if (!player) throw new Error("No suitable attacker and reserve in fixture");
const injuredPid = player.pid;
player.injuryWeeks = 2;
sim.aiManage("home");
function snapshot() {
  return {
    time: sim.time,
    homeGoals: sim.stats.home.goals,
    awayGoals: sim.stats.away.goals,
    substitutions: sim.subsUsed.home,
    ball: { x: sim.ball.x, z: sim.ball.z },
    players: sim.players
      .filter((p) => !p.sentOff)
      .map((p) => ({
        pid: p.pid,
        side: p.side,
        name: p.name,
        x: p.x,
        z: p.z,
        injured: p.injuryWeeks > 0,
      })),
  };
}
const frames = [snapshot()];
for (let tick = 0; tick < 240 && !sim.finished; tick++) {
  sim.step(MATCH_SIMULATION_STEP, LIVE_MATCH_CLOCK_SCALE);
  if ((tick + 1) % 3 === 0) frames.push(snapshot());
}
writeFileSync(
  output,
  JSON.stringify({ root, seed: "controlled-injury-evidence-20261028", before, injuredPid, frames }),
);
sim.dispose();
