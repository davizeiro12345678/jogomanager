import assert from "node:assert/strict";
import test from "node:test";
import { stagingWorkerConfig } from "./cloudflare-staging-config.mjs";

const url = "https://skycnsjbcqmsaejaairl.supabase.co";
const env = {
  VITE_SUPABASE_URL: url,
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture",
  VITE_PAYMENTS_CLIENT_TOKEN: "pk_test_fixture",
};
const base = {
  name: "jogomanager-web",
  main: "index.mjs",
  assets: { directory: "../public", binding: "ASSETS" },
  routes: [{ pattern: "jogomanager.com", custom_domain: true }],
  vars: { PAYMENTS_ENVIRONMENT: "live" },
  previews: {
    vars: { PUBLIC_HTML_EDGE_CACHE_ENABLED: "1" },
    d1_databases: [{ binding: "SPORTS_DB", database_id: "fixture" }],
  },
};

test("isolates staging and never inherits production routes or variables", () => {
  const config = stagingWorkerConfig(base, env);
  assert.equal(config.name, "jogomanager-web-staging");
  assert.equal(config.workers_dev, false);
  assert.equal(config.preview_urls, false);
  assert.equal(Object.hasOwn(config, "previews"), false);
  assert.deepEqual(config.routes, []);
  assert.equal(config.vars.SUPABASE_URL, url);
  assert.equal(config.vars.PAYMENTS_ENVIRONMENT, "sandbox");
  assert.equal(config.vars.GUEST_CHECKOUT_LIVE_ENABLED, "false");
  assert.deepEqual(config.assets, base.assets);
});

test("rejects production project and mismatching server project", () => {
  const production = "https://lguqnwvsfeefxamzeyos.supabase.co";
  assert.throws(() => stagingWorkerConfig(base, { ...env, VITE_SUPABASE_URL: production }));
  assert.throws(() => stagingWorkerConfig(base, { ...env, SUPABASE_URL: production }));
});

test("rejects live Stripe and private Supabase browser keys", () => {
  assert.throws(() =>
    stagingWorkerConfig(base, { ...env, VITE_PAYMENTS_CLIENT_TOKEN: "pk_live_fixture" }),
  );
  assert.throws(() =>
    stagingWorkerConfig(base, { ...env, VITE_SUPABASE_PUBLISHABLE_KEY: "sb_secret_fixture" }),
  );
});

test("rejects unknown resource bindings instead of copying production resources", () => {
  assert.throws(() =>
    stagingWorkerConfig(
      { ...base, d1_databases: [{ binding: "DB", database_id: "production" }] },
      env,
    ),
  );
  assert.throws(() =>
    stagingWorkerConfig({ ...base, services: [{ binding: "MATCH", service: "production" }] }, env),
  );
});

test("rejects attempts to use production settings or route", () => {
  assert.throws(() => stagingWorkerConfig(base, { ...env, PAYMENTS_ENVIRONMENT: "live" }));
  assert.throws(() => stagingWorkerConfig(base, { ...env, SITE_URL: "https://jogomanager.com" }));
  assert.throws(() =>
    stagingWorkerConfig(base, { ...env, CLOUDFLARE_SITE_ZONE: "jogomanager.com" }),
  );
});
