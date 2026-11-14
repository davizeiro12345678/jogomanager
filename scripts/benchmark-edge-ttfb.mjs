import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";

const TARGETS = Object.freeze([
  "https://jogomanager.com/",
  "https://catalog-vps.jogomanager.com/robots.txt",
  "https://matches-vps.jogomanager.com/robots.txt",
]);

export function summarize(values) {
  const sorted = values.filter((x) => Number.isFinite(x) && x >= 0).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return {
    count: sorted.length,
    medianMs: +median.toFixed(2),
    p95Ms: +sorted[Math.ceil(sorted.length * 0.95) - 1].toFixed(2),
    maxMs: +sorted.at(-1).toFixed(2),
  };
}

export function serverTimingDurations(header) {
  const out = {};
  for (const part of (header || "").split(",")) {
    const match = part.trim().match(/^([a-z]+);dur=(\d+(?:\.\d+)?)$/i);
    if (match) out[match[1]] = Number(match[2]);
  }
  return out;
}

export function calculateReductionPercent(beforeMs, afterMs) {
  if (!Number.isFinite(beforeMs) || beforeMs <= 0 || !Number.isFinite(afterMs) || afterMs < 0)
    return null;
  return +((1 - afterMs / beforeMs) * 100).toFixed(2);
}

async function measure(url, samples, method, bypass) {
  const entries = [];
  for (let index = 0; index < samples; index++) {
    const started = performance.now();
    try {
      const controller = AbortSignal.timeout(12_000);
      const response = await fetch(url, {
        method,
        signal: controller,
        redirect: "manual",
        ...(bypass ? { headers: { "Cache-Control": "no-cache" } } : {}),
      });
      const ttfbMs = performance.now() - started;
      // Fully drain the response so streamed SSR and waitUntil(cache.put)
      // can finish. A HEAD probe cannot exercise GET-only anonymous HTML caching.
      await response.arrayBuffer();
      entries.push({
        status: response.status,
        ttfbMs,
        timing: serverTimingDurations(response.headers.get("server-timing")),
        rayColo: response.headers.get("cf-ray")?.split("-").at(-1) ?? null,
        htmlCache: response.headers.get("x-jgm-edge-html-cache")?.toUpperCase() ?? "UNKNOWN",
        cfCache: response.headers.get("cf-cache-status") ?? "UNKNOWN",
      });
    } catch (error) {
      entries.push({ status: 0, error: error instanceof Error ? error.name : "network_error" });
    }
  }
  const ok = entries.filter((e) => e.status === 200);
  return {
    url,
    warm: summarize(ok.slice(1).map((e) => e.ttfbMs)),
    all: summarize(ok.map((e) => e.ttfbMs)),
    first: ok[0]?.ttfbMs ?? null,
    app: summarize(ok.map((e) => e.timing.app).filter(Number.isFinite)),
    entry: summarize(ok.map((e) => e.timing.entry).filter(Number.isFinite)),
    ssr: summarize(ok.map((e) => e.timing.ssr).filter(Number.isFinite)),
    statusCodes: entries.reduce((map, e) => ((map[e.status] = (map[e.status] || 0) + 1), map), {}),
    rayColos: [...new Set(ok.map((e) => e.rayColo).filter(Boolean))],
    htmlCacheHits: ok.filter((e) => e.htmlCache === "HIT").length,
    htmlCacheMisses: ok.filter((e) => e.htmlCache === "MISS").length,
    htmlCacheUnknown: ok.filter((e) => e.htmlCache === "UNKNOWN").length,
    cdnCacheStatuses: ok.reduce(
      (map, e) => ((map[e.cfCache] = (map[e.cfCache] || 0) + 1), map),
      {},
    ),
  };
}

async function main() {
  const param = process.argv.find((s) => s.startsWith("--samples="));
  const method = process.argv.includes("--head") ? "HEAD" : "GET";
  const bypass = process.argv.includes("--bypass");
  const rawUrl = process.argv.find((s) => s.startsWith("--url="))?.slice("--url=".length);
  const urls = rawUrl ? [rawUrl] : TARGETS;
  for (const candidate of urls) {
    const target = new URL(candidate);
    if (target.protocol !== "https:" && target.hostname !== "127.0.0.1")
      throw new Error("Benchmark target must be HTTPS or local 127.0.0.1");
  }
  const baselineP95 = process.argv.find((s) => s.startsWith("--baseline-p95-ms="));
  const baseline = baselineP95 ? Number(baselineP95.split("=")[1]) : null;
  const targetOption = process.argv.find((s) => s.startsWith("--target-reduction="));
  const goal = targetOption ? Number(targetOption.split("=")[1]) : null;
  if (baseline !== null && (!Number.isFinite(baseline) || baseline <= 0))
    throw new Error("Invalid --baseline-p95-ms");
  if (goal !== null && (!Number.isFinite(goal) || goal <= 0 || goal >= 100))
    throw new Error("Invalid --target-reduction");
  if (goal !== null && baseline === null) throw new Error("Target requires baseline p95");
  const samples = Number(param?.split("=")[1] ?? 9);
  if (!Number.isSafeInteger(samples) || samples < 3 || samples > 30)
    throw new Error("--samples must be between 3 and 30");
  const reports = [];
  for (const url of urls) reports.push(await measure(url, samples, method, bypass));
  const observedP95 = reports[0]?.all?.p95Ms ?? null;
  const achievedReduction =
    baseline !== null && observedP95 !== null
      ? calculateReductionPercent(baseline, observedP95)
      : null;
  const goalPassed = goal === null ? null : achievedReduction !== null && achievedReduction >= goal;
  process.stdout.write(
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        method,
        bypass,
        samples,
        baselineP95Ms: baseline,
        targetReductionPercent: goal,
        achievedReductionPercent: achievedReduction,
        goalPassed,
        reports,
      },
      null,
      2,
    ) + "\n",
  );
  if (reports.some((r) => r.statusCodes[200] !== samples)) process.exitCode = 1;
  if (goalPassed === false) process.exitCode = 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Unable to measure edge responses");
    process.exitCode = 1;
  });
}
