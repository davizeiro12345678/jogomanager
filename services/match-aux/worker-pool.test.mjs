import assert from "node:assert/strict";
import { test } from "node:test";
import { MatchWorkerPool, PoolBusyError } from "./worker-pool.mjs";
import { CLUBS } from "../../src/game/data/leagues.ts";

const clubs = Object.keys(CLUBS);
if (clubs.length < 2) throw Error("test_club_catalog_unavailable");

test("two workers complete eight authoritative simulations without dropping requests", async () => {
  const pool = new MatchWorkerPool({ size: 2, maxQueue: 8, timeoutMs: 25_000 });
  try {
    const jobs = Array.from({ length: 8 }, (_, index) =>
      pool.run({
        homeClub: clubs[0],
        awayClub: clubs[1],
        seed: "bounded-parallel-authority-" + String(index).padStart(4, "0"),
      }),
    );
    const results = await Promise.all(jobs);
    assert.equal(results.length, 8);
    for (const result of results) {
      assert.ok(Number.isInteger(result.hg));
      assert.ok(Number.isInteger(result.ag));
      assert.ok(result.steps > 100);
    }
  } finally {
    await pool.close();
  }
});

test("queued work is bounded and excess requests are rejected", async () => {
  const pool = new MatchWorkerPool({ size: 1, maxQueue: 1, timeoutMs: 25_000 });
  try {
    const input = {
      homeClub: clubs[0],
      awayClub: clubs[1],
      seed: "bounded-queue-authority-test-20261112",
    };
    const first = pool.run(input);
    const queued = pool.run({ ...input, seed: input.seed + "-second" });
    await assert.rejects(pool.run({ ...input, seed: input.seed + "-third" }), PoolBusyError);
    const results = await Promise.all([first, queued]);
    assert.equal(results.length, 2);
    assert.equal(pool.activeCount, 0);
    assert.equal(pool.queuedCount, 0);
  } finally {
    await pool.close();
  }
});

test("closed pools reject new work", async () => {
  const pool = new MatchWorkerPool({ size: 1, maxQueue: 1 });
  await pool.close();
  await assert.rejects(
    pool.run({ homeClub: clubs[0], awayClub: clubs[1], seed: "closed-pool-test" }),
    /pool_closed/,
  );
});
