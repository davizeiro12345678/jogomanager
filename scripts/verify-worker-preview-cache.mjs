import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";

function readCanaryUrl() {
  const argument = process.argv.find((value) => value.startsWith("--url="));
  if (!argument) throw new Error("Pass --url=https://<preview>.workers.dev/");
  const url = new URL(argument.slice("--url=".length));
  if (url.protocol !== "https:" || !url.hostname.endsWith(".workers.dev"))
    throw new Error("Safety: only HTTPS workers.dev Preview URLs are permitted");
  return url.origin;
}

async function read(base, path = "/", headers = {}) {
  const start = performance.now();
  const response = await fetch(new URL(path, base), {
    method: "GET",
    redirect: "manual",
    signal: AbortSignal.timeout(12_000),
    headers,
  });
  const ttfbMs = performance.now() - start;
  const content = await response.text();
  return { response, content, ttfbMs };
}

function assertFreshNonce({ response, content }) {
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html/);
  const nonces = [...content.matchAll(/\bnonce="([A-Za-z0-9+/=]{24,48})"/g)].map(
    (entry) => entry[1],
  );
  assert.ok(nonces.length >= 2, "SSR has expected nonce-bearing elements");
  assert.equal(new Set(nonces).size, 1, "SSR must not mix nonce values");
  const meta = content.match(/<meta\s+property="csp-nonce"\s+content="([^"]+)"/);
  assert.equal(meta?.[1], nonces[0], "CSP meta must rotate with HTML attributes");
  assert.ok(
    response.headers.get("content-security-policy-report-only")?.includes(`'nonce-${nonces[0]}'`),
    "CSP header must match the fresh HTML nonce",
  );
  assert.equal(response.headers.get("cdn-cache-control"), "no-store");
  return nonces[0];
}

async function main() {
  const base = readCanaryUrl();
  const warmup = await read(base);
  assertFreshNonce(warmup);
  const hitSamples = [];
  for (let attempt = 0; attempt < 6; attempt++) {
    if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 120));
    const sample = await read(base);
    const nonce = assertFreshNonce(sample);
    hitSamples.push({
      status: sample.response.status,
      cache: sample.response.headers.get("x-jgm-edge-html-cache"),
      nonce,
      ttfbMs: sample.ttfbMs,
    });
  }
  const hits = hitSamples.filter((sample) => sample.cache === "HIT");
  assert.ok(hits.length >= 4, "At least 4 of 6 Preview requests must hit the inner Worker cache");
  assert.ok(
    new Set(hits.map((sample) => sample.nonce)).size >= 2,
    "Nonce must rotate on cache HIT",
  );

  for (const { label, path, headers, privatePolicy } of [
    {
      label: "session-cookie",
      path: "/",
      headers: { cookie: "session=fixture" },
      privatePolicy: true,
    },
    {
      label: "authorization",
      path: "/",
      headers: { authorization: "Bearer fixture" },
      privatePolicy: true,
    },
    { label: "query", path: "/?utm_source=smoke", headers: {}, privatePolicy: false },
    { label: "login", path: "/auth", headers: {}, privatePolicy: true },
  ]) {
    const sample = await read(base, path, headers);
    assert.ok(sample.response.status < 500, `${label} must not crash`);
    assert.notEqual(sample.response.headers.get("x-jgm-edge-html-cache"), "HIT", `${label} bypass`);
    assert.equal(
      sample.response.headers.get("cdn-cache-control"),
      "no-store",
      `${label} CDN bypass`,
    );
    if (privatePolicy) assert.equal(sample.response.headers.get("cache-control"), "no-store");
  }
  const cfBot = await read(base, "/", { cookie: "__cf_bm=preview-bot-fixture" });
  assert.equal(cfBot.response.headers.get("x-jgm-edge-html-cache"), "HIT");

  const sorted = hits.map((x) => x.ttfbMs).sort((a, b) => a - b);
  console.log(
    JSON.stringify(
      {
        status: "PASS",
        preview: base,
        sampleCount: hitSamples.length,
        cacheHits: hits.length,
        distinctHitNonces: new Set(hits.map((x) => x.nonce)).size,
        hitTtfbMedianMs: +(sorted[Math.floor((sorted.length - 1) / 2)] ?? 0).toFixed(2),
        authAndSessionBypass: "PASS",
        cspNonceRotation: "PASS",
      },
      null,
      2,
    ),
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Preview smoke test failed");
    process.exitCode = 1;
  });
}
