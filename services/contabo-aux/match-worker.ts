import { parentPort, workerData } from "node:worker_threads";
import { CLUBS } from "../../src/game/data/leagues";
import { buildTeamSetup } from "../../src/game/quickMatch";
import {
  MATCH_SIMULATION_STEP,
  MATCH_SIMULATION_TICK_LIMIT,
  LIVE_MATCH_CLOCK_SCALE,
  MatchSim,
} from "../../src/game/sim";

try {
  const { homeClub, awayClub, seed } = workerData as {
    homeClub: string;
    awayClub: string;
    seed: string;
  };
  if (!CLUBS[homeClub] || !CLUBS[awayClub]) throw new Error("unknown_club");
  const sim = new MatchSim(buildTeamSetup(homeClub), buildTeamSetup(awayClub), seed);
  let steps = 0;
  while (!sim.finished && steps++ < MATCH_SIMULATION_TICK_LIMIT) {
    sim.step(MATCH_SIMULATION_STEP, LIVE_MATCH_CLOCK_SCALE);
  }
  if (!sim.finished) throw new Error("not_finished");
  parentPort?.postMessage({
    ok: true,
    homeGoals: sim.stats.home.goals,
    awayGoals: sim.stats.away.goals,
  });
} catch {
  parentPort?.postMessage({ ok: false });
}
