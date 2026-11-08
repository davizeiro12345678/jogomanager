import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MAX_NO_NAVSTART_RETRIES, shouldRetryNoNavStart } from "./trace-mobile-startup-retry.mjs";
export { MAX_NO_NAVSTART_RETRIES };

// Diagnostic only. Preserve every raw trace behind the protected mobile fixtures;
// Quality's independent assertions remain the release gate.
const require = createRequire(import.meta.url);
const collect = require("../../.lighthouserc.mobile.cjs").ci.collect;
const NO_NAVSTART = "NO_NAVSTART";

export function getAttemptArtifacts(output, id, attempt) {
  const suffix = attempt === 1 ? "" : `.retry-${attempt - 1}`;
  return {
    jsonPath: path.join(output, `${id}${suffix}.json`),
    logPath: path.join(output, `${id}${suffix}.log`),
  };
}

function asLogBuffer(log) {
  if (Buffer.isBuffer(log)) return log;
  if (Array.isArray(log)) {
    return Buffer.concat(
      log.map((chunk) => (Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)))),
    );
  }
  return Buffer.from(log == null ? "" : String(log));
}

async function inspectRuntimeError(jsonPath) {
  try {
    const report = JSON.parse(await readFile(jsonPath, "utf8"));
    if (
      !report ||
      typeof report !== "object" ||
      Array.isArray(report) ||
      !report.audits ||
      typeof report.audits !== "object" ||
      Array.isArray(report.audits) ||
      !report.categories ||
      typeof report.categories !== "object" ||
      Array.isArray(report.categories)
    )
      return { valid: false, present: false, code: undefined };
    const runtimeError = report?.runtimeError;
    const present = runtimeError !== undefined && runtimeError !== null;
    const performanceScore = report.categories.performance?.score;
    const metrics = [
      report.audits["largest-contentful-paint"]?.numericValue,
      report.audits["total-blocking-time"]?.numericValue,
      report.audits["cumulative-layout-shift"]?.numericValue,
    ];
    const usableMetrics =
      typeof performanceScore === "number" &&
      Number.isFinite(performanceScore) &&
      metrics.every((value) => typeof value === "number" && Number.isFinite(value));
    return {
      valid: present || usableMetrics,
      present,
      code: typeof runtimeError?.code === "string" ? runtimeError.code : undefined,
    };
  } catch {
    return { valid: false, present: false, code: undefined };
  }
}

function formatFailure(id, attempts) {
  const last = attempts.at(-1);
  const artifacts = attempts
    .flatMap(({ jsonPath, logPath }) => [path.basename(jsonPath), path.basename(logPath)])
    .join(", ");
  const allNoNavstart = attempts.every(
    ({ exitCode, processCompleted, runtimeErrorCode }) =>
      processCompleted && exitCode !== 0 && runtimeErrorCode === NO_NAVSTART,
  );
  if (allNoNavstart) {
    return (
      `Lighthouse failed for ${id}: runtimeError=${NO_NAVSTART} after ${attempts.length} attempts; ` +
      `retry limit reached and all diagnostics were preserved (${artifacts})`
    );
  }
  return (
    `Lighthouse failed for ${id}: exitCode=${last.exitCode ?? "unknown"} ` +
    `runtimeError=${last.runtimeErrorCode ?? "none"} reportValid=${last.reportValid}; ` +
    `no retry allowed; diagnostics: ${artifacts}`
  );
}

export async function runLighthouseWithRetries({
  id,
  output,
  spawnAttempt,
  maxNoNavstartRetries = MAX_NO_NAVSTART_RETRIES,
}) {
  if (!Number.isInteger(maxNoNavstartRetries) || maxNoNavstartRetries < 0)
    throw new TypeError("maxNoNavstartRetries must be a non-negative integer");

  const attempts = [];
  for (let attempt = 1; attempt <= maxNoNavstartRetries + 1; attempt++) {
    const artifacts = getAttemptArtifacts(output, id, attempt);
    let result;
    try {
      result = await spawnAttempt({ id, attempt, ...artifacts });
    } catch (error) {
      result = {
        exitCode: null,
        error,
        log: error instanceof Error ? error.stack || error.message : String(error),
      };
    }

    await writeFile(artifacts.logPath, asLogBuffer(result?.log));
    const runtimeError = await inspectRuntimeError(artifacts.jsonPath);
    const processCompleted = !result?.error && Number.isInteger(result?.exitCode);
    const failed = result?.exitCode !== 0 || runtimeError.present || !runtimeError.valid;
    const willRetry =
      failed &&
      processCompleted &&
      shouldRetryNoNavStart(result.exitCode, runtimeError.code, attempt - 1) &&
      attempt <= maxNoNavstartRetries;
    const attemptResult = {
      ...artifacts,
      attempt,
      exitCode: result?.exitCode ?? null,
      processCompleted,
      reportValid: runtimeError.valid,
      runtimeErrorPresent: runtimeError.present,
      runtimeErrorCode: runtimeError.code ?? null,
      willRetry,
    };
    attempts.push(attemptResult);

    if (!failed) return { ok: true, attempts };
    if (!willRetry) return { ok: false, attempts, failure: formatFailure(id, attempts) };
  }

  return { ok: false, attempts, failure: formatFailure(id, attempts) };
}

function spawnLighthouseAttempt({ url, configPath, outputPath }) {
  const log = [];
  const child = spawn(
    process.execPath,
    [
      process.env.LIGHTHOUSE_CLI,
      url,
      "--config-path",
      configPath,
      "--output=json",
      "--output-path",
      outputPath,
      "--save-assets",
      "--chrome-flags=--headless=new",
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  for (const stream of [child.stdout, child.stderr]) stream.on("data", (data) => log.push(data));
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolve({
        ...result,
        log: Buffer.concat([Buffer.concat(log), asLogBuffer(result.log)]),
      });
    };
    child.once("error", (error) =>
      finish({ exitCode: null, error, log: Buffer.from(`${error.stack || error.message}\n`) }),
    );
    child.once("close", (exitCode, signal) => finish({ exitCode, signal }));
  });
}

async function main() {
  const [outputArg, sha] = process.argv.slice(2);
  if (!outputArg || !sha || !process.env.LIGHTHOUSE_CLI)
    throw new Error("Expected OUTPUT SHA and LIGHTHOUSE_CLI");
  const output = path.resolve(outputArg);
  await mkdir(output, { recursive: true });
  const configPath = path.join(output, "diagnostic-config.cjs");
  await writeFile(
    configPath,
    `module.exports=${JSON.stringify({ extends: "lighthouse:default", settings: collect.settings })};\n`,
  );
  await writeFile(
    path.join(output, "provenance.json"),
    JSON.stringify({ sha, releaseCertification: false, collect, node: process.version }, null, 2),
  );
  const server = spawn(
    process.execPath,
    ["node_modules/nitro/dist/cli/index.mjs", "preview", "--host", "127.0.0.1", "--port", "4173"],
    { detached: true, stdio: ["ignore", "pipe", "pipe"] },
  );
  let serverLog = "";
  const failures = [];
  for (const stream of [server.stdout, server.stderr])
    stream.on("data", (data) => {
      serverLog = (serverLog + data).slice(-50000);
    });
  try {
    let ready = false;
    for (let attempt = 0; attempt < 120; attempt++) {
      if (server.exitCode !== null && server.exitCode !== 0) throw new Error(serverLog);
      if (/Ready on http:\/\/localhost:/.test(serverLog)) {
        try {
          ready = (await fetch(collect.url[0])).ok;
        } catch {
          /* starting */
        }
      }
      if (ready) break;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    if (!ready) throw new Error(`Preview did not become ready: ${serverLog}`);
    await require("../../scripts/verify-preview-representations.cjs")();
    for (const url of collect.url) {
      const route = new URL(url).pathname;
      for (let run = 1; run <= collect.numberOfRuns; run++) {
        const id = `${route === "/" ? "home" : route.slice(1)}-${run}`;
        const result = await runLighthouseWithRetries({
          id,
          output,
          spawnAttempt: ({ jsonPath }) =>
            spawnLighthouseAttempt({ url, configPath, outputPath: jsonPath }),
        });
        for (const attempt of result.attempts) {
          console.log(
            JSON.stringify({
              id,
              attempt: attempt.attempt,
              traceSaved: true,
              exitCode: attempt.exitCode,
              runtimeErrorCode: attempt.runtimeErrorCode,
              reportValid: attempt.reportValid,
              artifact: path.basename(attempt.jsonPath),
              log: path.basename(attempt.logPath),
              willRetry: attempt.willRetry,
            }),
          );
        }
        if (!result.ok) failures.push(result.failure);
      }
    }
    if (failures.length) throw new Error(failures.join("; "));
  } finally {
    await writeFile(path.join(output, "server.log"), serverLog);
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {
      /* already stopped */
    }
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) await main();
