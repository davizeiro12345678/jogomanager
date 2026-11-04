#!/usr/bin/env node
/**
 * STAGING ONLY: RLS/IDOR read contracts using two disposable user JWTs.
 * Does not use service_role, edit rows, or print access tokens or data.
 */
const env = process.env;
const needed = [
  "STAGING_SUPABASE_URL", "STAGING_PROJECT_REF", "STAGING_PUBLISHABLE_KEY",
  "STAGING_JWT_A", "STAGING_JWT_B", "STAGING_USER_A_ID", "STAGING_USER_B_ID",
];
for (const key of needed) {
  if (!env[key]) throw new Error("Missing " + key + " (staging only)");
}
if (env.STAGING_ACK_ISOLATED !== "true") {
  throw new Error("Set STAGING_ACK_ISOLATED=true after verifying a disposable staging database");
}
const origin = new URL(env.STAGING_SUPABASE_URL);
const ref = env.STAGING_PROJECT_REF;
if (
  origin.protocol !== "https:" || origin.hostname !== ref + ".supabase.co" ||
  ref === "lguqnwvsfeefxamzeyos" || ref.length < 12 ||
  !/^[a-z0-9]+$/.test(ref)
) throw new Error("Refusing production or unverified staging URL");
const a = env.STAGING_USER_A_ID;
const b = env.STAGING_USER_B_ID;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!uuid.test(a) || !uuid.test(b) || a === b) {
  throw new Error("Two different test user UUIDs required");
}
if (env.STAGING_JWT_A === env.STAGING_JWT_B) throw new Error("Distinct test-user JWTs required");
async function selectOwner(table, jwt, owner) {
  const target = new URL("/rest/v1/" + table, origin);
  target.searchParams.set("select", "user_id");
  target.searchParams.set("user_id", "eq." + owner);
  const res = await fetch(target, {
    headers: {
      apikey: env.STAGING_PUBLISHABLE_KEY,
      authorization: "Bearer " + jwt,
      accept: "application/json",
    },
    redirect: "error",
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(table + " SELECT HTTP " + res.status);
  const rows = await res.json();
  if (!Array.isArray(rows)) throw new Error(table + " response is not an array");
  if (rows.some((row) => row.user_id !== owner)) {
    throw new Error(table + " returned unexpected user_id");
  }
  return rows.length;
}
for (const table of ["careers", "player_careers", "user_wallet"]) {
  const ownA = await selectOwner(table, env.STAGING_JWT_A, a);
  const ownB = await selectOwner(table, env.STAGING_JWT_B, b);
  if (!ownA || !ownB) throw new Error(table + " needs fixture rows owned by A and B");
  const leakA = await selectOwner(table, env.STAGING_JWT_A, b);
  const leakB = await selectOwner(table, env.STAGING_JWT_B, a);
  if (leakA || leakB) throw new Error(table + " RLS cross-account read");
  console.log(JSON.stringify({ table, ownA: true, ownB: true, crossReadBlocked: true }));
}
console.log("PASS: staging SELECT isolation for careers, player_careers and user_wallet");
