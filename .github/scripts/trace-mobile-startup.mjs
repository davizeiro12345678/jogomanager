import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

// Diagnostic only. Preserve all fifteen raw traces behind the protected
// mobile fixtures; Quality's independent assertions remain the release gate.
const require = createRequire(import.meta.url);
const collect = require("../../.lighthouserc.mobile.cjs").ci.collect;
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
      const id = `${route === "/" ? "home" : route.slice(1)}-${run}`,
        log = [];
      const child = spawn(
        process.execPath,
        [
          process.env.LIGHTHOUSE_CLI,
          url,
          "--config-path",
          configPath,
          "--output=json",
          "--output-path",
          path.join(output, `${id}.json`),
          "--save-assets",
          "--chrome-flags=--headless=new",
        ],
        { stdio: ["ignore", "pipe", "pipe"] },
      );
      for (const stream of [child.stdout, child.stderr])
        stream.on("data", (data) => log.push(data));
      const code = await new Promise((resolve, reject) => {
        child.once("error", reject);
        child.once("close", resolve);
      });
      await writeFile(path.join(output, `${id}.log`), Buffer.concat(log));
      if (code !== 0) failures.push(`${id}: Lighthouse exited ${code}`);
      console.log(JSON.stringify({ id, traceSaved: true, exitCode: code }));
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
