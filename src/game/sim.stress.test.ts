import { describe, expect, it } from "vitest";

import { buildTeamSetup } from "./quickMatch";
import {
  LIVE_MATCH_CLOCK_SCALE,
  MATCH_SIMULATION_STEP,
  MATCH_SIMULATION_TICK_LIMIT,
  MatchSim,
} from "./sim";

describe("MatchSim stress", () => {
  it("finishes 200 seeded matches inside the worker guard without a frozen loose ball", () => {
    for (let index = 0; index < 200; index += 1) {
      const sim = new MatchSim(buildTeamSetup("fla"), buildTeamSetup("pal"), `stress-${index}`);
      let guard = 0;
      let frozenLooseSeconds = 0;
      while (!sim.finished && guard++ < MATCH_SIMULATION_TICK_LIMIT) {
        const before = { x: sim.ball.x, z: sim.ball.z, holder: sim.ball.holder };
        sim.step(MATCH_SIMULATION_STEP, LIVE_MATCH_CLOCK_SCALE);
        const motion = Math.hypot(sim.ball.x - before.x, sim.ball.z - before.z);
        // intervalo, pausa da prorrogação e disputa param a bola de propósito
        if (sim.phase === "half" || sim.phase === "etBreak" || sim.phase === "shootout")
          frozenLooseSeconds = 0;
        else if (!sim.ball.holder && !before.holder && motion < 0.0001)
          frozenLooseSeconds += MATCH_SIMULATION_STEP;
        else frozenLooseSeconds = 0;
        // The old 13 x 0.4s threshold expressed in seconds, independent of tick size.
        expect(frozenLooseSeconds, `seed stress-${index}`).toBeLessThan(5.2);
      }
      expect(sim.finished, `seed stress-${index}`).toBe(true);
      expect(guard, `seed stress-${index}`).toBeLessThanOrEqual(MATCH_SIMULATION_TICK_LIMIT);
    }
  }, 300_000);
});
