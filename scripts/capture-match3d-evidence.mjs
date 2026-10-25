import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const [rootArg, outputArg, portArg = "4193", sha = "unknown"] = process.argv.slice(2);
if (!rootArg || !outputArg) throw new Error("Usage: capture-match3d-evidence ROOT OUTPUT PORT SHA");
const root = path.resolve(rootArg);
const output = path.resolve(outputArg);
const port = Number(portArg);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Invalid preview port");
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
    String(port),
    "--strictPort",
  ],
  { cwd: root, env: process.env, stdio: ["ignore", "pipe", "pipe"] },
);
let serverLog = "";
for (const stream of [server.stdout, server.stderr])
  stream.on("data", (data) => {
    serverLog = (serverLog + data.toString()).slice(-200_000);
  });
const url = `http://127.0.0.1:${port}/player-studio.html`;
let browser;
const report = {
  sha,
  url,
  node: process.version,
  physicalDeviceCertification: false,
  errors: [],
  resourceErrors: [],
  captures: [],
};
try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (server.exitCode !== null) throw new Error(`Preview exited: ${serverLog}`);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {
      /* The local preview may still be binding its socket. */
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!ready) throw new Error("Preview did not become ready");
  browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
    headless: true,
    args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 1,
    locale: "pt-BR",
  });
  page.on("pageerror", (error) => report.errors.push(error.message));
  page.on("requestfailed", (request) =>
    report.resourceErrors.push({ url: request.url(), error: request.failure()?.errorText }),
  );
  page.on("response", (response) => {
    if (response.status() >= 400)
      report.resourceErrors.push({ url: response.url(), status: response.status() });
  });
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.locator('section[data-scene-status="ready"]').waitFor({ timeout: 60_000 });
  await page.waitForTimeout(2000);
  report.title = await page.title();
  report.renderer = await page.locator("canvas").evaluate((canvas) => {
    const gl = canvas.getContext("webgl2");
    const extension = gl?.getExtension("WEBGL_debug_renderer_info");
    return {
      width: canvas.width,
      height: canvas.height,
      renderer: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : null,
      version: gl ? gl.getParameter(gl.VERSION) : null,
    };
  });
  const framing = page.locator('select:has(option[value="legs"])');
  const movement = page.locator('select:has(option[value="shotPower"])');
  const motionTab = page.getByRole("tab").nth(0);
  const sceneTab = page.getByRole("tab").nth(2);
  async function shot(name, details) {
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: false });
    report.captures.push({ file: `${name}.png`, ...details });
  }
  for (const angle of ["threeQuarter", "front", "profile", "back"]) {
    await sceneTab.click();
    await page.locator('select[aria-label="Ângulo da câmera"]').selectOption(angle);
    await framing.selectOption("body");
    await shot(`neutral-${angle}`, { clip: "idle", angle, framing: "body" });
  }
  for (const clip of [
    "walk",
    "run",
    "sprint",
    "accelerate",
    "decelerate",
    "curveRunLeft",
    "pass",
    "shotPower",
    "trap",
    "header",
    "diveLeft",
    "slide",
  ]) {
    await motionTab.click();
    await movement.selectOption(clip);
    const timeline = page.locator("input.studio-timeline");
    if (await timeline.count()) {
      await timeline.evaluate((input) => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
        setter.call(input, "50");
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await page.waitForFunction(
        () =>
          document.querySelector("input.studio-timeline")?.getAttribute("aria-valuetext") === "50%",
      );
    } else {
      await page.waitForTimeout(500);
      const pause = page.getByRole("button", { name: /^(Pausar|Pause)$/ });
      if (await pause.count()) await pause.click();
    }
    await framing.selectOption("legs");
    for (const angle of ["threeQuarter", "profile"]) {
      await sceneTab.click();
      await page.locator('select[aria-label="Ângulo da câmera"]').selectOption(angle);
      await shot(`${clip}-${angle}`, {
        clip,
        angle,
        framing: "legs",
        progress: (await timeline.count()) ? 0.5 : null,
      });
    }
  }
  await page.setViewportSize({ width: 844, height: 390 });
  await framing.selectOption("body");
  await shot("mobile-landscape", { viewport: { width: 844, height: 390 }, framing: "body" });
  report.renderedFlow =
    "Studio -> frame/body and legs -> camera views -> 12 clips -> paused action timeline -> mobile viewport";
  report.assetsComplete = report.resourceErrors.length === 0;
  report.status = report.errors.length
    ? "failed-runtime"
    : report.assetsComplete
      ? "captured"
      : "captured-incomplete-assets";
  if (report.errors.length) throw new Error(`Studio runtime errors: ${report.errors.join("; ")}`);
} catch (error) {
  report.failure = String(error.stack || error);
  report.status = "failed";
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
  await writeFile(path.join(output, "server.log"), serverLog);
  await writeFile(path.join(output, "evidence.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(
    JSON.stringify({ status: report.status, sha, captures: report.captures.length, output }),
  );
}
