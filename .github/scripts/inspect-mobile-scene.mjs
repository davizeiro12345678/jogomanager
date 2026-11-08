import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE);
const [outputArg, sha] = process.argv.slice(2),
  output = path.resolve(outputArg);
await mkdir(output, { recursive: true });
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
    "4198",
    "--strictPort",
  ],
  { stdio: ["ignore", "pipe", "pipe"] },
);
let log = "",
  browser;
for (const stream of [server.stdout, server.stderr])
  stream.on("data", (d) => {
    log = (log + d).slice(-50000);
  });
const violations = [];
try {
  let ready = false;
  for (let i = 0; i < 120; i++) {
    if (server.exitCode !== null) throw Error(log);
    try {
      if ((await fetch("http://127.0.0.1:4198/graphics-benchmark.html")).ok) {
        ready = true;
        break;
      }
    } catch {
      /* startup */
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!ready) throw Error("Preview not ready");
  browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    headless: true,
    args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  for (const config of [
    { quality: "baixa", cores: 4, memory: 3, css: [960, 540], pixels: [864, 486], cap: 75 },
    { quality: "media", cores: 6, memory: 6, css: [1280, 720], pixels: [1280, 720], cap: 110 },
  ]) {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
      deviceScaleFactor: 1,
      isMobile: true,
      hasTouch: true,
      locale: "pt-BR",
    });
    await page.addInitScript((config) => {
      Object.defineProperty(navigator, "hardwareConcurrency", { get: () => config.cores });
      Object.defineProperty(navigator, "deviceMemory", { get: () => config.memory });
      const NativeWorker = Worker;
      window.__fixtureSeq = -1;
      window.Worker = class extends NativeWorker {
        constructor(url, options) {
          super(url, options);
          if (String(url).includes("graphics-fixture.worker"))
            this.addEventListener("message", ({ data }) => {
              if (Number.isInteger(data?.seq)) window.__fixtureSeq = data.seq;
            });
        }
      };
    }, config);
    await page.goto(
      `http://127.0.0.1:4198/graphics-benchmark.html?scenario=broadcast&quality=${config.quality}&manual=1&warmup=5&duration=30`,
      { waitUntil: "domcontentloaded" },
    );
    await page.waitForFunction(() => window.__fixtureSeq >= 0, undefined, { timeout: 60000 });
    await page
      .locator("main > div")
      .nth(1)
      .evaluate((element, css) => {
        element.style.width = `${css[0]}px`;
        element.style.height = `${css[1]}px`;
      }, config.css);
    await page.waitForFunction(
      ([w, h]) => {
        const canvas = document.querySelector("canvas");
        return canvas?.width === w && canvas?.height === h;
      },
      config.pixels,
      { timeout: 60000 },
    );
    const seq = await page.evaluate(() => window.__fixtureSeq);
    await page.evaluate(() => window.advanceTime(6000));
    await page.waitForFunction((seq) => window.__fixtureSeq > seq, seq, { timeout: 60000 });
    await page.evaluate(() => window.render_draw_inventory());
    await page.waitForTimeout(7000);
    const start = await page.evaluate(() => {
      window.render_draw_inventory(); // include batches attached during warmup
      return performance.now();
    });
    await page.waitForTimeout(10000);
    const data = await page.evaluate(() => ({
      inventory: window.render_draw_inventory(),
      scene: JSON.parse(window.render_game_to_text()),
    }));
    const frames = data.inventory.frames.filter((f) => f.now >= start),
      peak = Math.max(0, ...frames.map((f) => f.draws));
    const report = {
      sha,
      config,
      basis: "frozen-scene software WebGL submissions",
      physicalDeviceCertification: false,
      peak,
      ...data,
    };
    await writeFile(path.join(output, `${config.quality}.json`), JSON.stringify(report, null, 2));
    await page.screenshot({ path: path.join(output, `${config.quality}.png`) });
    console.log(JSON.stringify({ quality: config.quality, peak, frames: frames.length }));
    if (!frames.length || peak > config.cap)
      violations.push(`${config.quality}: ${peak} draws, cap${config.cap}`);
    await page.close();
  }
  if (violations.length) throw Error(violations.join("; "));
} finally {
  await browser?.close();
  server.kill("SIGTERM");
  await writeFile(path.join(output, "server.log"), log);
}
