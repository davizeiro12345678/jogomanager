import { CLUBS } from "../../src/game/data/leagues.ts";
import { buildTeamSetup } from "../../src/game/quickMatch.ts";
import {
  LIVE_MATCH_CLOCK_SCALE,
  MATCH_SIMULATION_STEP,
  MATCH_SIMULATION_TICK_LIMIT,
  MatchSim,
} from "../../src/game/sim.ts";

// Exactly the canonical simulation used by finishMatchRoom.
// Never receive roster, scores, rewards or states from the browser.
export async function simulateAuthoritativeRoom(homeClub, awayClub, seed) {
  if (!Object.hasOwn(CLUBS, homeClub) || !Object.hasOwn(CLUBS, awayClub)) {
    throw new Error("unknown_club");
  }
  if (typeof seed !== "string" || seed.length < 16 || seed.length > 128) {
    throw new Error("invalid_seed");
  }
  const sim = new MatchSim(buildTeamSetup(homeClub), buildTeamSetup(awayClub), seed);
  let steps = 0;
  while (!sim.finished && steps < MATCH_SIMULATION_TICK_LIMIT) {
    sim.step(MATCH_SIMULATION_STEP, LIVE_MATCH_CLOCK_SCALE);
    steps += 1;
    // Cooperative yielding avoids starving health checks on a tiny VM.
    if (steps % 256 === 0) await new Promise((resolve) => setImmediate(resolve));
  }
  if (!sim.finished) throw new Error("simulation_tick_limit");
  return {
    hg: sim.stats.home.goals,
    ag: sim.stats.away.goals,
    minute: sim.minute(),
    steps,
  };
}
