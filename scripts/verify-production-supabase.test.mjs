import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile, symlink, truncate } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  productionSupabaseConfig,
  verifyBrowserSupabaseBundle,
  verifyProductionSupabase,
} from "./verify-production-supabase.mjs";

const env = {
  VITE_SUPABASE_URL: "https://lguqnwvsfeefxamzeyos.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture",
};

test("accepts the expected project and checks its public key remotely", async () => {
  const config = await verifyProductionSupabase(env, async (url, options) => {
    assert.equal(url, `${env.VITE_SUPABASE_URL}/auth/v1/settings`);
    assert.equal(options.headers.apikey, env.VITE_SUPABASE_PUBLISHABLE_KEY);
    assert.equal(options.redirect, "error");
    return { ok: true, status: 200 };
  });
  assert.equal(config.url, env.VITE_SUPABASE_URL);
});

test("rejects another project, secret keys, and inconsistent server configuration", () => {
  assert.throws(() =>
    productionSupabaseConfig({ ...env, VITE_SUPABASE_PROJECT_ID: "vylshefvsjggyjlhfups" }),
  );
  assert.throws(() =>
    productionSupabaseConfig({
      ...env,
      VITE_SUPABASE_URL: "https://vylshefvsjggyjlhfups.supabase.co",
    }),
  );
  assert.throws(() =>
    productionSupabaseConfig({ ...env, VITE_SUPABASE_PUBLISHABLE_KEY: "sb_secret_not_public" }),
  );
  assert.throws(() =>
    productionSupabaseConfig({ ...env, SUPABASE_URL: "https://vylshefvsjggyjlhfups.supabase.co" }),
  );
  assert.throws(() =>
    productionSupabaseConfig({ ...env, SUPABASE_PUBLISHABLE_KEY: "sb_publishable_other" }),
  );
});

test("allows only legacy anonymous keys for the expected project", () => {
  const token = (role, ref) =>
    `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ role, ref })).toString("base64url")}.signature`;
  const ref = "lguqnwvsfeefxamzeyos";
  assert.doesNotThrow(() =>
    productionSupabaseConfig({ ...env, VITE_SUPABASE_PUBLISHABLE_KEY: token("anon", ref) }),
  );
  assert.throws(() =>
    productionSupabaseConfig({ ...env, VITE_SUPABASE_PUBLISHABLE_KEY: token("service_role", ref) }),
  );
  assert.throws(() =>
    productionSupabaseConfig({
      ...env,
      VITE_SUPABASE_PUBLISHABLE_KEY: token("anon", "vylshefvsjggyjlhfups"),
    }),
  );
});

test("rejects a public key that the project does not accept", async () => {
  await assert.rejects(
    verifyProductionSupabase(env, async () => ({ ok: false, status: 401 })),
    /HTTP 401/,
  );
  await assert.rejects(
    verifyProductionSupabase(env, async () => {
      throw Error("network");
    }),
    /connectivity/,
  );
});

test("rejects stale browser assets even when the Worker settings are correct", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "supabase-assets-"));
  try {
    const target = path.join(dir, "client-a.js");
    await writeFile(
      target,
      '"Missing Supabase environment variable";"https://vylshefvsjggyjlhfups.supabase.co";"sb_publishable_old"',
    );
    await assert.rejects(
      verifyBrowserSupabaseBundle(dir, productionSupabaseConfig(env)),
      /built browser/,
    );
    await writeFile(
      target,
      `"Missing Supabase environment variable";"${env.VITE_SUPABASE_URL}";"${env.VITE_SUPABASE_PUBLISHABLE_KEY}"`,
    );
    await verifyBrowserSupabaseBundle(dir, productionSupabaseConfig(env));
    await rm(target);
    await assert.rejects(
      verifyBrowserSupabaseBundle(dir, productionSupabaseConfig(env)),
      /built browser/,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("rejects a symlinked JavaScript asset rather than following or silently skipping it", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "supabase-asset-link-"));
  const outside = await mkdtemp(path.join(os.tmpdir(), "supabase-asset-outside-"));
  try {
    await writeFile(
      path.join(outside, "foreign.js"),
      '"Missing Supabase environment variable";"https://lguqnwvsfeefxamzeyos.supabase.co";"sb_publishable_fixture"',
    );
    await symlink(path.join(outside, "foreign.js"), path.join(dir, "client-a.js"));
    await assert.rejects(
      verifyBrowserSupabaseBundle(dir, productionSupabaseConfig(env)),
      /symlink/i,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});

test("rejects oversized JavaScript assets before reading their contents", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "supabase-asset-large-"));
  try {
    const file = path.join(dir, "client-a.js");
    await writeFile(
      file,
      '"Missing Supabase environment variable";"https://lguqnwvsfeefxamzeyos.supabase.co";"sb_publishable_fixture"',
    );
    await truncate(file, 16 * 1024 * 1024 + 1);
    await assert.rejects(
      verifyBrowserSupabaseBundle(dir, productionSupabaseConfig(env)),
      /asset.*large/i,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
