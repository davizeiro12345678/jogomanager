import assert from "node:assert/strict";
import { test } from "node:test";
import { simulateAuthoritativeRoom } from "./engine.mjs";
import { MatchSim, MATCH_SIMULATION_STEP, LIVE_MATCH_CLOCK_SCALE, MATCH_SIMULATION_TICK_LIMIT } from "../../src/game/sim.ts";
import { buildTeamSetup } from "../../src/game/quickMatch.ts";

test("remote engine matches existing authoritative synchronous replay", { timeout: 120_000 }, async () => {
  const seed = "aux-smoke-2026-10-24-demo-seed";
  const remote = await simulateAuthoritativeRoom("fla", "pal", seed);
  const original = new MatchSim(buildTeamSetup("fla"), buildTeamSetup("pal"), seed);
  let steps = 0;
  while (!original.finished && steps++ < MATCH_SIMULATION_TICK_LIMIT) {
    original.step(MATCH_SIMULATION_STEP, LIVE_MATCH_CLOCK_SCALE);
  }
  assert.equal(original.finished, true);
  assert.deepEqual(remote, {
    hg: original.stats.home.goals,
    ag: original.stats.away.goals,
    minute: original.minute(),
    steps,
  });
});
test("rejects unknown clubs and invalid seed", async () => {
  await assert.rejects(() => simulateAuthoritativeRoom("__unknown__", "pal", "seed-not-allowed-here"), /unknown_club/);
  await assert.rejects(() => simulateAuthoritativeRoom("fla", "pal", "x"), /invalid_seed/);
});
