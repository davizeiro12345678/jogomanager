import { describe, expect, it } from "vitest";

import { buildTeamSetup } from "./quickMatch";
import { FIELD_X, MatchSim } from "./sim";

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

  it("releases a nominal goal that physically bends outside the posts", () => {
    const sim = create("curved-near-miss");
    const shooter = sim.players.find((player) => player.side === "home" && player.pos !== "GK");
    expect(shooter).toBeDefined();
    if (!shooter) return;

    const internals = sim as unknown as {
      pendingShot: {
        side: "home";
        shooter: string;
        outcome: "goal";
        fromX: number;
        fromZ: number;
        targetZ: number;
      } | null;
      resolveShot: () => boolean;
      looseTime: number;
    };
    sim.ball.holder = null;
    sim.ball.x = FIELD_X - 1;
    sim.ball.z = 3.9;
    sim.ball.height = 1.1;
    sim.ball.vx = 12;
    sim.ball.vz = 1.5;
    internals.pendingShot = {
      side: "home",
      shooter: shooter.id,
      outcome: "goal",
      fromX: 18,
      fromZ: 0,
      targetZ: 3.61,
    };

    expect(internals.resolveShot()).toBe(false);
    expect(internals.pendingShot).toBeNull();

    for (let tick = 0; tick < 30 && !sim.ball.holder; tick += 1) sim.step(0.2);
    expect(sim.ball.holder !== null || internals.looseTime < 3.5).toBe(true);
  });

  it("scores a physical goal when a large step crosses the whole goal plane", () => {
    const sim = create("goal-plane-crossing");
    const shooter = sim.players.find((player) => player.side === "home" && player.pos !== "GK");
    expect(shooter).toBeDefined();
    if (!shooter) return;
    const internals = sim as unknown as {
      pendingShot: {
        side: "home";
        shooter: string;
        outcome: "goal";
        fromX: number;
        fromZ: number;
        targetZ: number;
      } | null;
      resolveShot: (previous: { x: number; z: number; height: number }) => boolean;
    };
    sim.ball.x = FIELD_X + 1;
    sim.ball.z = 0.8;
    sim.ball.height = 1.2;
    internals.pendingShot = {
      side: "home",
      shooter: shooter.id,
      outcome: "goal",
      fromX: 24,
      fromZ: 0,
      targetZ: 0.8,
    };

    expect(internals.resolveShot({ x: FIELD_X - 5, z: 0.2, height: 0.8 })).toBe(true);
    expect(sim.stats.home.goals).toBe(1);
    expect(internals.pendingShot).toBeNull();
  });
});