import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("C:/Users/User/.codex/mcp-game-runtime/node_modules/playwright");
const phase = process.argv[2] ?? "before";
const port = process.argv[3] ?? "4261";
const out = path.resolve("verification/realism-data-20261022", phase);
const native = process.env.REALISM_NATIVE === "1";
const assetMode = process.env.REALISM_ASSETS ?? "live";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath:
    "C:/Users/User/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe",
  args: native
    ? [
        "--use-angle=d3d11",
        "--enable-gpu",
        "--ignore-gpu-blocklist",
        "--disable-software-rasterizer",
      ]
    : [],
});
const page = await browser.newPage({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1,
});
const errors = [];
const resourceFailures = [];
if (assetMode === "procedural")
  await page.route("**/__l5e/assets-v1/**", (route) =>
    route.fulfill({ status: 404, body: "controlled procedural fallback" }),
  );
page.on("pageerror", (error) => errors.push(error.message));
page.on("response", (response) => {
  if (response.status() >= 400)
    resourceFailures.push({
      url: response.url(),
      status: response.status(),
      expected: assetMode === "procedural" && response.url().includes("/__l5e/assets-v1/"),
    });
});
page.on("console", (message) => {
  if (message.type() === "error" && !message.text().startsWith("Failed to load resource:"))
    errors.push(message.text().slice(0, 500));
});
try {
  await page.goto(`http://127.0.0.1:${port}/player-studio.html`, { waitUntil: "domcontentloaded" });
  await page.locator("canvas").first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(6000);
  await page.screenshot({ path: path.join(out, "player-full.png"), fullPage: true });
  console.log(
    JSON.stringify({
      phase,
      buttons: await page.getByRole("button").allTextContents(),
      tabs: await page.getByRole("tab").allTextContents(),
      selects: await page.locator("select").evaluateAll((elements) =>
        elements.map((e) => ({
          label: e.getAttribute("aria-label"),
          options: [...e.options].map((o) => ({ value: o.value, text: o.textContent })),
        })),
      ),
      errors,
    }),
  );
  await writeFile(path.join(out, "player-dom.txt"), await page.locator("body").innerText());
  for (const framing of ["face", "kit", "legs", "boots", "hands"]) {
    await page
      .locator("select")
      .filter({ has: page.locator('option[value="body"]') })
      .selectOption(framing);
    await page.waitForTimeout(1100);
    await page.screenshot({ path: path.join(out, `player-${framing}.png`) });
  }
  await page
    .locator("select")
    .filter({ has: page.locator('option[value="body"]') })
    .selectOption("body");
  await page
    .locator("select")
    .filter({ has: page.locator('option[value="shotPower"]') })
    .selectOption("shotPower");
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(out, "player-shot.png") });
  await page.goto(
    `http://127.0.0.1:${port}/graphics-benchmark.html?scenario=broadcast&manual=1&warmup=5&duration=30`,
    { waitUntil: "domcontentloaded" },
  );
  await page.evaluate(() => {
    window.__realismSamples = [];
    window.addEventListener("graphics-sample", (e) => window.__realismSamples.push(e.detail));
  });
  await page.waitForFunction(() => !!window.advanceTime, { timeout: 30000 });
  await page.evaluate(() => window.advanceTime(6000));
  await page.waitForTimeout(6000);
  await page.screenshot({ path: path.join(out, "match-broadcast.png") });
  await page.waitForTimeout(32000);
  const metrics = await page.evaluate(() => ({
    samples: window.__realismSamples,
    scene: window.render_game_to_text?.(),
    resources: performance.getEntriesByType("resource").map((r) => ({
      name: r.name.split("/").pop(),
      duration: r.duration,
      bytes: r.encodedBodySize,
    })),
    navigation: performance.getEntriesByType("navigation").map((n) => ({
      domContentLoaded: n.domContentLoadedEventEnd,
      load: n.loadEventEnd,
      bytes: n.encodedBodySize,
    })),
    renderers: [...document.querySelectorAll("canvas")].map((c) => {
      const gl = c.getContext("webgl2");
      if (!gl) return null;
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    }),
  }));
  await writeFile(
    path.join(out, "browser-metrics.json"),
    JSON.stringify({ ...metrics, phase, native, assetMode, errors, resourceFailures }, null, 2),
  );
  await page.screenshot({ path: path.join(out, "match-measured.png") });
  await page.goto(`http://127.0.0.1:${port}/cinematic-studio.html`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(8000);
  await page.screenshot({ path: path.join(out, "cutscene.png"), fullPage: true });
  await writeFile(path.join(out, "cutscene-dom.txt"), await page.locator("body").innerText());
  console.log(
    JSON.stringify({ phase, images: 10, metrics: path.join(out, "browser-metrics.json"), errors }),
  );
} finally {
  await browser.close();
}
