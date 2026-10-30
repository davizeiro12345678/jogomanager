import { test } from "node:test";
import assert from "node:assert/strict";
import { createTransport, processBatch } from "./notification-outbox-worker.mjs";

test("bounds each leased batch to three sends and acknowledges its own token", async () => {
  const job = { id: "job", lease_token: "owned-token", trace_id: "a".repeat(32) };
  const calls = [];
  const result = await processBatch({
    rpc: async (name, body, trace) => {
      calls.push({ name, body, trace });
      if (name === "jm_claim_notifications") return [job];
      return true;
    },
    deliver: async (item) => assert.equal(item, job),
  });
  assert.equal(calls[1].body.p_limit, 3);
  assert.deepEqual(calls[2].body, {
    p_id: "job",
    p_lease_token: "owned-token",
    p_success: true,
    p_terminal: false,
    p_error: null,
  });
  assert.deepEqual(result, { claimed: 1, delivered: 1, deferred: 0, dead: 0 });
});

test("supports publishable-era server secrets without sending an invalid bearer token", async () => {
  let request;
  const transport = createTransport({
    baseUrl: "https://project.supabase.co",
    authToken: "sb_secret_test",
    emailToken: "resend-test",
    fetcher: async (_url, options) => {
      request = options;
      return Response.json([]);
    },
  });
  await transport.rpc("jm_claim_notifications", { p_limit: 3 }, "trace");
  assert.equal(request.headers.apikey, "sb_secret_test");
  assert.equal(request.headers.authorization, undefined);
  assert.equal(request.redirect, "error");
});

test("retains legacy JWT authorization and rejects credential-bearing origins", async () => {
  let request;
  const transport = createTransport({
    baseUrl: "https://project.supabase.co",
    authToken: "eyJlegacy",
    emailToken: "resend-test",
    fetcher: async (_url, options) => {
      request = options;
      return Response.json([]);
    },
  });
  await transport.rpc("jm_claim_notifications", { p_limit: 3 }, "trace");
  assert.equal(request.headers.authorization, "Bearer eyJlegacy");
  assert.throws(
    () =>
      createTransport({
        baseUrl: "https://user:password@project.supabase.co",
        authToken: "secret",
        emailToken: "resend-test",
      }),
    /Invalid project origin/,
  );
});

test("preserves provider idempotency and forbids redirects during a delivery", async () => {
  let request;
  const transport = createTransport({
    baseUrl: "https://project.supabase.co",
    authToken: "secret",
    emailToken: "resend-test",
    fetcher: async (_url, options) => {
      request = options;
      return Response.json({ id: "email" });
    },
  });
  await transport.deliver(
    {
      dedupe_key: "a".repeat(64),
      payload: {
        to: "qa@example.test",
        from: "sender@example.test",
        subject: "Season",
        html: "<p>Ready</p>",
        text: "Ready",
      },
    },
    "trace",
  );
  assert.equal(request.headers["Idempotency-Key"], "a".repeat(64));
  assert.equal(request.redirect, "error");
});
