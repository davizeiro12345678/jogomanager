// Optional development tool. Install PGlite under .cache/sql-validation only;
// it is not an application/runtime dependency and never connects to Supabase.
import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { performance } from "node:perf_hooks";

const modulePath = resolve(
  process.argv[2] ?? ".cache/sql-validation/node_modules/@electric-sql/pglite/dist/index.js",
);
const { PGlite } = await import(pathToFileURL(modulePath).href);
const pgliteVersion = JSON.parse(
  await readFile(new URL("../package.json", pathToFileURL(modulePath)), "utf8"),
).version;
const began = performance.now();
const pg = await PGlite.create();
const sources = [
  "drizzle/migrations/0023_multiplayer_server_authority.sql",
  "drizzle/migrations/0061_career_tombstone_generation.sql",
  "drizzle/migrations/0063_repair_career_and_push_access.sql",
  "drizzle/migrations/0064_support_ticket_outbox.sql",
  "drizzle/migrations/0065_atomic_match_room_creation.sql",
];
const fixtures = [
  "tests/sql/career-tombstone-generation-contract.sql",
  "tests/sql/support-outbox-contract.sql",
  "tests/sql/atomic-match-room-contract.sql",
];
const digest = createHash("sha256");
const evidence = {
  runtime: process.version,
  pgliteVersion,
  startedAt: new Date().toISOString(),
  kind: "ephemeral_wasm_postgresql_contract_replay",
  sources,
  fixtures,
  checks: [],
  success: false,
  scope:
    "In-memory PostgreSQL via optional PGlite, minimal Supabase-style roles and prerequisite tables, actual forward SQL and fixture bodies. No remote service, personal data, webhook or production writes. Full Supabase replay and multi-process lock contention remain separate required checks.",
};
try {
  await pg.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role BYPASSRLS;
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb, email_confirmed_at timestamptz);
    CREATE TABLE public.careers(user_id uuid PRIMARY KEY, state jsonb NOT NULL DEFAULT '{}'::jsonb, verified_progress boolean NOT NULL DEFAULT false);
    ALTER TABLE public.careers ENABLE ROW LEVEL SECURITY;
    CREATE TABLE public.push_subscriptions(id uuid PRIMARY KEY);
    CREATE TABLE public.match_rooms(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL UNIQUE,
      host_id uuid NOT NULL, guest_id uuid, host_club text NOT NULL, guest_club text,
      seed text NOT NULL, status text NOT NULL DEFAULT 'open', minute integer NOT NULL DEFAULT 0,
      state jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
    );
    ALTER TABLE public.match_rooms ENABLE ROW LEVEL SECURITY;
    GRANT ALL ON public.match_rooms TO service_role;
  `);
  evidence.postgresql = (await pg.query("SELECT version() AS version")).rows[0].version;
  for (const path of sources) {
    const sql = await readFile(new URL(`../${path}`, import.meta.url), "utf8");
    digest.update(path).update(sql);
    await pg.exec(sql);
    evidence.checks.push({ path, passed: true });
  }
  for (const path of fixtures) {
    const sql = await readFile(new URL(`../${path}`, import.meta.url), "utf8");
    digest.update(path).update(sql);
    await pg.exec(sql.replace(/^\\.*$/gm, ""));
    evidence.checks.push({ path, passed: true });
  }
  evidence.success = true;
} catch (error) {
  evidence.error = {
    message: error.message,
    code: error.code ?? null,
    detail: error.detail ?? null,
  };
  process.exitCode = 1;
} finally {
  evidence.sourceDigest = digest.digest("hex");
  evidence.durationMs = performance.now() - began;
  await pg.close();
  const output = new URL(
    "../verification/quality-update-20261108/local-database-validation.json",
    import.meta.url,
  );
  await mkdir(new URL(".", output), { recursive: true });
  await writeFile(output, JSON.stringify(evidence, null, 2) + "\n");
  console.log(JSON.stringify(evidence, null, 2));
}
