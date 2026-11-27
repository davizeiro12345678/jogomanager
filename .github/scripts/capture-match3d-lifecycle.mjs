import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE);
const [outputArg, sha] = process.argv.slice(2),
  output = path.resolve(outputArg);
const streamedFixture = "jersey_hoops_normal.ktx2";
const fallbackFixture = "shorts_mesh_normal.ktx2";
const detailedCompressedTextures = 3;
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
    "4197",
    "--strictPort",
  ],
  { stdio: ["ignore", "pipe", "pipe"] },
);
let serverLog = "",
  browser;
for (const stream of [server.stdout, server.stderr])
  stream.on("data", (data) => {
    serverLog = (serverLog + data.toString()).slice(-50000);
  });
const report = {
  sha,
  physicalDeviceCertification: false,
  basis: "SwiftShader native WebGL allocation/deletion accounting; no timing certification",
  assetFixture: {
    served: streamedFixture,
    missing: fallbackFixture,
    expectedDetailedCompressedTextures: detailedCompressedTextures,
  },
  errors: [],
  samples: [],
};
try {
  let ready = false;
  for (let i = 0; i < 120; i++) {
    if (server.exitCode !== null) throw Error(`Preview exited: ${serverLog}`);
    try {
      if ((await fetch("http://127.0.0.1:4197/player-studio.html")).ok) {
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
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
    locale: "pt-BR",
    isMobile: true,
    hasTouch: true,
  });
  page.on("pageerror", (error) => report.errors.push(error.message));
  // Keep this allocation comparison hermetic while exercising both the real
  // worker transcoder and the procedural fallback for an immutable miss.
  const fixtureRequests = new Set();
  await page.route("**/__l5e/assets-v1/**", async (route) => {
    const name = path.basename(new URL(route.request().url()).pathname);
    fixtureRequests.add(name);
    if (name === streamedFixture) {
      await route.fulfill({
        path: "public/textures/detail-v1/fabric-normal.ktx2",
        contentType: "image/ktx2",
      });
    } else {
      await route.fulfill({ status: 404 });
    }
  });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "hardwareConcurrency", { get: () => 6 });
    Object.defineProperty(navigator, "deviceMemory", { get: () => 6 });
    const resources = new Map();
    const compressed = new Set();
    const state = (window.__life = { draws: 0, lost: 0, restored: 0, live: {}, compressed: 0 });
    for (const kind of [
      "Buffer",
      "Texture",
      "Program",
      "Framebuffer",
      "Renderbuffer",
      "VertexArray",
    ]) {
      const live = new Set();
      resources.set(kind, live);
      state.live[kind] = 0;
      const create = WebGL2RenderingContext.prototype[`create${kind}`],
        remove = WebGL2RenderingContext.prototype[`delete${kind}`];
      WebGL2RenderingContext.prototype[`create${kind}`] = function (...args) {
        const object = create.apply(this, args);
        if (object) live.add(object);
        state.live[kind] = live.size;
        return object;
      };
      WebGL2RenderingContext.prototype[`delete${kind}`] = function (object) {
        const result = remove.call(this, object);
        live.delete(object);
        if (kind === "Texture" && compressed.delete(object)) state.compressed = compressed.size;
        state.live[kind] = live.size;
        return result;
      };
    }
    for (const name of ["compressedTexImage2D", "compressedTexSubImage2D"]) {
      const upload = WebGL2RenderingContext.prototype[name];
      WebGL2RenderingContext.prototype[name] = function (target, level, ...args) {
        const result = upload.call(this, target, level, ...args);
        if (target === this.TEXTURE_2D && level === 0) {
          const texture = this.getParameter(this.TEXTURE_BINDING_2D);
          if (texture && resources.get("Texture").has(texture)) compressed.add(texture);
          state.compressed = compressed.size;
        }
        return result;
      };
    }
    for (const name of [
      "drawElements",
      "drawArrays",
      "drawElementsInstanced",
      "drawArraysInstanced",
    ]) {
      const draw = WebGL2RenderingContext.prototype[name];
      WebGL2RenderingContext.prototype[name] = function (...args) {
        const value = draw.apply(this, args);
        state.draws++;
        return value;
      };
    }
    document.addEventListener(
      "webglcontextlost",
      () => {
        state.lost++;
        compressed.clear();
        state.compressed = 0;
        for (const [kind, live] of resources) {
          live.clear();
          state.live[kind] = 0;
        }
      },
      true,
    );
    document.addEventListener(
      "webglcontextrestored",
      () => {
        state.restored++;
      },
      true,
    );
  });
  async function open() {
    await page.goto("http://127.0.0.1:4197/player-studio.html", { waitUntil: "domcontentloaded" });
    await page.locator('section[data-scene-status="ready"]').waitFor({ timeout: 60000 });
    await page.waitForFunction(() => window.__life.draws > 200, undefined, { timeout: 60000 });
  }
  async function settle(detailed) {
    // Hair and skin stream from the checked-in assets. The shirt uses the
    // routed KTX2 body above. All three must actually upload on every detail
    // mount, and leave the native context on each low-detail transition.
    const expected = detailed ? detailedCompressedTextures : 0;
    await page.waitForFunction((expected) => window.__life.compressed === expected, expected, {
      timeout: 60000,
    });
    const before = await page.evaluate(() => window.__life.draws);
    await page.waitForFunction((before) => window.__life.draws > before + 80, before, {
      timeout: 60000,
    });
  }
  async function toggle(low) {
    await page
      .getByRole("button", {
        name: low ? "Comparar modelo leve" : "Ver modelo detalhado",
        exact: true,
      })
      .click();
    await page
      .getByRole("button", {
        name: low ? "Ver modelo detalhado" : "Comparar modelo leve",
        exact: true,
      })
      .waitFor();
    await settle(!low);
  }
  await open();
  await settle(true);
  if (!fixtureRequests.has(streamedFixture) || !fixtureRequests.has(fallbackFixture)) {
    throw Error("Studio did not exercise both the streamed and missing KTX2 fixture URLs");
  }
  for (let i = 0; i < 2; i++) {
    await toggle(true);
    await toggle(false);
  }
  const warm = await page.evaluate(() => structuredClone(window.__life));
  report.warm = warm;
  await page.screenshot({ path: path.join(output, "before-cycles.png") });
  for (let cycle = 1; cycle <= 5; cycle++) {
    await toggle(true);
    await toggle(false);
    const sample = await page.evaluate(() => structuredClone(window.__life));
    report.samples.push({ cycle, ...sample });
    for (const [kind, count] of Object.entries(sample.live))
      if (count > warm.live[kind])
        throw Error(`${kind} grew after warmup: ${warm.live[kind]} -> ${count} at cycle${cycle}`);
  }
  const beforeLoss = await page.evaluate(() => window.__life.draws);
  const supported = await page.locator("canvas").evaluate((canvas) => {
    const gl = canvas.getContext("webgl2"),
      extension = gl?.getExtension("WEBGL_lose_context");
    window.__restoreContext = () => extension?.restoreContext();
    extension?.loseContext();
    return Boolean(extension);
  });
  if (!supported) throw Error("WEBGL_lose_context unavailable; recovery was not verified");
  await page.waitForFunction(() => window.__life.lost === 1, undefined, { timeout: 60000 });
  await page.waitForTimeout(500);
  await page.evaluate(() => window.__restoreContext());
  await page.waitForFunction(
    (before) => window.__life.restored === 1 && window.__life.draws > before + 80,
    beforeLoss,
    { timeout: 60000 },
  );
  await settle(true);
  report.recovered = await page.evaluate(() => structuredClone(window.__life));
  for (const [kind, count] of Object.entries(report.recovered.live))
    if (count > warm.live[kind])
      throw Error(`${kind} grew after context restoration: ${warm.live[kind]} -> ${count}`);
  await page.screenshot({ path: path.join(output, "after-context-restoration.png") });
  // Re-entry uses a fresh document in the same browser tab; separate from the
  // same-context component-unmount resource accounting above.
  for (let cycle = 1; cycle <= 3; cycle++) {
    await page.goto("about:blank");
    await open();
    await settle(true);
    report.samples.push({
      reentry: cycle,
      ...(await page.evaluate(() => structuredClone(window.__life))),
    });
  }
  if (report.errors.length) throw Error(`Page errors: ${report.errors.join("; ")}`);
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.failure = String(error);
  throw error;
} finally {
  await browser?.close();
  server.kill("SIGTERM");
  await writeFile(path.join(output, "lifecycle.json"), JSON.stringify(report, null, 2));
  await writeFile(path.join(output, "server.log"), serverLog);
}
