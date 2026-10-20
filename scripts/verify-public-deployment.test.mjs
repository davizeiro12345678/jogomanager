import { test } from "node:test";
import assert from "node:assert/strict";
import { verifyPublicDeployment } from "./verify-public-deployment.mjs";

const EXPECTED_SHA = "0123456789abcdef0123456789abcdef01234567";
const OLD_SHA = "fedcba9876543210fedcba9876543210fedcba98";

function verifyExpectedDeployment(options) {
  return verifyPublicDeployment({ expectedSha: EXPECTED_SHA, ...options });
}

function response(body, { type = "text/html", status = 200, url = "" } = {}) {
  const result = new Response(body, { status, headers: { "content-type": type } });
  Object.defineProperty(result, "url", { value: url });
  return result;
}

function successfulResponse(url) {
  return url.endsWith("/api/health")
    ? response(JSON.stringify({ status: "ready", release: { commit: EXPECTED_SHA } }), {
        type: "application/json",
      })
    : response("<title>Pro Football Manager 3D</title>", {
        url: url.startsWith("https://www.") ? "https://jogomanager.com/" : url,
      });
}

test("checks public health, apex, and the canonical www redirect without credentials", async () => {
  const calls = [];
  const reports = [];
  await verifyExpectedDeployment({
    expectedSha: EXPECTED_SHA,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return successfulResponse(url);
    },
    report: (message) => reports.push(message),
  });
  assert.equal(calls.length, 3);
  assert.deepEqual(
    calls.map((call) => call.options.redirect),
    ["manual", "manual", "follow"],
  );
  for (const { options } of calls) {
    assert.deepEqual(options.headers, { "cache-control": "no-cache" });
    assert.ok(options.signal instanceof AbortSignal);
  }
  assert.equal(reports.length, 3);
});

test("rejects a healthy server running an older commit", async () => {
  await assert.rejects(
    verifyExpectedDeployment({
      expectedSha: EXPECTED_SHA,
      fetchImpl: async (url) =>
        url.endsWith("/api/health")
          ? response(JSON.stringify({ status: "ready", release: { commit: OLD_SHA } }), {
              type: "application/json",
            })
          : successfulResponse(url),
      report() {},
    }),
    /deployed commit does not match/,
  );
});

test("rejects a healthy server without build identity", async () => {
  await assert.rejects(
    verifyExpectedDeployment({
      expectedSha: EXPECTED_SHA,
      fetchImpl: async (url) =>
        url.endsWith("/api/health")
          ? response('{"status":"ready"}', { type: "application/json" })
          : successfulResponse(url),
      report() {},
    }),
    /missing or invalid deployed commit/,
  );
});

for (const expectedSha of [undefined, "", "main", "0123456", "https://example.test"]) {
  test(`requires a full expected Git SHA before making requests: ${expectedSha}`, async () => {
    let requested = false;
    await assert.rejects(
      verifyExpectedDeployment({
        expectedSha,
        fetchImpl: async (url) => {
          requested = true;
          return successfulResponse(url);
        },
        report() {},
      }),
      /expected commit must be a full/,
    );
    assert.equal(requested, false);
  });
}

for (const status of [302, 401, 500]) {
  test(`rejects HTTP ${status} instead of calling a deployment healthy`, async () => {
    await assert.rejects(
      verifyExpectedDeployment({ fetchImpl: async () => response("", { status }), report() {} }),
      new RegExp(`got ${status}`),
    );
  });
}

for (const url of [
  "https://team.cloudflareaccess.com/login",
  "https://cloudflareaccess.com/login",
  "https://jogomanager.com/cdn-cgi/access/login",
]) {
  test(`rejects a 200 response redirected to Access: ${url}`, async () => {
    await assert.rejects(
      verifyExpectedDeployment({
        fetchImpl: async () => response('{"status":"ready"}', { type: "application/json", url }),
        report() {},
      }),
      /redirected to Cloudflare Access/,
    );
  });
}

for (const body of [
  "Cloudflare Access",
  "/cdn-cgi/access/login",
  "Log in to private Cloudflare Workers",
]) {
  test(`rejects an Access page with HTTP 200: ${body}`, async () => {
    await assert.rejects(
      verifyExpectedDeployment({ fetchImpl: async () => response(body), report() {} }),
      /login page served/,
    );
  });
}

test("rejects degraded backend health", async () => {
  await assert.rejects(
    verifyExpectedDeployment({
      fetchImpl: async () => response('{"status":"degraded"}', { type: "application/json" }),
      report() {},
    }),
    /backend health is not ready/,
  );
});

test("rejects HTML masquerading as a JSON health endpoint", async () => {
  await assert.rejects(
    verifyExpectedDeployment({
      fetchImpl: async () => response('{"status":"ready"}'),
      report() {},
    }),
    /expected JSON health/,
  );
});

test("rejects an unexpected homepage after health passes", async () => {
  await assert.rejects(
    verifyExpectedDeployment({
      fetchImpl: async (url) =>
        url.endsWith("/api/health")
          ? successfulResponse(url)
          : response("<title>Unknown site</title>"),
      report() {},
    }),
    /expected public game HTML/,
  );
});

for (const url of [
  "https://legacy-origin.example.invalid/",
  "http://jogomanager.com/",
  "https://www.jogomanager.com:8443/",
]) {
  test(`rejects a canonical redirect outside the intended HTTPS origins: ${url}`, async () => {
    await assert.rejects(
      verifyExpectedDeployment({
        fetchImpl: async (requestedUrl) =>
          requestedUrl.startsWith("https://www.")
            ? response("<title>Pro Football Manager 3D</title>", { url })
            : successfulResponse(requestedUrl),
        report() {},
      }),
      /unexpected public origin/,
    );
  });
}
