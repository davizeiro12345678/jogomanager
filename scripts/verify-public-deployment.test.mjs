import { test } from "node:test";
import assert from "node:assert/strict";
import { verifyPublicDeployment } from "./verify-public-deployment.mjs";

function response(body, { type = "text/html", status = 200, url = "" } = {}) {
  const result = new Response(body, { status, headers: { "content-type": type } });
  Object.defineProperty(result, "url", { value: url });
  return result;
}

function successfulResponse(url) {
  return url.endsWith("/api/health")
    ? response('{"status":"ready"}', { type: "application/json" })
    : response("<title>Pro Football Manager 3D</title>", {
        url: url.startsWith("https://www.") ? "https://jogomanager.com/" : url,
      });
}

test("checks public health, apex, and the canonical www redirect without credentials", async () => {
  const calls = [];
  const reports = [];
  await verifyPublicDeployment({
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

for (const status of [302, 401, 500]) {
  test(`rejects HTTP ${status} instead of calling a deployment healthy`, async () => {
    await assert.rejects(
      verifyPublicDeployment({ fetchImpl: async () => response("", { status }), report() {} }),
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
      verifyPublicDeployment({
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
      verifyPublicDeployment({ fetchImpl: async () => response(body), report() {} }),
      /login page served/,
    );
  });
}

test("rejects degraded backend health", async () => {
  await assert.rejects(
    verifyPublicDeployment({
      fetchImpl: async () => response('{"status":"degraded"}', { type: "application/json" }),
      report() {},
    }),
    /backend health is not ready/,
  );
});

test("rejects HTML masquerading as a JSON health endpoint", async () => {
  await assert.rejects(
    verifyPublicDeployment({ fetchImpl: async () => response('{"status":"ready"}'), report() {} }),
    /expected JSON health/,
  );
});

test("rejects an unexpected homepage after health passes", async () => {
  await assert.rejects(
    verifyPublicDeployment({
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
      verifyPublicDeployment({
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
