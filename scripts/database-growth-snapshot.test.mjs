import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  captureSnapshot,
  getSnapshot,
  listSnapshots,
  parseBoundedInteger,
} from "./database-growth-snapshot.mjs";

const migration = readFileSync(
  new URL("../drizzle/migrations/0060_database_growth_observability.sql", import.meta.url),
  "utf8",
);

test("migration keeps catalog metrics private and service-role-only", () => {
  assert.match(migration, /CREATE SCHEMA IF NOT EXISTS database_growth_private/);
  assert.match(
    migration,
    /ALTER TABLE database_growth_private\.snapshots ENABLE ROW LEVEL SECURITY/,
  );
  assert.match(
    migration,
    /REVOKE ALL ON FUNCTION public\.capture_database_growth_snapshot\(\) FROM PUBLIC, anon, authenticated/,
  );
  assert.match(
    migration,
    /GRANT EXECUTE ON FUNCTION public\.capture_database_growth_snapshot\(\) TO service_role/,
  );
  assert.match(migration, /SECURITY INVOKER/);
  assert.doesNotMatch(migration, /^\s*SECURITY DEFINER/m);
});

test("migration reads bounded PostgreSQL catalog statistics instead of application rows", () => {
  assert.match(migration, /pg_catalog\.pg_database_size/);
  assert.match(migration, /pg_catalog\.pg_total_relation_size/);
  assert.match(migration, /pg_catalog\.pg_stat_user_tables/);
  assert.match(migration, /pg_catalog\.pg_stat_user_indexes/);
  assert.match(migration, /n_live_tup/);
  assert.match(migration, /n_dead_tup/);
  assert.match(migration, /last_autovacuum/);
  assert.match(migration, /last_autoanalyze/);
  assert.doesNotMatch(migration, /COUNT\s*\(\s*\*\s*\)\s+FROM\s+public\./i);
});

test("CLI bounds history and detail reads", () => {
  assert.equal(parseBoundedInteger("30", "limit", 1, 100), 30);
  assert.equal(parseBoundedInteger(undefined, "limit", 1, 100, 30), 30);
  assert.throws(() => parseBoundedInteger("101", "limit", 1, 100), /between 1 and 100/);
  assert.throws(() => parseBoundedInteger("-1", "offset", 0, 100000), /must be an integer/);
  assert.throws(() => parseBoundedInteger("1.5", "tableLimit", 1, 1000), /must be an integer/);
});

test("CLI calls only the service-role RPC contracts", async () => {
  const calls = [];
  const client = {
    rpc: async (name, args) => {
      calls.push({ name, args });
      return { data: { name }, error: null };
    },
  };

  await captureSnapshot(client);
  await listSnapshots(client, 5, 10);
  await getSnapshot(client, 7, 20, 40);

  assert.deepEqual(calls, [
    { name: "capture_database_growth_snapshot", args: undefined },
    { name: "list_database_growth_snapshots", args: { p_limit: 5, p_offset: 10 } },
    {
      name: "get_database_growth_snapshot",
      args: { p_snapshot_id: 7, p_table_limit: 20, p_index_limit: 40 },
    },
  ]);
});
