import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { MobileFrameMetrics } from "./mobile-frame-metrics.ts";

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
  consoleErrors: [],
  captures: [],
  videos: [],
};
async function observe(page, label) {
  page.setDefaultTimeout(60000);
  page.on("pageerror", (error) => report.errors.push(`${label}: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") {
      const text = message.text();
      report.consoleErrors.push({ label, text });
      if (/Shader Error|VALIDATE_STATUS|WebGL: INVALID|THREE.WebGLProgram/.test(text))
        report.errors.push(`${label}: ${text}`);
    }
  });
  page.on("requestfailed", (request) =>
    report.resourceErrors.push({ label, url: request.url(), error: request.failure()?.errorText }),
  );
  page.on("response", (response) => {
    if (response.status() >= 400)
      report.resourceErrors.push({ label, url: response.url(), status: response.status() });
  });
  await page.addInitScript(() => {
    // Read-only counters include shadow/offscreen passes. Times describe WebGL
    // submissions in software, never compositor presentation on a phone.
    const probe = (window.__match3dQA = {
      draws: 0,
      triangles: 0,
      frames: [],
      basis: "webgl-submissions",
      contextLosses: 0,
      fixtureSnapshot: null,
    });
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      constructor(url, options) {
        super(url, options);
        if (String(url).includes("graphics-fixture.worker"))
          this.addEventListener("message", ({ data }) => {
            if (Number.isInteger(data?.seq)) {
              const { seq, time, clock, phase, players, ball, stats, possession, eventSeq } = data;
              probe.fixtureSnapshot = {
                seq,
                time,
                clock,
                phase,
                players,
                ball,
                stats,
                possession,
                eventSeq,
              };
            }
          });
      }
    };
    document.addEventListener(
      "webglcontextlost",
      () => {
        probe.contextLosses++;
      },
      true,
    );
    for (const name of [
      "drawElements",
      "drawArrays",
      "drawElementsInstanced",
      "drawArraysInstanced",
    ]) {
      const original = WebGL2RenderingContext.prototype[name];
      WebGL2RenderingContext.prototype[name] = function (...args) {
        const count = args[name.startsWith("drawElements") ? 1 : 2];
        const instances = name.endsWith("Instanced")
          ? args[name.startsWith("drawElements") ? 4 : 3]
          : 1;
        probe.draws++;
        if (args[0] === this.TRIANGLES) probe.triangles += Math.floor(count / 3) * instances;
        return Reflect.apply(original, this, args);
      };
    }
    const frame = (now) => {
      if (probe.draws && probe.frames.length < 120000)
        probe.frames.push({ now, draws: probe.draws, triangles: probe.triangles });
      probe.draws = probe.triangles = 0;
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}

async function renderer(page) {
  return page
    .locator("canvas")
    .first()
    .evaluate((canvas) => {
      const gl = canvas.getContext("webgl2"),
        extension = gl?.getExtension("WEBGL_debug_renderer_info");
      return {
        width: canvas.width,
        height: canvas.height,
        coarse: matchMedia("(pointer: coarse)").matches,
        dpr: devicePixelRatio,
        renderer: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : null,
        version: gl ? gl.getParameter(gl.VERSION) : null,
        contextLosses: window.__match3dQA.contextLosses,
      };
    });
}

async function measure(page, label) {
  await page.waitForTimeout(2000);
  const start = await page.evaluate(() => performance.now());
  await page.waitForTimeout(10000);
  const end = await page.evaluate(() => performance.now());
  const frames = await page.evaluate(
    ({ start, end }) => window.__match3dQA.frames.filter((f) => f.now >= start && f.now <= end),
    { start, end },
  );
  if (frames.length < 2) throw new Error(`${label}: insufficient real submissions`);
  const metrics = new MobileFrameMetrics(120000);
  for (let index = 1; index < frames.length; index++)
    metrics.add(frames[index].now - frames[index - 1].now);
  const result = {
    label,
    basis: "software-webgl-submissions",
    certification: false,
    warmupMs: 2000,
    observedMs: end - start,
    renderer: await renderer(page),
    metrics: metrics.summary(),
    peakDraws: Math.max(...frames.map((f) => f.draws)),
    peakTriangles: Math.max(...frames.map((f) => f.triangles)),
    frames,
  };
  await writeFile(
    path.join(output, `${label}-submissions.json`),
    JSON.stringify(result, null, 2) + "\n",
  );
  const { frames: _raw, ...summary } = result;
  return summary;
}

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
  await observe(page, "desktop");
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
      contextLosses: window.__match3dQA.contextLosses,
    };
  });
  const framing = page.locator('select:has(option[value="legs"])');
  const movement = page.locator('select:has(option[value="shotPower"])');
  const motionTab = page.getByRole("tab").nth(0);
  const sceneTab = page.getByRole("tab").nth(2);
  async function shot(name, details) {
    console.log(JSON.stringify({ checkpoint: name, sha }));
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: false });
    report.captures.push({
      file: `${name}.png`,
      ...details,
      submissions: await page.evaluate(() => window.__match3dQA.frames.slice(-5)),
    });
  }
  for (const angle of ["threeQuarter", "front", "profile", "back"]) {
    await sceneTab.click();
    await page.locator('select[aria-label="Ângulo da câmera"]').selectOption(angle);
    await framing.selectOption("body");
    await shot(`neutral-${angle}`, { clip: "idle", angle, framing: "body" });
  }
  for (const part of ["face", "kit", "hands"]) {
    await framing.selectOption(part);
    await page.locator('select[aria-label="Ângulo da câmera"]').selectOption("threeQuarter");
    await shot(`detail-${part}`, { framing: part, angle: "threeQuarter" });
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
  await motionTab.click();
  await movement.selectOption("idle");
  await framing.selectOption("body");
  let identityVariation = 1;
  for (const role of ["MF", "DF", "FW", "GK"]) {
    await motionTab.click();
    await page.locator('select:has(option[value="MF"]):has(option[value="GK"])').selectOption(role);
    for (let variant = 1; variant <= 3; variant++) {
      await shot(`identity-${role}-${variant}`, {
        role,
        variant,
        seed: `studio-fla-${role}-${identityVariation}`,
        clip: "idle",
        framing: "body",
      });
      if (variant < 3) {
        await page.locator("button.studio-button.w-full").click();
        identityVariation++;
      }
    }
  }
  await motionTab.click();
  await page.locator('select:has(option[value="MF"]):has(option[value="GK"])').selectOption("MF");
  // Six real rendered pose sequences. Encoding rate is presentation only;
  // sampled action phases must never be reported as physical frame timings.
  await framing.selectOption("body");
  for (const clip of ["pass", "shotPower", "trap", "header", "diveLeft", "slide"]) {
    await motionTab.click();
    await movement.selectOption(clip);
    await sceneTab.click();
    await page.locator('select[aria-label="Ângulo da câmera"]').selectOption("threeQuarter");
    const directory = path.join(output, "video-frames", clip);
    await mkdir(directory, { recursive: true });
    for (let frame = 0; frame < 12; frame++) {
      const progress = Math.round((frame * 100) / 11);
      await page.locator("input.studio-timeline").evaluate((input, value) => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
        if (input.value === String(value)) {
          setter.call(input, value === 0 ? "1" : "0");
          input.dispatchEvent(new Event("input", { bubbles: true }));
        }
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(
          input,
          String(value),
        );
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }, progress);
      await page.waitForFunction(
        (value) =>
          document.querySelector("input.studio-timeline")?.getAttribute("aria-valuetext") ===
          `${value}%`,
        progress,
      );
      await page.getByRole("button", { name: /^(Reproduzir|Play)$/ }).waitFor({ state: "visible" });
      await page.waitForTimeout(180);
      await page
        .locator("canvas")
        .screenshot({ path: path.join(directory, `${String(frame).padStart(2, "0")}.png`) });
    }
    const file = `${clip}.mp4`;
    const encoded = spawnSync(
      "ffmpeg",
      [
        "-y",
        "-loglevel",
        "error",
        "-framerate",
        "8",
        "-i",
        path.join(directory, "%02d.png"),
        "-vf",
        "scale=880:640:force_original_aspect_ratio=decrease,pad=880:640:(ow-iw)/2:(oh-ih)/2,format=yuv420p",
        "-c:v",
        "libx264",
        "-crf",
        "20",
        path.join(output, file),
      ],
      { encoding: "utf8" },
    );
    if (encoded.status !== 0)
      throw new Error(`Video encoding failed: ${encoded.stderr || encoded.error}`);
    report.videos.push({ file, clip, phases: 12, encodingFps: 8, timingEvidence: false });
    console.log(JSON.stringify({ checkpoint: `video-${clip}`, sha }));
  }
  await page.setViewportSize({ width: 844, height: 390 });
  await framing.selectOption("body");
  await shot("mobile-landscape", { viewport: { width: 844, height: 390 }, framing: "body" });
  await page.close();
  report.mobileDiagnostics = [];
  for (const fixture of [
    { id: "mobile-actual-viewport", width: 844, height: 390, dpr: 2.75, cores: 4, memory: 3 },
    {
      id: "mobile-basic-reference",
      width: 1440,
      height: 1000,
      dpr: 1,
      cores: 4,
      memory: 3,
      canvas: [960, 540],
    },
    {
      id: "mobile-mid-reference",
      width: 1440,
      height: 1000,
      dpr: 1,
      cores: 6,
      memory: 6,
      canvas: [1280, 720],
    },
  ]) {
    const mobile = await browser.newPage({
      viewport: { width: fixture.width, height: fixture.height },
      deviceScaleFactor: fixture.dpr,
      isMobile: true,
      hasTouch: true,
      locale: "pt-BR",
    });
    await observe(mobile, fixture.id);
    await mobile.addInitScript(({ cores, memory }) => {
      Object.defineProperty(navigator, "hardwareConcurrency", { get: () => cores });
      Object.defineProperty(navigator, "deviceMemory", { get: () => memory });
    }, fixture);
    await mobile.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await mobile.locator('section[data-scene-status="ready"]').waitFor({ timeout: 60000 });
    if (fixture.canvas) {
      await mobile.locator(".studio-canvas").evaluate((element, dimensions) => {
        element.style.width = `${dimensions[0]}px`;
        element.style.height = `${dimensions[1]}px`;
      }, fixture.canvas);
      await mobile.waitForFunction(([width, height]) => {
        const canvas = document.querySelector(".studio-canvas canvas");
        return canvas?.width === width && canvas?.height === height;
      }, fixture.canvas);
    }
    const diagnostic = await measure(mobile, fixture.id);
    await mobile.screenshot({ path: path.join(output, `${fixture.id}.png`) });
    report.mobileDiagnostics.push({ ...diagnostic, fixture });
    await mobile.close();
  }
  report.matchScenes = [];
  for (const config of [
    { id: "baseline" },
    { id: "broadcast" },
    { id: "director" },
    { id: "cinema" },
    {
      id: "mobile-basic",
      scenario: "broadcast",
      quality: "baixa",
      canvas: [960, 540],
      cores: 4,
      memory: 3,
    },
    {
      id: "mobile-mid",
      scenario: "broadcast",
      quality: "media",
      canvas: [1280, 720],
      cores: 6,
      memory: 6,
    },
  ]) {
    const scenario = config.scenario || config.id;
    const match = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
      deviceScaleFactor: 1,
      locale: "pt-BR",
      isMobile: Boolean(config.canvas),
      hasTouch: Boolean(config.canvas),
    });
    if (config.canvas)
      await match.addInitScript(({ cores, memory }) => {
        Object.defineProperty(navigator, "hardwareConcurrency", { get: () => cores });
        Object.defineProperty(navigator, "deviceMemory", { get: () => memory });
      }, config);
    await observe(match, `match-${config.id}`);
    await match.goto(
      `http://127.0.0.1:${port}/graphics-benchmark.html?scenario=${scenario}${config.quality ? `&quality=${config.quality}` : ""}&manual=1&warmup=5&duration=30`,
      { waitUntil: "domcontentloaded", timeout: 60000 },
    );
    await match.waitForFunction(
      () => {
        const scene = window.render_game_to_text?.();
        return scene && JSON.parse(scene).simulation !== null;
      },
      undefined,
      { timeout: 60000 },
    );
    if (config.canvas) {
      await match
        .locator("main > div")
        .nth(1)
        .evaluate((element, dimensions) => {
          element.style.width = `${dimensions[0]}px`;
          element.style.height = `${dimensions[1]}px`;
        }, config.canvas);
      await match.waitForFunction(([width, height]) => {
        const canvas = document.querySelector("canvas");
        return canvas?.width === width && canvas?.height === height;
      }, config.canvas);
    }
    await match.waitForFunction(() => window.__match3dQA.fixtureSnapshot !== null);
    const sequence = await match.evaluate(() => window.__match3dQA.fixtureSnapshot.seq);
    await match.evaluate(() => window.advanceTime(6000));
    await match.waitForFunction(
      (before) => window.__match3dQA.fixtureSnapshot?.seq > before,
      sequence,
    );
    await match.waitForTimeout(2000);
    const shotPath = `match-${config.id}.png`;
    await match.screenshot({ path: path.join(output, shotPath) });
    const scene = await match.evaluate(() => JSON.parse(window.render_game_to_text()));
    const diagnostic = await measure(match, `match-${config.id}`);
    const authoritativeSnapshot = await match.evaluate(() => window.__match3dQA.fixtureSnapshot);
    report.matchScenes.push({
      file: shotPath,
      scene,
      config,
      authoritativeSnapshot,
      ...diagnostic,
    });
    await match.close();
  }
  report.renderedFlow =
    "Studio -> frame/body and legs -> camera views -> 12 clips -> paused action timeline -> 12 identities -> coarse mobile/fixed framebuffer diagnostics -> four deterministic match scenes";
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
