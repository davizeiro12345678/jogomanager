import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";

const [originArg, outputArg] = process.argv.slice(2);
if (!originArg || !outputArg)
  throw new Error("Usage: node scripts/quality-worker-boundaries.mjs LOCAL_ORIGIN OUTPUT_JSON");
const origin = new URL(originArg);
if (!["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname))
  throw new Error("This active boundary test only accepts a local isolated Worker preview.");
const started = performance.now();
const controllers = new Set();
const requests = [];
let abortReason = null;
let previousTick = started;
let maxEventLoopLagMs = 0;
const stop = (reason) => {
  abortReason ??= reason;
  for (const controller of controllers) controller.abort();
};
const monitor = setInterval(() => {
  const now = performance.now();
  maxEventLoopLagMs = Math.max(maxEventLoopLagMs, now - previousTick - 50);
  previousTick = now;
  if (maxEventLoopLagMs > 250) stop("event_loop_lag_over_250ms");
  if (now - started > 30_000) stop("duration_over_30s");
}, 50);
try {
  for (let offset = 0; offset < 200 && !abortReason; offset += 4) {
    await Promise.all(
      Array.from({ length: 4 }, async (_, index) => {
        if (abortReason) return;
        const number = offset + index;
        const controller = new AbortController();
        controllers.add(controller);
        const timeout = setTimeout(() => stop("request_latency_over_1000ms"), 1000);
        const before = performance.now();
        try {
          const response = await fetch(new URL("/api/internal/support-dispatch", origin), {
            method: "POST",
            headers: {
              "content-type": "application/json",
              ...(number % 2 ? { authorization: "Bearer quality-forged-token" } : {}),
            },
            body: JSON.stringify({ limit: 3, accountId: "forged-account" }),
            redirect: "error",
            signal: controller.signal,
          });
          const policies = [
            "cache-control",
            "cdn-cache-control",
            "cloudflare-cdn-cache-control",
          ].map((name) => response.headers.get(name));
          await response.arrayBuffer();
          const elapsedMs = performance.now() - before;
          const passed = response.status === 401 && policies.every((value) => value === "no-store");
          requests.push({
            number,
            scenario: number % 2 ? "forged_bearer" : "missing_bearer",
            status: response.status,
            elapsedMs,
            policies,
            passed,
          });
          if (response.status >= 500) stop("server_error");
          else if (!passed) stop("unexpected_boundary_response");
        } catch (error) {
          requests.push({
            number,
            elapsedMs: performance.now() - before,
            error: String(error),
            passed: false,
          });
          stop("request_failure");
        } finally {
          clearTimeout(timeout);
          controllers.delete(controller);
        }
      }),
    );
  }
} finally {
  clearInterval(monitor);
}
const times = requests
  .filter((request) => Number.isFinite(request.elapsedMs))
  .map((request) => request.elapsedMs)
  .sort((a, b) => a - b);
const percentile = (fraction) => times[Math.max(0, Math.ceil(times.length * fraction) - 1)] ?? null;
const report = {
  generatedAt: new Date().toISOString(),
  origin: origin.href,
  scope:
    "Real local Nitro/Cloudflare Worker HTTP pipeline; only rejected pre-authentication POSTs. No successful authorization, account writes, database mutation, webhook delivery or production load.",
  limits: {
    maxRequests: 200,
    concurrency: 4,
    durationMs: 30_000,
    requestLatencyMs: 1000,
    eventLoopLagMs: 250,
  },
  summary: {
    attempted: requests.length,
    passed: requests.filter((request) => request.passed).length,
    durationMs: performance.now() - started,
    p50Ms: percentile(0.5),
    p95Ms: percentile(0.95),
    p99Ms: percentile(0.99),
    maxEventLoopLagMs,
    abortReason,
  },
  requests,
  success: !abortReason && requests.length === 200 && requests.every((request) => request.passed),
};
await mkdir(path.dirname(path.resolve(outputArg)), { recursive: true });
await writeFile(outputArg, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ success: report.success, ...report.summary }));
if (!report.success) process.exitCode = 1;
