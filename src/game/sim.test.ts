import { describe, expect, it } from "vitest";

import { buildTeamSetup } from "./quickMatch";
import { MatchSim } from "./sim";

function create(seed = "engine-regression") {
  return new MatchSim(buildTeamSetup("fla"), buildTeamSetup("pal"), seed);
}

describe("MatchSim", () => {
  it("produces the same result from the same seed", () => {
    const first = create();
    const second = create();
    while (!first.finished) first.step(0.5);
    while (!second.finished) second.step(0.5);

    expect(first.stats).toEqual(second.stats);
    expect(first.scorers).toEqual(second.scorers);
    expect(first.shotMap).toEqual(second.shotMap);
  });

  it("finishes safely and keeps diagnostic collections bounded", () => {
    const sim = create("long-match");
    let guard = 0;
    while (!sim.finished && guard++ < 20_000) sim.step(0.5);

    expect(sim.finished).toBe(true);
    expect(sim.minute()).toBe(90);
    expect(sim.events.length).toBeLessThanOrEqual(80);
    expect(sim.shotMap.length).toBeLessThanOrEqual(120);
    expect(sim.players.every((player) => Number.isFinite(player.x) && Number.isFinite(player.z))).toBe(true);
    expect(Number.isFinite(sim.ball.x) && Number.isFinite(sim.ball.z)).toBe(true);
  });

  it("finishes many seeded matches without a stuck phase", () => {
    for (let index = 0; index < 8; index += 1) {
      const sim = create(`stability-${index}`);
      let guard = 0;
      while (!sim.finished && guard++ < 14_000) sim.step(0.4);
      expect(sim.finished, `seed stability-${index}`).toBe(true);
      expect(guard, `seed stability-${index}`).toBeLessThanOrEqual(14_000);
    }
  });
});