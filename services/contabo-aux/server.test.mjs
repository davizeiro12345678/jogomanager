import { before, after, test } from "node:test";
import assert from "node:assert/strict";

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_PUBLISHABLE_KEY = "test-publishable";
process.env.ENABLE_MATCH_PREVIEW = "false";

const { createAuxServer } = await import("./server.mjs");
const calls = [];
const oldFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  calls.push({ url: String(url), headers: init.headers });
  if (String(url).includes("/auth/v1/user")) {
    return new Response(JSON.stringify({ id: "7ff4ab46-3a29-4013-bdb1-a715636c06e0" }), {
      status: 200,
    });
  }
  if (String(url).includes("/auth/v1/settings")) return new Response("{}", { status: 200 });
  if (String(url).includes("/rest/v1/user_purchases")) {
    return new Response(JSON.stringify([{ status: "completed" }]), { status: 200 });
  }
  return new Response("{}", { status: 404 });
};

let server, base;
before(async () => {
  server = createAuxServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = "http://127.0.0.1:" + server.address().port;
});
after(async () => {
  await new Promise((resolve) => server.close(resolve));
  globalThis.fetch = oldFetch;
});

test("health has no credentials", async () => {
  const r = await oldFetch(base + "/healthz");
  assert.equal(r.status, 200);
  assert.deepEqual((await r.json()).ok, true);
});
test("auth requires bearer token", async () => {
  const r = await oldFetch(base + "/v1/auth/me");
  assert.equal(r.status, 401);
});
test("auth responds only with verified user ID", async () => {
  const r = await oldFetch(base + "/v1/auth/me", {
    headers: { authorization: "Bearer test-user-jwt-mock" },
  });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { userId: "7ff4ab46-3a29-4013-bdb1-a715636c06e0" });
});
test("purchase requires session ID and scopes to verified user", async () => {
  const headers = { authorization: "Bearer test-user-jwt-mock" };
  assert.equal(
    (await oldFetch(base + "/v1/purchases/status?reference=bad", { headers })).status,
    400,
  );
  const r = await oldFetch(base + "/v1/purchases/status?reference=cs_test_123456", { headers });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { status: "completed" });
  const call = calls.find((x) => x.url.includes("/rest/v1/user_purchases"));
  assert.ok(call.url.includes("user_id=eq.7ff4ab46-3a29-4013-bdb1-a715636c06e0"));
  assert.equal(call.headers.authorization, "Bearer test-user-jwt-mock");
});
test("preview disabled by default", async () => {
  const r = await oldFetch(base + "/v1/matches/preview", {
    method: "POST",
    headers: { authorization: "Bearer test-user-jwt-mock" },
    body: JSON.stringify({ homeClub: "a", awayClub: "b" }),
  });
  assert.equal(r.status, 503);
  assert.deepEqual(await r.json(), { error: "preview_disabled" });
});
test("CORS refuses unknown origins", async () => {
  const r = await oldFetch(base + "/v1/auth/me", {
    method: "OPTIONS",
    headers: { origin: "https://malicious.example" },
  });
  assert.equal(r.status, 403);
});
