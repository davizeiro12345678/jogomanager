import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  assertStripePublicBuildKey,
  resolveStripePublicBuildKey,
} from "./stripe-public-build-env.mjs";

const key = "pk_live_validPublicKey12345";
const configured = (text = key, type = "plain_text") => ({
  success: true,
  result: { bindings: [{ name: "VITE_PAYMENTS_CLIENT_TOKEN", type, text }] },
});
const response = (result) => ({ ok: true, status: 200, json: async () => result });

test("retrieves only the public live Stripe key from the configured Cloudflare Worker", async () => {
  const calls = [];
  const value = await resolveStripePublicBuildKey({
    token: "fixture-token",
    accountId: "account-test",
    environment: "live",
    fetchImpl: async (url, options) => {
      calls.push({ url, authorization: options.headers.Authorization });
      return response(configured());
    },
  });
  assert.equal(value, key);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /workers\/scripts\/jogomanager-web\/settings$/);
  assert.equal(calls[0].authorization, "Bearer fixture-token");
});

for (const [name, data] of [
  ["missing binding", { success: true, result: { bindings: [] } }],
  ["secret binding", configured(key, "secret_text")],
  ["test key in live mode", configured("pk_test_123456789")],
  ["non-Stripe value", configured("sk_live_abc")],
  ["untrusted line breaks", configured("pk_live_valid\nVITE_OTHER=bad")],
]) {
  test(`refuses ${name} without writing a production build variable`, async () => {
    await assert.rejects(
      resolveStripePublicBuildKey({
        token: "fixture-token",
        accountId: "account-test",
        environment: "live",
        fetchImpl: async () => response(data),
      }),
    );
  });
}

test("fails closed on Cloudflare errors or missing credentials", async () => {
  await assert.rejects(
    resolveStripePublicBuildKey({
      token: "",
      accountId: "account-test",
      fetchImpl: async () => response(configured()),
    }),
  );
  await assert.rejects(
    resolveStripePublicBuildKey({
      token: "fixture-token",
      accountId: "account-test",
      fetchImpl: async () => ({ ok: false, status: 403 }),
    }),
  );
});

test("manual Wrangler deployment rejects missing or wrong-environment public keys", () => {
  assert.equal(assertStripePublicBuildKey("pk_live_1234567890", "live"), "pk_live_1234567890");
  assert.equal(assertStripePublicBuildKey("pk_test_1234567890", "sandbox"), "pk_test_1234567890");
  assert.throws(() => assertStripePublicBuildKey("", "live"));
  assert.throws(() => assertStripePublicBuildKey("pk_test_1234567890", "live"));
  assert.throws(() => assertStripePublicBuildKey("sk_live_secret999", "live"));
});

test("production GitHub deploy preserves current Supabase and Stripe protections", () => {
  const workflow = readFileSync(
    new URL("../.github/workflows/cloudflare-production.yml", import.meta.url),
    "utf8",
  );
  const deploy = readFileSync(new URL("./cloudflare-deploy.mjs", import.meta.url), "utf8");
  assert.match(workflow, /ref: main/);
  assert.match(workflow, /Verify checked-out main SHA/);
  assert.match(workflow, /EXPECTED_PRODUCTION_SUPABASE_REF/);
  assert.match(workflow, /Load the existing live Stripe publishable key/);
  assert.match(workflow, /VITE_PAYMENTS_CLIENT_TOKEN=%s/);
  assert.match(deploy, /verifyProductionSupabase/);
  assert.match(deploy, /assertStripePublicBuildKey/);
});

test("manual sandbox deployment infers the environment when explicit PAYMENTS_ENVIRONMENT is absent", () => {
  const deploy = readFileSync(new URL("./cloudflare-deploy.mjs", import.meta.url), "utf8");
  assert.match(
    deploy,
    /configured\?\.startsWith\("pk_live_"\)\s*\?\s*"live"\s*:\s*"sandbox"/,
  );
});
