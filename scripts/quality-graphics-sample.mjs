import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const [originArg, outputArg, tag = "sample", scenario = "broadcast"] = process.argv.slice(2);
if (!originArg || !outputArg || !/^[a-zA-Z0-9_-]+$/.test(tag))
  throw new Error("Usage: node scripts/quality-graphics-sample.mjs ORIGIN OUTPUT TAG [SCENARIO]");
const origin = new URL(originArg);
if (!["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname))
  throw new Error("The visual harness only accepts a local isolated fixture");
const runtime = process.env["QA_RUNTIME_MODULES"];
if (!runtime) throw new Error("Set QA_RUNTIME_MODULES to the bundled browser runtime");
const { chromium } = createRequire(path.join(runtime, "package.json"))("playwright");
const output = path.resolve(outputArg);
await mkdir(output, { recursive: true });
const headed = process.env["QA_HEADED"] === "1";
const highPerformanceGpu = process.env["QA_HIGH_PERFORMANCE_GPU"] === "1";
const recordVideo = process.env["QA_RECORD_VIDEO"] === "1";
const browser = await chromium.launch({
  channel: "msedge",
  headless: !headed,
  args: highPerformanceGpu ? ["--force-high-performance-gpu"] : [],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
  locale: "pt-BR",
  ...(recordVideo
    ? { recordVideo: { dir: path.join(output, "video"), size: { width: 1440, height: 1000 } } }
    : {}),
});
const page = await context.newPage();
const errors = [];
const requests = [];
const timeline = [];
await page.exposeFunction("qualityFrameSample", (sample) => {
  timeline.push(sample);
  if (timeline.length % 15 === 0)
    console.log(
      JSON.stringify({
        tag,
        elapsed: sample.elapsed,
        fps: sample.fps,
        p95: sample.p95,
        renderer: sample.backend?.gpuRenderer,
        complete: sample.complete,
      }),
    );
});
await page.addInitScript(() =>
  window.addEventListener("graphics-sample", (event) => {
    void window.qualityFrameSample(event.detail);
  }),
);
page.on("pageerror", (error) => errors.push(error.message));
page.on("requestfailed", (request) =>
  requests.push({ url: request.url(), error: request.failure()?.errorText }),
);
const warmup = Number(process.env["QA_WARMUP_SECONDS"] ?? 10);
const duration = Number(process.env["QA_DURATION_SECONDS"] ?? 30);
const url = new URL("/graphics-benchmark.html", origin);
url.search = new URLSearchParams({
  scenario,
  quality: "alta",
  warmup: String(warmup),
  duration: String(duration),
}).toString();
const report = {
  tag,
  url: url.href,
  startedAt: new Date().toISOString(),
  protocol: {
    quality: "alta",
    renderWidth: 1280,
    renderHeight: 720,
    dpr: 1,
    headless: !headed,
    highPerformanceGpu,
    videoRecording: recordVideo,
    browser: "msedge",
    adaptive: false,
    warmupSeconds: warmup,
    durationSeconds: duration,
    scope: recordVideo
      ? "visual recording with capture overhead; excluded from FPS comparisons"
      : "local completed-render timing diagnostic; full protocol status comes from the embedded contract",
  },
  errors,
  failedRequests: requests,
  timeline,
};
try {
  await page.goto(url.href, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForFunction(
    () => {
      try {
        return (
          JSON.parse(document.getElementById("metrics")?.textContent ?? "{}").complete === true
        );
      } catch {
        return false;
      }
    },
    null,
    { polling: 1000, timeout: (warmup + duration + 120) * 1000 },
  );
  report.sample = await page.locator("#metrics").evaluate((node) => JSON.parse(node.textContent));
  report.game = await page.evaluate(() =>
    typeof window.render_game_to_text === "function"
      ? JSON.parse(window.render_game_to_text())
      : null,
  );
  report.resources = await page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .filter((entry) => new URL(entry.name).origin === location.origin)
      .map((entry) => ({
        name: new URL(entry.name).pathname,
        bytes: entry.transferSize,
        decodedBytes: entry.decodedBodySize,
        durationMs: entry.duration,
      })),
  );
  const pixels = await page
    .locator("canvas")
    .first()
    .screenshot({ path: path.join(output, `${tag}.png`) });
  report.image = { path: `${tag}.png`, sha256: createHash("sha256").update(pixels).digest("hex") };
  report.complete = true;
} catch (error) {
  report.complete = false;
  report.failure = String(error.stack ?? error);
  await page.screenshot({ path: path.join(output, `${tag}-failure.png`) }).catch(() => undefined);
  report.body = await page
    .locator("body")
    .innerText()
    .catch(() => "unavailable");
  process.exitCode = 1;
} finally {
  report.completedAt = new Date().toISOString();
  const video = page.video();
  await context.close();
  if (video) report.video = path.relative(output, await video.path());
  await writeFile(path.join(output, `${tag}.json`), JSON.stringify(report, null, 2) + "\n");
  await browser.close();
  console.log(
    JSON.stringify({
      tag,
      complete: report.complete,
      fps: report.sample?.fps,
      p95: report.sample?.p95,
      onePercentLow: report.sample?.onePercentLow,
      backend: report.sample?.backend,
      errors,
      failure: report.failure,
    }),
  );
}
