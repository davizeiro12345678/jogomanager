import test from "node:test";
import assert from "node:assert/strict";
import { processBatch, createTransport, traceparent } from "./notification-outbox-worker.mjs";

const lease = {
  id: "11111111-1111-4111-8111-111111111111",
  dedupe_key: "a".repeat(64),
  lease_token: "22222222-2222-4222-8222-222222222222",
  trace_id: "b".repeat(32),
  payload: { to: "test@example.test", from: "no-reply@example.test",
    subject: "Hello", html: "<p>Hello</p>", text: "Hello" },
};
test("passes the same idempotency key and trace to the provider", async () => {
  const requests = [];
  const client = createTransport({
    baseUrl: "https://sample.supabase.co",
    authToken: "test-only",
    emailToken: "test-only",
    fetcher: async (url, options) => {
      requests.push({ url: String(url), options });
      return String(url).includes("/emails")
        ? Response.json({ id: "sent" })
        : Response.json(true);
    },
  });
  await client.deliver(lease, traceparent(lease.trace_id));
  assert.equal(requests[0].options.headers["Idempotency-Key"], lease.dedupe_key);
  assert.match(requests[0].options.headers.traceparent, /^00-b{32}-[a-f0-9]{16}-01$/);
});
test("acknowledges only after provider confirmation", async () => {
  const calls = [];
  const outcome = await processBatch({
    rpc: async (name, args) => {
      calls.push(name);
      return name === "jm_claim_notifications" ? [lease] : true;
    },
    deliver: async () => { calls.push("send"); },
  });
  assert.deepEqual(calls, [
    "jm_reap_notifications", "jm_claim_notifications", "send", "jm_ack_notification",
  ]);
  assert.equal(outcome.delivered, 1);
});
test("temporary failures are retried and permanent failures go to dead letters", async () => {
  for (const permanent of [false, true]) {
    let ack;
    const result = await processBatch({
      rpc: async (name, args) => {
        if (name === "jm_claim_notifications") return [lease];
        if (name === "jm_ack_notification") ack = args;
        return true;
      },
      deliver: async () => { throw Object.assign(new Error("simulated"), { permanent }); },
    });
    assert.equal(ack.p_success, false);
    assert.equal(ack.p_terminal, permanent);
    assert.equal(permanent ? result.dead : result.deferred, 1);
  }
});
test("rejects an unsafe project origin and malformed jobs", async () => {
  assert.throws(() => createTransport({
    baseUrl: "http://example.test", authToken: "test", emailToken: "test",
  }));
  const worker = createTransport({
    baseUrl: "https://sample.supabase.co", authToken: "test", emailToken: "test",
  });
  await assert.rejects(worker.deliver({ ...lease, dedupe_key: "x" }, traceparent()));
});
