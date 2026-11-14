import assert from "node:assert/strict";
import { test } from "node:test";
import { summarize, serverTimingDurations } from "./benchmark-edge-ttfb.mjs";

test("TTFB median and p95 are computed from sorted same-status samples", () => {
  assert.deepEqual(summarize([300, 100, 200, 900, 400]), {
    count: 5,
    medianMs: 300,
    p95Ms: 900,
    maxMs: 900,
  });
  assert.equal(summarize([]), null);
  assert.equal(summarize([NaN, -5, 32])?.medianMs, 32);
  assert.equal(summarize([5, 7, 9, 11])?.medianMs, 8);
});

test("Server-Timing parsing never extracts cookie, user IDs or arbitrary headers", () => {
  assert.deepEqual(
    serverTimingDurations("app;dur=172.4, entry;dur=41.2, ssr;dur=99"),
    { app: 172.4, entry: 41.2, ssr: 99 },
  );
  assert.deepEqual(serverTimingDurations("cache;desc=secret, app;dur=2"), { app: 2 });
});
