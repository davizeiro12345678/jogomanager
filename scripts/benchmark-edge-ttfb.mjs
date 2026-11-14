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

async function measure(url, samples) {
  const entries = [];
  for (let index = 0; index < samples; index++) {
    const started = performance.now();
    try {
      const controller = AbortSignal.timeout(12_000);
      const response = await fetch(url, {
        method: "HEAD",
        signal: controller,
        redirect: "manual",
        headers: { "Cache-Control": "no-cache" },
      });
      const ttfbMs = performance.now() - started;
      entries.push({
        status: response.status,
        ttfbMs,
        timing: serverTimingDurations(response.headers.get("server-timing")),
        rayColo: response.headers.get("cf-ray")?.split("-").at(-1) ?? null,
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
  };
}

async function main() {
  const param = process.argv.find((s) => s.startsWith("--samples="));
  const samples = Number(param?.split("=")[1] ?? 9);
  if (!Number.isSafeInteger(samples) || samples < 3 || samples > 30)
    throw new Error("--samples must be between 3 and 30");
  const reports = [];
  for (const url of TARGETS) reports.push(await measure(url, samples));
  process.stdout.write(JSON.stringify({ generatedAt: new Date().toISOString(), samples, reports }, null, 2) + "\n");
  if (reports.some((r) => r.statusCodes[200] !== samples)) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Unable to measure edge responses");
    process.exitCode = 1;
  });
}
