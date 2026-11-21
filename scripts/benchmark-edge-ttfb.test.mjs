import assert from "node:assert/strict";
import { test } from "node:test";
import {
  calculateReductionPercent,
  summarize,
  serverTimingDurations,
} from "./benchmark-edge-ttfb.mjs";

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
  assert.deepEqual(serverTimingDurations("app;dur=172.4, entry;dur=41.2, ssr;dur=99"), {
    app: 172.4,
    entry: 41.2,
    ssr: 99,
  });
  assert.deepEqual(serverTimingDurations("cache;desc=secret, app;dur=2"), { app: 2 });
});

test("TTFB improvement is compared against an explicit same-method baseline", () => {
  assert.equal(calculateReductionPercent(1209.1, 96.728), 92);
  assert.equal(calculateReductionPercent(307.3, 56.4), 81.65);
  assert.equal(calculateReductionPercent(0, 5), null);
  assert.equal(calculateReductionPercent(200, NaN), null);
  assert.equal(calculateReductionPercent(200, 250), -25);
});
