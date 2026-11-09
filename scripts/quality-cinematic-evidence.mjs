import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const [originArg, outputArg, tag] = process.argv.slice(2);
if (!originArg || !outputArg || !/^[a-z0-9_-]+$/i.test(tag ?? ""))
  throw new Error("Usage: node scripts/quality-cinematic-evidence.mjs LOCAL_ORIGIN OUTPUT TAG");
const origin = new URL(originArg);
if (!["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname))
  throw new Error("Cinematic evidence is restricted to local previews.");
const runtime = process.env["QA_RUNTIME_MODULES"];
if (!runtime) throw new Error("Set QA_RUNTIME_MODULES to the bundled Playwright node_modules.");
const { chromium } = createRequire(path.join(runtime, "package.json"))("playwright");
const output = path.resolve(outputArg);
const videoRecording = process.env["QA_RECORD_VIDEO"] === "1";
const durationSeconds = Number(process.env["QA_CINEMATIC_SECONDS"] ?? 60);
if (!Number.isFinite(durationSeconds) || durationSeconds < 20 || durationSeconds > 300)
  throw new Error("Cinematic capture duration must be between 20 and 300 seconds.");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  channel: "msedge",
  headless: false,
  args: ["--force-high-performance-gpu"],
});
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1,
  locale: "pt-BR",
  ...(videoRecording
    ? { recordVideo: { dir: path.join(output, "video"), size: { width: 1280, height: 720 } } }
    : {}),
});
const page = await context.newPage();
const samples = [];
const transitions = [];
const errors = [];
await page.exposeFunction("qualityCinematicSample", (sample) => samples.push(sample));
await page.addInitScript(() =>
  window.addEventListener("cinematic-sample", (event) => {
    void window.qualityCinematicSample(event.detail);
  }),
);
page.on("pageerror", (error) => errors.push(error.message));
const report = {
  tag,
  startedAt: new Date().toISOString(),
  protocol: {
    quality: "alta",
    viewport: { width: 1280, height: 720, dpr: 1 },
    headed: true,
    highPerformanceGpu: true,
    durationSeconds,
    videoRecording,
    scene: "prematch-locker",
    autoplay: true,
    narration: false,
    scope: videoRecording
      ? "Visual recording with capture overhead; excluded from FPS comparisons."
      : "Local cinematic transition diagnostic, completed-render one-second windows including startup; not the broadcast certification protocol.",
  },
  samples,
  transitions,
  errors,
};
try {
  await page.goto(new URL("/cinematic-studio.html", origin).href, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  await page
    .getByRole("combobox", { name: "Cena cinematográfica", exact: true })
    .selectOption("prematch-locker");
  await page.getByText("Ajustes de exibição e encenação", { exact: true }).click();
  await page
    .getByRole("combobox", { name: "Qualidade do cinema", exact: true })
    .selectOption("alta");
  await page.getByLabel("Ouvir diálogos", { exact: true }).uncheck();
  await page.getByLabel("Pausar ao abrir", { exact: true }).uncheck();
  await page.getByLabel("Reprodução automática", { exact: true }).check();
  const started = Date.now();
  let screenshot = false;
  let lastState = "";
  let cycles = 0;
  while (Date.now() - started < durationSeconds * 1000) {
    const host = page.locator('[data-cinematic-ready="true"]');
    if (!(await host.count())) {
      await page.getByRole("button", { name: "Ver cena", exact: true }).click();
      await host.first().waitFor({ state: "attached", timeout: 60_000 });
      cycles += 1;
    }
    const state = await host.first().evaluate((element) => ({ ...element.dataset }));
    const key = `${cycles}:${state.cinematicSubject}:${state.cinematicShotType}:${state.cinematicGesture}`;
    if (key !== lastState) {
      transitions.push({ wallSeconds: (Date.now() - started) / 1000, cycle: cycles, ...state });
      lastState = key;
    }
    if (!screenshot && Date.now() - started >= 8000) {
      await page.screenshot({ path: path.join(output, `${tag}.png`) });
      screenshot = true;
    }
    await page.waitForTimeout(250);
  }
  const frames = samples.reduce((sum, sample) => sum + sample.frames, 0);
  const sampledMs = samples.reduce((sum, sample) => sum + sample.frames * sample.meanMs, 0);
  report.summary = {
    windows: samples.length,
    cycles,
    transitions: transitions.length,
    frames,
    sampledMs,
    weightedFps: sampledMs ? (frames * 1000) / sampledMs : 0,
    stallsOver50ms: samples.reduce((sum, sample) => sum + sample.stalls, 0),
    maxFrameMs: Math.max(0, ...samples.map((sample) => sample.maxMs)),
    windowP95MaxMs: Math.max(0, ...samples.map((sample) => sample.p95)),
    windowP99MaxMs: Math.max(0, ...samples.map((sample) => sample.p99)),
    windowOnePercentLowMin: Math.min(Infinity, ...samples.map((sample) => sample.onePercentLow)),
    percentileScope:
      "Per-window extrema; global p95/p99/1% low cannot be reconstructed from summaries.",
    renderer: samples.at(-1)?.backend,
  };
  if (!screenshot) await page.screenshot({ path: path.join(output, `${tag}.png`) });
  report.complete = samples.length > 0 && errors.length === 0;
  if (!report.complete) process.exitCode = 1;
} catch (error) {
  report.complete = false;
  report.failure = String(error.stack ?? error);
  await page.screenshot({ path: path.join(output, `${tag}-failure.png`) }).catch(() => undefined);
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
      summary: report.summary,
      failure: report.failure,
    }),
  );
}
