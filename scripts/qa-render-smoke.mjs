import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const sharp = require("sharp");
const output = path.resolve(process.argv[2] || "render-smoke");
await mkdir(output, { recursive: true });
const port = 4196;
const base = `http://127.0.0.1:${port}`;
const server = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "preview",
    "--config",
    "scripts/graphics-vite.config.ts",
    "--host",
    "127.0.0.1",
    "--port",
    String(port),
    "--strictPort",
  ],
  { stdio: "ignore" },
);
let browser;
const errors = [];

async function assertImageNotBlack(buffer, label) {
  const { data, info } = await sharp(buffer)
    .resize(80, 45)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let lit = 0;
  for (let i = 0; i < data.length; i += info.channels)
    if (Math.max(data[i], data[i + 1], data[i + 2]) > 12) lit++;
  if (lit / (data.length / info.channels) < 0.1)
    throw new Error(`${label}: image is almost entirely black`);
}

try {
  let available = false;
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`${base}/cinematic-studio.html`)).ok) {
        available = true;
        break;
      }
    } catch {
      /* starting */
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!available) throw new Error("Graphics preview did not start");
  browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
    headless: true,
    args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    window.addEventListener("graphics-ready", (event) => {
      window.__matchGraphicsReady = event.detail;
    });
    // Record the loading state even when it disappears before the test can
    // inspect the canvas, without interfering with the real animation loop.
    if (location.pathname.endsWith("/graphics-benchmark.html")) {
      const observer = new MutationObserver(() => {
        if (document.querySelector('[data-stadium-loading="true"]')) {
          window.__stadiumLoadingSeen = true;
          observer.disconnect();
        }
      });
      observer.observe(document, { childList: true, subtree: true });
    }
  });
  let releaseSet;
  const waitForSet = new Promise((resolve) => {
    releaseSet = resolve;
  });
  let setRequested;
  const requested = new Promise((resolve) => {
    setRequested = resolve;
  });
  await page.route(/\/LockerRoom-[^/]+\.js/, async (route) => {
    setRequested();
    await waitForSet;
    await route.continue();
  });
  await page.goto(`${base}/cinematic-studio.html`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Ver cena" }).click();
  await Promise.race([
    requested,
    new Promise((_, reject) => {
      const timer = setTimeout(() => reject(new Error("Selected set was not requested")), 120000);
      timer.unref();
    }),
  ]);
  const canvas = page.locator("[data-cinematic-set] canvas");
  await canvas.waitFor({ state: "attached", timeout: 120000 });
  await page.waitForFunction(
    () => document.querySelector("[data-cinematic-set] canvas")?.clientWidth > 0,
    null,
    { timeout: 120000 },
  );
  const loadingOpacity = await canvas.evaluate(
    (element) => getComputedStyle(element.parentElement.parentElement).opacity,
  );
  if (loadingOpacity !== "0")
    throw new Error(`Incomplete cinematic canvas was visible: ${loadingOpacity}`);
  await page.screenshot({ path: path.join(output, "cutscene-loading.png") });
  releaseSet();
  await page.locator('[data-cinematic-ready="true"]').waitFor({ timeout: 120000 });
  await page.waitForFunction(
    () =>
      getComputedStyle(
        document.querySelector("[data-cinematic-set] canvas").parentElement.parentElement,
      ).opacity === "1",
    null,
    { timeout: 120000 },
  );
  const cinematic = await canvas.screenshot({
    path: path.join(output, "cutscene-ready.png"),
    timeout: 120000,
  });
  await assertImageNotBlack(cinematic, "cutscene");
  const sceneTiming = await page
    .locator('[role="dialog"][data-scene-loading]')
    .evaluate((element) => ({
      loadMs: element.dataset.sceneLoadMs,
      backdropMs: element.dataset.sceneBackdropVisibleMs,
    }));

  await page.goto(`${base}/graphics-benchmark.html?scenario=broadcast&manual=1`, {
    waitUntil: "domcontentloaded",
  });
  const match = page.locator("canvas").first();
  await match.waitFor({ timeout: 120000 });
  const matchLoading = page.locator('[data-stadium-loading="true"]');
  if (!(await page.evaluate(() => window.__stadiumLoadingSeen === true)))
    throw new Error("Match loading state was not displayed before the first frame");
  await page.waitForFunction(() => window.__matchGraphicsReady, null, { timeout: 120000 });
  await matchLoading.waitFor({ state: "hidden", timeout: 120000 });
  // First draw and compositor presentation are not the same event. Give the
  // startup recovery a bounded opportunity to display a real frame, while
  // keeping the original non-black assertion for every captured canvas.
  const firstDrawAt = Date.now();
  let matchImage;
  let visualError;
  do {
    matchImage = await match.screenshot({
      path: path.join(output, "match-ready.png"),
      timeout: 120000,
    });
    try {
      await assertImageNotBlack(matchImage, "match");
      visualError = undefined;
      break;
    } catch (error) {
      visualError = error;
      if (Date.now() - firstDrawAt >= 30000) break;
      await page.waitForTimeout(1000);
    }
  } while (true);
  if (await page.getByText("O estádio não foi exibido", { exact: false }).count())
    throw new Error("Match fell back to the black-frame warning");
  const matchTiming = await page.evaluate(() => window.__matchGraphicsReady);
  await writeFile(
    path.join(output, "result.json"),
    JSON.stringify(
      {
        renderer: "SwiftShader",
        sceneTiming,
        matchTiming,
        presentationWaitMs: Date.now() - firstDrawAt,
        errors,
      },
      null,
      2,
    ),
  );
  if (visualError) throw visualError;
  if (errors.length) throw new Error(errors.join("\n"));
} finally {
  await browser?.close();
  server.kill();
}
