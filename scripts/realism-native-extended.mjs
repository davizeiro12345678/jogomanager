import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("C:/Users/User/.codex/mcp-game-runtime/node_modules/playwright");
const gpu = process.env.REALISM_GPU === "nvidia" ? "nvidia" : "intel";
for (const [phase, port] of [
  ["before-live-extended", 4267],
  ["after-live-extended", 4268],
]) {
  const folder = phase + (gpu === "nvidia" ? "-nvidia" : "");
  const out = path.resolve("verification/realism-data-20261022", folder);
  await mkdir(out, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    executablePath:
      "C:/Users/User/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe",
    args: [
      "--use-angle=d3d11",
      "--enable-gpu",
      "--ignore-gpu-blocklist",
      "--disable-software-rasterizer",
      ...(gpu === "nvidia" ? ["--force_high_performance_gpu"] : []),
    ],
  });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
  });
  const errors = [];
  const resourceFailures = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400)
      resourceFailures.push({
        url: response.url(),
        status: response.status(),
        expected: response.url().includes("/__l5e/assets-v1/"),
      });
  });
  await page.route("**/__l5e/assets-v1/**", (route) =>
    route.fulfill({ status: 404, body: "controlled procedural fallback" }),
  );
  try {
    await page.addInitScript(() => {
      window.__realismSamples = [];
      window.addEventListener("graphics-sample", (event) =>
        window.__realismSamples.push(event.detail),
      );
    });
    await page.goto(
      `http://127.0.0.1:${port}/graphics-benchmark.html?scenario=broadcast&warmup=60&duration=300`,
      { waitUntil: "domcontentloaded" },
    );
    console.log(
      JSON.stringify({
        phase,
        gpu,
        state: "running",
        protocol:
          "60 s warmup + 300 s capture; live sequential Worker; procedural textures on both revisions",
      }),
    );
    await page.waitForFunction(() => window.__realismSamples.at(-1)?.complete, undefined, {
      timeout: 405000,
      polling: 1000,
    });
    const metrics = await page.evaluate(() => ({
      samples: window.__realismSamples,
      scene: window.render_game_to_text?.(),
      navigation: performance.getEntriesByType("navigation").map((entry) => ({
        domContentLoaded: entry.domContentLoadedEventEnd,
        load: entry.loadEventEnd,
      })),
      renderers: [...document.querySelectorAll("canvas")].map((canvas) => {
        const gl = canvas.getContext("webgl2");
        if (!gl) return null;
        const extension = gl.getExtension("WEBGL_debug_renderer_info");
        return extension
          ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL)
          : gl.getParameter(gl.RENDERER);
      }),
    }));
    if (!metrics.renderers.some((name) => String(name).toLowerCase().includes(gpu)))
      throw new Error("Requested native GPU was not used: " + metrics.renderers.join(", "));
    await writeFile(
      path.join(out, "browser-metrics.json"),
      JSON.stringify(
        {
          ...metrics,
          phase,
          gpu,
          runtime: process.version,
          browser: browser.version(),
          errors,
          resourceFailures,
          assetMode: "procedural",
          scope:
            "One native run per GPU and revision; three equivalent repetitions are required for campaign acceptance. Controlled procedural textures are not a production asset certificate.",
        },
        null,
        2,
      ),
    );
    await page.screenshot({ path: path.join(out, "match-completed.png") });
    const final = metrics.samples.at(-1);
    console.log(
      JSON.stringify({
        phase,
        gpu,
        state: "complete",
        fps: final.fps,
        p95: final.p95,
        acceptance: final.acceptance,
        errors,
      }),
    );
  } catch (error) {
    await writeFile(
      path.join(out, "failure.json"),
      JSON.stringify({ phase, error: String(error), errors }),
    );
    throw error;
  } finally {
    await browser.close();
  }
}
