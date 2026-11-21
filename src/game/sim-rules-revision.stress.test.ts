import { describe, expect, it } from "vitest";
import { buildTeamSetup } from "./quickMatch";
import { restoreMatchRulesState } from "./offside-phase";
import {
  MatchSim,
  FIELD_X,
  FIELD_Z,
  LIVE_MATCH_CLOCK_SCALE,
  MATCH_SIMULATION_STEP,
  MATCH_SIMULATION_TICK_LIMIT,
} from "./sim";

function invariants(sim: MatchSim, seed: string, tick: number) {
  const ball = sim.ball;
  if (
    !Number.isFinite(sim.time) ||
    !Number.isFinite(ball.x) ||
    !Number.isFinite(ball.z) ||
    !Number.isFinite(ball.vx) ||
    !Number.isFinite(ball.vz) ||
    !Number.isFinite(ball.height) ||
    Math.abs(ball.x) > FIELD_X + 2 ||
    Math.abs(ball.z) > FIELD_Z + 2 ||
    ball.height < 0.1 ||
    ball.height > 12
  )
    throw new Error(`${seed} tick ${tick}: invalid ball state`);
  if (tick % 300 !== 0 && !sim.finished) return;
  if (sim.players.length > 22 || sim.events.length > 80 || sim.shotMap.length > 120)
    throw new Error(`${seed} tick ${tick}: unbounded match state`);
  for (const player of sim.players)
    if (
      !Number.isFinite(player.x) ||
      !Number.isFinite(player.z) ||
      !Number.isFinite(player.vx) ||
      !Number.isFinite(player.vz) ||
      !Number.isFinite(player.stamina) ||
      player.stamina < 0 ||
      player.stamina > 100 ||
      (player.sentOff && sim.ball.holder === player.id)
    )
      throw new Error(`${seed} tick ${tick}: invalid athlete ${player.id}`);
  const checkpoint = sim.checkpoint();
  if (checkpoint.execution?.rulesRevision !== 2)
    throw new Error(`${seed} tick ${tick}: revised rules not selected`);
  restoreMatchRulesState(
    checkpoint.rulesState,
    sim.players,
    checkpoint.state["subsOut"],
    sim.time,
    sim.ball.holder,
  );
}

describe("MatchSim rules revision 2 stress", () => {
  for (let index = 0; index < 200; index++) {
    const seed = `rules-stress-${index}`;
    it(`${seed} finishes and reproduces canonical state`, () => {
      const create = () =>
        new MatchSim(buildTeamSetup("fla"), buildTeamSetup("pal"), seed, { rulesRevision: 2 });
      const sim = create();
      const replay = create();
      try {
        let ticks = 0;
        let frozenLooseSeconds = 0;
        while (!sim.finished && ticks < MATCH_SIMULATION_TICK_LIMIT) {
          const x = sim.ball.x,
            z = sim.ball.z,
            holder = sim.ball.holder;
          const previousTime = sim.time;
          sim.step(MATCH_SIMULATION_STEP, LIVE_MATCH_CLOCK_SCALE);
          ticks++;
          invariants(sim, seed, ticks);
          if (sim.time < previousTime) throw new Error(`${seed}: match clock moved backwards`);
          if (sim.phase === "half" || sim.phase === "etBreak" || sim.phase === "shootout")
            frozenLooseSeconds = 0;
          else if (
            !holder &&
            !sim.ball.holder &&
            Math.hypot(sim.ball.x - x, sim.ball.z - z) < 0.0001
          )
            frozenLooseSeconds += MATCH_SIMULATION_STEP;
          else frozenLooseSeconds = 0;
          if (frozenLooseSeconds >= 5.2)
            throw new Error(`${seed}: frozen loose ball for ${frozenLooseSeconds}s`);
        }
        expect(sim.finished, seed).toBe(true);
        expect(ticks, seed).toBeLessThanOrEqual(MATCH_SIMULATION_TICK_LIMIT);
        let replayTicks = 0;
        while (!replay.finished && replayTicks < MATCH_SIMULATION_TICK_LIMIT) {
          replay.step(MATCH_SIMULATION_STEP, LIVE_MATCH_CLOCK_SCALE);
          replayTicks++;
          invariants(replay, seed, replayTicks);
        }
        expect(replay.finished, seed).toBe(true);
        expect(replayTicks, seed).toBe(ticks);
        expect(replay.checkpoint(), seed).toEqual(sim.checkpoint());
      } finally {
        sim.dispose();
        replay.dispose();
      }
    }, 30_000);
  }
});
