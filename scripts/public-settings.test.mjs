import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { loadPublicSettings, validateBrowserEnv } from "./public-settings.mjs";

function makeProject(t, changes = {}) {
  const root = mkdtempSync(path.join(tmpdir(), "jogomanager-public-config-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(path.join(root, "config"));
  const shared = {
    SUPABASE_PROJECT_ID: "project123",
    SUPABASE_URL: "https://project123.supabase.co",
    SUPABASE_PUBLISHABLE_KEY: "sb_publishable_public_fixture",
    VITE_SUPABASE_PROJECT_ID: "project123",
    VITE_SUPABASE_URL: "https://project123.supabase.co",
    VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_public_fixture",
  };
  const development = {
    VITE_PAYMENTS_CLIENT_TOKEN: "pk_test_public_fixture",
    VITE_AUTH_MODE: "supabase",
    PAYMENTS_ENVIRONMENT: "sandbox",
    GUEST_CHECKOUT_ENVIRONMENT: "sandbox",
    GUEST_CHECKOUT_SANDBOX_ENABLED: "false",
  };
  const production = {
    VITE_PAYMENTS_CLIENT_TOKEN: "pk_live_public_fixture",
    VITE_AUTH_MODE: "supabase",
    PAYMENTS_ENVIRONMENT: "live",
    GUEST_CHECKOUT_ENVIRONMENT: "live",
    GUEST_CHECKOUT_LIVE_ENABLED: "false",
  };
  const config = { shared, development, production, ...changes };
  writeFileSync(path.join(root, "config/public-settings.json"), JSON.stringify(config));
  return root;
}

test("public settings select matching payment modes without local env files", (t) => {
  const root = makeProject(t);
  assert.equal(
    loadPublicSettings("development", root).VITE_PAYMENTS_CLIENT_TOKEN,
    "pk_test_public_fixture",
  );
  assert.equal(loadPublicSettings("development", root).PAYMENTS_ENVIRONMENT, "sandbox");
  assert.equal(
    loadPublicSettings("production", root).VITE_PAYMENTS_CLIENT_TOKEN,
    "pk_live_public_fixture",
  );
  assert.equal(loadPublicSettings("production", root).PAYMENTS_ENVIRONMENT, "live");
  assert.equal(loadPublicSettings("staging", root).VITE_PAYMENTS_CLIENT_TOKEN, undefined);
});

test("public config rejects private credentials without reporting their values", (t) => {
  const root = makeProject(t);
  const filename = path.join(root, "config/public-settings.json");
  const cfg = JSON.parse(readFileSync(filename, "utf8"));
  const secret = ["sk", "-proj-", "a".repeat(48)].join("");
  cfg.shared.VITE_SUPABASE_PUBLISHABLE_KEY = secret;
  writeFileSync(filename, JSON.stringify(cfg));
  assert.throws(
    () => loadPublicSettings("production", root),
    (error) => !error.message.includes(secret),
  );
});

test("public config rejects unapproved new variables", (t) => {
  const root = makeProject(t, { shared: { OPENAI_API_KEY: "some-value" } });
  assert.throws(() => loadPublicSettings("production", root));
});

test("browser build rejects secret names and values supplied by its environment", () => {
  const secret = ["sk", "-proj-", "a".repeat(48)].join("");
  assert.throws(
    () => validateBrowserEnv({ VITE_OPENAI_API_KEY: secret }),
    (error) => !error.message.includes(secret),
  );
  assert.throws(() =>
    validateBrowserEnv({ VITE_PAYMENTS_CLIENT_TOKEN: ["sk", "_live_private"].join("") }),
  );
  assert.doesNotThrow(() => validateBrowserEnv({ VITE_PAYMENTS_CLIENT_TOKEN: "pk_live_public" }));
});

test("browser build rejects a Supabase service-role JWT supplied as a public key", () => {
  const header = Buffer.from(JSON.stringify({ alg: "HS256" })).toString("base64url");
  const claims = Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url");
  const token = `${header}.${claims}.signature`;
  assert.throws(
    () => validateBrowserEnv({ VITE_SUPABASE_PUBLISHABLE_KEY: token }),
    (error) => !error.message.includes(token),
  );
});

test("public config rejects a payment mode mismatch", (t) => {
  const root = makeProject(t);
  const filename = path.join(root, "config/public-settings.json");
  const cfg = JSON.parse(readFileSync(filename, "utf8"));
  cfg.production.VITE_PAYMENTS_CLIENT_TOKEN = "pk_test_public_fixture";
  writeFileSync(filename, JSON.stringify(cfg));
  assert.throws(() => loadPublicSettings("production", root));
});
