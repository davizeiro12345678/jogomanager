import { createClient } from "@supabase/supabase-js";
import { pathToFileURL } from "node:url";

const MAX_HISTORY_LIMIT = 100;
const MAX_HISTORY_OFFSET = 100_000;
const MAX_TABLE_LIMIT = 1_000;
const MAX_INDEX_LIMIT = 5_000;

export function parseBoundedInteger(value, name, minimum, maximum, fallback = undefined) {
  if (value === undefined) {
    if (fallback !== undefined) return fallback;
    throw new Error(`${name} is required`);
  }
  if (!/^\d+$/.test(String(value))) throw new Error(`${name} must be an integer`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be between ${minimum} and ${maximum}`);
  }
  return parsed;
}

function optionValue(args, name) {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

export function createGrowthClient(env = process.env) {
  const url = env.SUPABASE_URL?.trim();
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceRoleKey) {
    const missing = [
      ...(!url ? ["SUPABASE_URL"] : []),
      ...(!serviceRoleKey ? ["SUPABASE_SERVICE_ROLE_KEY"] : []),
    ];
    throw new Error(`Missing required environment variable(s): ${missing.join(", ")}`);
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function rpc(client, functionName, args) {
  const { data, error } = await client.rpc(functionName, args);
  if (error) throw new Error(`Database growth RPC failed: ${functionName}`);
  return data;
}

export function captureSnapshot(client) {
  return rpc(client, "capture_database_growth_snapshot");
}

export function listSnapshots(client, limit = 30, offset = 0) {
  return rpc(client, "list_database_growth_snapshots", {
    p_limit: parseBoundedInteger(String(limit), "limit", 1, MAX_HISTORY_LIMIT),
    p_offset: parseBoundedInteger(String(offset), "offset", 0, MAX_HISTORY_OFFSET),
  });
}

export function getSnapshot(client, snapshotId, tableLimit = 500, indexLimit = 1000) {
  return rpc(client, "get_database_growth_snapshot", {
    p_snapshot_id: parseBoundedInteger(
      String(snapshotId),
      "snapshotId",
      1,
      Number.MAX_SAFE_INTEGER,
    ),
    p_table_limit: parseBoundedInteger(String(tableLimit), "tableLimit", 1, MAX_TABLE_LIMIT),
    p_index_limit: parseBoundedInteger(String(indexLimit), "indexLimit", 1, MAX_INDEX_LIMIT),
  });
}

export async function main(argv = process.argv.slice(2), env = process.env) {
  const [command = "history", ...args] = argv;
  const client = createGrowthClient(env);
  let result;

  if (command === "capture") {
    result = await captureSnapshot(client);
  } else if (command === "history") {
    const limit = optionValue(args, "--limit") ?? args[0] ?? "30";
    const offset = optionValue(args, "--offset") ?? args[1] ?? "0";
    result = await listSnapshots(client, limit, offset);
  } else if (command === "show") {
    const snapshotId = optionValue(args, "--snapshot-id") ?? args[0];
    const tableLimit = optionValue(args, "--table-limit") ?? args[1] ?? "500";
    const indexLimit = optionValue(args, "--index-limit") ?? args[2] ?? "1000";
    result = await getSnapshot(client, snapshotId, tableLimit, indexLimit);
  } else {
    throw new Error("Usage: database-growth-snapshot.mjs <capture|history|show> [bounded options]");
  }

  process.stdout.write(`${JSON.stringify(result)}\n`);
  return result;
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === invokedPath) {
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : "Database growth snapshot failed"}\n`,
    );
    process.exitCode = 1;
  });
}
