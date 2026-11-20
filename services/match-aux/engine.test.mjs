import assert from "node:assert/strict";
import { test } from "node:test";
import { simulateAuthoritativeRoom } from "./engine.mjs";
import { createMatchSimulationPool, matchSimulationCapacity } from "./engine-pool.mjs";
import {
  MatchSim,
  MATCH_SIMULATION_STEP,
  LIVE_MATCH_CLOCK_SCALE,
  MATCH_SIMULATION_TICK_LIMIT,
} from "../../src/game/sim.ts";
import { buildTeamSetup } from "../../src/game/quickMatch.ts";

test(
  "remote engine matches existing authoritative synchronous replay",
  { timeout: 120_000 },
  async () => {
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
  },
);
test("rejects unknown clubs and invalid seed", async () => {
  await assert.rejects(
    () => simulateAuthoritativeRoom("__unknown__", "pal", "seed-not-allowed-here"),
    /unknown_club/,
  );
  await assert.rejects(() => simulateAuthoritativeRoom("fla", "pal", "x"), /invalid_seed/);
});

test("match worker capacity respects CPU and memory before allocating threads", () => {
  const gib = 1024 ** 3;
  assert.equal(matchSimulationCapacity("512", 512, 128 * gib), 512);
  assert.equal(matchSimulationCapacity("512", 256, 128 * gib), 256);
  assert.equal(matchSimulationCapacity("512", 12, 48 * gib), 12);
  assert.equal(matchSimulationCapacity("512", 12, 384 * 1024 ** 2), 2);
  assert.throws(() => matchSimulationCapacity("513", 512, 128 * gib), RangeError);
});

test("two active workers preserve exact seeded results and bound admission", async () => {
  const pool = createMatchSimulationPool(2);
  const firstSeed = "parallel-parity-home-1";
  const secondSeed = "parallel-parity-away-2";
  try {
    const first = pool.run("fla", "pal", firstSeed);
    const second = pool.run("pal", "fla", secondSeed);
    await assert.rejects(pool.run("fla", "pal", firstSeed), /simulation_pool_busy/);
    const results = await Promise.all([first, second]);
    assert.deepEqual(results, [
      await simulateAuthoritativeRoom("fla", "pal", firstSeed),
      await simulateAuthoritativeRoom("pal", "fla", secondSeed),
    ]);
    await assert.rejects(pool.run("invalid", "pal", firstSeed), /unknown_club/);
    assert.deepEqual(await pool.run("fla", "pal", firstSeed), results[0]);
  } finally {
    await pool.close();
  }
  await assert.rejects(pool.run("fla", "pal", firstSeed), /simulation_pool_closed/);
});
