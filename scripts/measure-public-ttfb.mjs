/**
 * Reproducible, bounded HTTP TTFB checks for the public JogoManager surfaces.
 *
 * This is not a load test. It never sends credentials, cookies, POST requests,
 * or private paths. Cold first request and warm observations are kept separate.
 *
 * Usage:
 *   node scripts/measure-public-ttfb.mjs --samples=12 --output=ttfb.json
 *   node scripts/measure-public-ttfb.mjs --only=home,catalog --samples=5
 *   node scripts/measure-public-ttfb.mjs --self-test
 *
 * Requires curl. Reports client-side TTFB, so DNS/TCP/TLS/edge/Worker/body
 * streaming are included; Server-Timing app;dur is separately reported.
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { promisify } from "node:util";

const execute = promisify(execFile);
const sink = process.platform === "win32" ? "NUL" : "/dev/null";
const TARGETS = Object.freeze({
  home: "https://jogomanager.com/",
  robots: "https://jogomanager.com/robots.txt",
  catalog:
    "https://catalog-vps.jogomanager.com/v1/public/clubs?limit=100&page=0",
  multiplayer: "https://vps-multiplayer.jogomanager.com/health/live",
});
const METRIC =
  "\nJGM_TIMING:%{http_code}|%{time_namelookup}|%{time_connect}|%{time_appconnect}|%{time_starttransfer}|%{time_total}\n";

function percentile(numbers, proportion) {
  if (!numbers.length) return null;
  const sorted = [...numbers].sort((a, b) => a - b);
  if (proportion === 0.5 && sorted.length % 2 === 0) {
    const i = sorted.length / 2;
    return (sorted[i - 1] + sorted[i]) / 2;
  }
  return sorted[Math.max(0, Math.ceil(sorted.length * proportion) - 1)];
}

function round(value) {
  return value == null ? null : Math.round(value * 1000) / 1000;
}

function parseResult(stdout) {
  const expression =
    /JGM_TIMING:(\d{3})\|([\d.]+)\|([\d.]+)\|([\d.]+)\|([\d.]+)\|([\d.]+)/;
  const time = expression.exec(stdout);
  if (!time) throw new Error("Curl did not return timing data.");
  const headerBlocks = stdout.slice(0, time.index).split(/\r?\n\r?\n/);
  const headers =
    headerBlocks
      .filter((value) => /^HTTP\/[\d.]+\s+\d{3}/m.test(value))
      .at(-1) ?? "";
  const get = (name) =>
    new RegExp("^" + name + ":\\s*([^\\r\\n]+)", "im").exec(headers)?.[1] ??
    null;
  const app = /(?:^|,)\s*app;dur=([\d.]+)/i.exec(get("server-timing") ?? "");
  const ray = /-([A-Z]{3})$/.exec(get("cf-ray") ?? "");
  return {
    status: Number(time[1]),
    dnsMs: round(Number(time[2]) * 1000),
    tcpMs: round(Number(time[3]) * 1000),
    tlsMs: round(Number(time[4]) * 1000),
    ttfbMs: round(Number(time[5]) * 1000),
    totalMs: round(Number(time[6]) * 1000),
    appMs: app ? round(Number(app[1])) : null,
    colo: ray?.[1] ?? null,
    cacheStatus: get("cf-cache-status"),
  };
}

async function sample(url) {
  const args = [
    "--silent",
    "--show-error",
    "--connect-timeout",
    "4",
    "--max-time",
    "8",
    "--dump-header",
    "-",
    "--output",
    sink,
    "--write-out",
    METRIC,
    "--",
    url,
  ];
  const { stdout } = await execute("curl", args, {
    timeout: 10_000,
    maxBuffer: 256_000,
    windowsHide: true,
  });
  return parseResult(stdout);
}

function parseOptions(argv) {
  const options = {
    samples: 12,
    only: Object.keys(TARGETS),
    output: null,
    selfTest: false,
  };
  for (const arg of argv) {
    if (arg === "--self-test") options.selfTest = true;
    else if (arg.startsWith("--samples=")) {
      options.samples = Number(arg.slice("--samples=".length));
    } else if (arg.startsWith("--only=")) {
      options.only = arg.slice("--only=".length).split(",");
    } else if (arg.startsWith("--output=")) {
      options.output = arg.slice("--output=".length);
    } else {
      throw new Error("Unknown argument: " + arg);
    }
  }
  if (
    !Number.isInteger(options.samples) ||
    options.samples < 2 ||
    options.samples > 30
  ) {
    throw new Error("samples must be an integer between 2 and 30.");
  }
  if (
    !options.only.length ||
    new Set(options.only).size !== options.only.length ||
    options.only.some((name) => !Object.hasOwn(TARGETS, name))
  ) {
    throw new Error(
      "only must contain unique names from: " + Object.keys(TARGETS).join(", "),
    );
  }
  return options;
}

function summarize(name, observations) {
  const ok = observations.filter((row) => row.status === 200);
  const ttfb = ok.map((row) => row.ttfbMs);
  const app = ok.map((row) => row.appMs).filter((value) => value != null);
  const statusCounts = {};
  const cacheCounts = {};
  const coloCounts = {};
  for (const row of observations) {
    const status = String(row.status ?? "error");
    statusCounts[status] = (statusCounts[status] ?? 0) + 1;
    const cache = row.cacheStatus ?? "none";
    cacheCounts[cache] = (cacheCounts[cache] ?? 0) + 1;
    const colo = row.colo ?? "unknown";
    coloCounts[colo] = (coloCounts[colo] ?? 0) + 1;
  }
  return {
    name,
    url: TARGETS[name],
    samples: observations.length,
    success: ok.length,
    httpCodes: statusCounts,
    firstRequestMs: observations[0]?.ttfbMs ?? null,
    medianTtfbMs: round(percentile(ttfb, 0.5)),
    p95TtfbMs: round(percentile(ttfb, 0.95)),
    warmMedianMs: round(percentile(ttfb.slice(1), 0.5)),
    medianAppMs: round(percentile(app, 0.5)),
    cacheCounts,
    coloCounts,
    observations,
  };
}

function selfTest() {
  assert.equal(percentile([1, 2, 3, 4], 0.5), 2.5);
  assert.equal(percentile([1, 2, 3, 4], 0.95), 4);
  assert.throws(() => parseOptions(["--samples=500"]));
  assert.throws(() => parseOptions(["--only=checkout"]));
  const wire =
    "HTTP/2 200\r\nserver-timing: app;dur=21.4\r\ncf-cache-status: HIT\r\ncf-ray: abc-SAO\r\n\r\nJGM_TIMING:200|0.001|0.012|0.022|0.076|0.088";
  const parsed = parseResult(wire);
  assert.equal(parsed.ttfbMs, 76);
  assert.equal(parsed.appMs, 21.4);
  assert.equal(parsed.colo, "SAO");
  assert.equal(parsed.cacheStatus, "HIT");
  console.log("SELF_TEST_OK");
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  if (options.selfTest) return selfTest();
  const targets = [];
  for (const name of options.only) {
    const observations = [];
    for (let i = 0; i < options.samples; i++) {
      try {
        observations.push(await sample(TARGETS[name]));
      } catch (error) {
        observations.push({
          status: "error",
          message:
            error instanceof Error ? error.message.slice(0, 120) : "unknown",
        });
      }
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    const item = summarize(name, observations);
    console.log(
      JSON.stringify({
        name,
        success: item.success,
        samples: item.samples,
        firstRequestMs: item.firstRequestMs,
        medianTtfbMs: item.medianTtfbMs,
        warmMedianMs: item.warmMedianMs,
        p95TtfbMs: item.p95TtfbMs,
        medianAppMs: item.medianAppMs,
        httpCodes: item.httpCodes,
      }),
    );
    targets.push(item);
  }
  const report = {
    capturedAt: new Date().toISOString(),
    clientPlatform: process.platform,
    sampleMode: "sequential single curl process per request, no user session",
    notes: [
      "Cold/warm and regions must not be mixed when claiming percentage improvements.",
      "Worker app timing is handler duration only; edge startup and streaming are not isolated by this value.",
      "Public health GET measures transport, not signed POST multiplayer simulation throughput.",
      "This tool does not validate FPS, WebSocket multiplayer, or authenticated user flows.",
    ],
    targets,
  };
  if (options.output)
    await writeFile(options.output, JSON.stringify(report, null, 2) + "\n");
  if (targets.some((item) => item.success !== item.samples))
    process.exitCode = 1;
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
