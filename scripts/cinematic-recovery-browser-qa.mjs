// Browser regression against a local, disposable studio build. The intercepted
// requests are synthetic failures, not evidence of production availability.
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || "playwright");
const output = path.resolve(process.env.EVIDENCE_DIR || ".cinematic-recovery-qa");
const port = 4193;
const origin = `http://127.0.0.1:${port}`;
await mkdir(output, { recursive: true });
const report = {
  sha: process.env.TEST_SHA || "local",
  scope:
    "Local Chromium with software WebGL and synthetic 3D module failures. This does not certify a physical device, network or production.",
  cases: [],
};
const server = spawn(process.execPath, [
  "node_modules/vite/bin/vite.js",
  "preview",
  "--config",
  "scripts/graphics-vite.config.ts",
  "--host",
  "127.0.0.1",
  "--port",
  String(port),
  "--strictPort",
]);
let serverLog = "";
for (const stream of [server.stdout, server.stderr])
  stream.on("data", (data) => {
    serverLog = (serverLog + data.toString()).slice(-40_000);
  });

let browser;
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error(`Preview exited: ${serverLog}`);
    try {
      ready = (await fetch(`${origin}/cinematic-studio.html`)).ok;
      if (ready) break;
    } catch {
      // Server has not started yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!ready) throw new Error(`Preview did not start: ${serverLog}`);
  browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
    headless: true,
    args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });

  async function runCase(name, kind) {
    const entry = { name, passed: false, requests: 0, aborted: 0, pageErrors: [] };
    report.cases.push(entry);
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      locale: "pt-BR",
    });
    const page = await context.newPage();
    let block = true;
    page.on("pageerror", (error) => entry.pageErrors.push(error.message));
    await page.route(/\/CinematicStage3D-[^/]+\.js(?:\?.*)?$/, async (route) => {
      entry.requests++;
      if (block && (kind !== "transient" || entry.aborted === 0)) {
        entry.aborted++;
        await route.abort("failed");
      } else {
        await route.continue();
      }
    });
    try {
      await page.goto(`${origin}/cinematic-studio.html`, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });
      await page.getByText("Ajustes de exibição e encenação", { exact: true }).click();
      await page.getByLabel("Reprodução automática", { exact: true }).uncheck();
      await page.getByRole("button", { name: "Ver cena", exact: true }).click();
      const dialog = page.getByRole("dialog");
      await dialog.waitFor({ state: "visible", timeout: 30_000 });
      const originalBeat = await dialog.getAttribute("data-scene-beat");

      if (kind !== "transient") {
        await page.getByRole("button", { name: "Tentar novamente", exact: true }).waitFor({
          state: "visible",
          timeout: 35_000,
        });
        await page.screenshot({ path: path.join(output, `${name}-fallback.png`) });
        if (kind === "illustrated") {
          await page.getByRole("button", { name: "Abrir cena ilustrada", exact: true }).click();
          await page.waitForFunction(
            () =>
              document.querySelector('[role="dialog"]')?.getAttribute("data-scene-mode") === "2d",
          );
          const advance = page.getByRole("button", { name: "Avançar diálogo", exact: true });
          for (let attempt = 0; attempt < 3; attempt++) {
            await advance.click();
            if ((await dialog.getAttribute("data-scene-beat")) !== originalBeat) break;
            await page.waitForTimeout(200);
          }
          entry.beatAfter = await dialog.getAttribute("data-scene-beat");
          if (entry.beatAfter === originalBeat)
            throw new Error("Illustrated dialogue did not advance");
        } else {
          block = false;
          await page.getByRole("button", { name: "Tentar novamente", exact: true }).click();
        }
      }
      if (kind !== "illustrated") {
        await page.locator('[data-cinematic-ready="true"]').first().waitFor({
          state: "attached",
          timeout: 90_000,
        });
        entry.mode = await dialog.getAttribute("data-scene-mode");
        entry.beatAfter = await dialog.getAttribute("data-scene-beat");
        entry.canvas = await page
          .locator("canvas")
          .first()
          .evaluate((canvas) => ({
            width: canvas.width,
            height: canvas.height,
          }));
        if (entry.mode !== "3d" || !entry.canvas.width || !entry.canvas.height)
          throw new Error("3D canvas was not ready after recovery");
        if (entry.beatAfter !== originalBeat)
          throw new Error("Recovery changed the dialogue position");
      }
      if (!entry.aborted) throw new Error("The 3D module request was not intercepted");
      if (kind !== "illustrated" && entry.requests < 2)
        throw new Error("No subsequent 3D module request was observed");
      await page.screenshot({ path: path.join(output, `${name}-result.png`) });
      entry.passed = true;
    } catch (error) {
      entry.failure = String(error.stack || error);
      await page.screenshot({ path: path.join(output, `${name}-failure.png`) }).catch(() => {});
    } finally {
      await context.close();
    }
  }

  await runCase("transient-download", "transient");
  await runCase("explicit-retry", "retry");
  await runCase("illustrated-fallback", "illustrated");
  if (report.cases.some((entry) => !entry.passed)) process.exitCode = 1;
} catch (error) {
  report.failure = String(error.stack || error);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  server.kill();
  await writeFile(path.join(output, "preview.log"), serverLog);
  await writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
}
