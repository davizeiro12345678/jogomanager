import { describe, expect, it } from "vitest";

import { buildTeamSetup } from "./quickMatch";
import { MatchSim } from "./sim";

describe("MatchSim stress", () => {
  it("finishes 200 seeded matches inside the worker guard without a frozen loose ball", () => {
    for (let index = 0; index < 200; index += 1) {
      const sim = new MatchSim(buildTeamSetup("fla"), buildTeamSetup("pal"), `stress-${index}`);
      let guard = 0;
      let frozenLooseTicks = 0;
      while (!sim.finished && guard++ < 14_000) {
        const before = { x: sim.ball.x, z: sim.ball.z, holder: sim.ball.holder };
        sim.step(0.4);
        const motion = Math.hypot(sim.ball.x - before.x, sim.ball.z - before.z);
        if (!sim.ball.holder && !before.holder && motion < 0.0001) frozenLooseTicks += 1;
        else frozenLooseTicks = 0;
        expect(frozenLooseTicks, `seed stress-${index}`).toBeLessThan(13);
      }
      expect(sim.finished, `seed stress-${index}`).toBe(true);
      expect(guard, `seed stress-${index}`).toBeLessThanOrEqual(14_000);
    }
  }, 180_000);
});
