import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveStripePublicBuildKey } from "./stripe-public-build-env.mjs";

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
