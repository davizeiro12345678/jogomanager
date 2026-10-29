import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

// Read-only diagnostic. CDP sampling with actual 4x CPU throttling is not the
// Lighthouse simulated-mobile gate and cannot replace its worst-of-three runs.
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const [rootArg, outputArg, portArg = "4175", sha = "unknown"] = process.argv.slice(2);
if (!rootArg || !outputArg) throw new Error("Expected ROOT OUTPUT PORT SHA");
const root = path.resolve(rootArg),
  output = path.resolve(outputArg),
  port = Number(portArg);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Invalid port");
await mkdir(output, { recursive: true });
const server = spawn(
  process.execPath,
  [
    "node_modules/nitro/dist/cli/index.mjs",
    "preview",
    "--host",
    "127.0.0.1",
    "--port",
    String(port),
  ],
  { cwd: root, env: process.env, detached: true, stdio: ["ignore", "pipe", "pipe"] },
);
let serverLog = "",
  browser;
for (const stream of [server.stdout, server.stderr])
  stream.on("data", (data) => {
    serverLog = (serverLog + data.toString()).slice(-50000);
  });
const report = {
  sha,
  node: process.version,
  basis: "CDP CPU sampling, 4x actual CPU slowdown, unthrottled network",
  releaseCertification: false,
  runs: [],
};
try {
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    // The outer Nitro listener opens before its preview proxy is initialized.
    // An early request hits a TDZ in Nitro. Use the same Wrangler ready signal
    // as LHCI, then verify the actual HTTP response before recording anything.
    if (server.exitCode !== null && server.exitCode !== 0)
      throw new Error(`Preview exited: ${serverLog}`);
    try {
      if (
        /Ready on http:\/\/localhost:/.test(serverLog) &&
        (await fetch(`http://127.0.0.1:${port}/`)).ok
      ) {
        ready = true;
        break;
      }
    } catch {
      /* startup */
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!ready) throw new Error(`Preview did not become ready: ${serverLog}`);
  browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    headless: true,
  });
  report.browser = browser.version();
  for (const route of [
    "/",
    "/guias",
    "/guia-de-scouting",
    "/melhores-formacoes",
    "/partida-rapida",
  ])
    for (let run = 1; run <= 3; run++) {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2.75,
        isMobile: true,
        hasTouch: true,
        locale: "pt-BR",
      });
      const page = await context.newPage(),
        session = await context.newCDPSession(page);
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.addInitScript(() => {
        window.__startupTasks = [];
        window.__startupLcp = [];
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries())
            window.__startupTasks.push({
              start: entry.startTime,
              duration: entry.duration,
              name: entry.name,
            });
        }).observe({ type: "longtask", buffered: true });
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries())
            window.__startupLcp.push({
              start: entry.startTime,
              size: entry.size,
              tag: entry.element?.tagName,
              text: entry.element?.textContent?.slice(0, 200),
            });
        }).observe({ type: "largest-contentful-paint", buffered: true });
      });
      const traceEvents = [];
      session.on("Tracing.dataCollected", ({ value }) => traceEvents.push(...value));
      await session.send("Tracing.start", {
        categories: "devtools.timeline,v8,blink.user_timing,loading",
        options: "record-as-much-as-possible",
      });
      await session.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      await session.send("Profiler.enable");
      await session.send("Profiler.setSamplingInterval", { interval: 1000 });
      await session.send("Profiler.start");
      await page.goto(`http://127.0.0.1:${port}${route}`, { waitUntil: "load", timeout: 60000 });
      await page.waitForTimeout(6000);
      const { profile } = await session.send("Profiler.stop");
      const tracingComplete = new Promise((resolve) =>
        session.once("Tracing.tracingComplete", resolve),
      );
      await session.send("Tracing.end");
      await tracingComplete;
      const id = `${route === "/" ? "home" : route.slice(1)}-${run}`;
      await writeFile(path.join(output, `${id}.cpuprofile`), JSON.stringify(profile));
      await writeFile(path.join(output, `${id}.trace.json`), JSON.stringify({ traceEvents }));
      if (run === 1) {
        await page.screenshot({ path: path.join(output, `${id}.png`) });
        await writeFile(path.join(output, `${id}.html`), await page.content());
      }
      const nodes = new Map(profile.nodes.map((node) => [node.id, node]));
      const self = new Map();
      profile.samples.forEach((sample, index) =>
        self.set(sample, (self.get(sample) || 0) + (profile.timeDeltas[index] || 0)),
      );
      const hot = [...self]
        .map(([id, us]) => ({ ...nodes.get(id).callFrame, selfMs: us / 1000 }))
        .sort((a, b) => b.selfMs - a.selfMs)
        .slice(0, 70);
      const timing = await page.evaluate(() => ({
        navigation: performance.getEntriesByType("navigation").map((entry) => entry.toJSON()),
        paint: performance.getEntriesByType("paint").map((entry) => entry.toJSON()),
        tasks: window.__startupTasks,
        lcp: window.__startupLcp,
        resources: performance.getEntriesByType("resource").map((entry) => ({
          name: entry.name,
          start: entry.startTime,
          duration: entry.duration,
          bytes: entry.transferSize,
          initiator: entry.initiatorType,
        })),
      }));
      report.runs.push({ route, run, id, errors, hot, timing });
      await writeFile(path.join(output, "summary.json"), JSON.stringify(report, null, 2));
      console.log(JSON.stringify({ checkpoint: id, errors: errors.length, top: hot.slice(0, 5) }));
      await context.close();
    }
} finally {
  await browser?.close();
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
  }
  await writeFile(path.join(output, "server.log"), serverLog);
}
