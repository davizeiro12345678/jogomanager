import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const runtime = process.env.QA_RUNTIME_MODULES;
if (!runtime) throw new Error("Set QA_RUNTIME_MODULES");
const { chromium } = createRequire(path.join(runtime, "package.json"))("playwright");
const origin = process.argv[2] ?? "http://127.0.0.1:4240";
const tag = process.argv[3] ?? "baseline";
const out = path.resolve("output/playwright/graphics-realism-20261020", tag, "cinematics");
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
  locale: "pt-BR",
});
const page = await context.newPage();
const report = {
  origin,
  tag,
  startedAt: new Date().toISOString(),
  functionalOnly: true,
  scope: "Visual and control regression checks; concurrent match audit excludes timing comparisons",
  errors: [],
  views: [],
};
page.on("pageerror", (error) => report.errors.push(error.message));
const fixtures = [
  ["dressing-start", "Vestiário antes do jogo", 0],
  ["dressing-gaze", "Vestiário antes do jogo", 8],
  ["dressing-posture", "Vestiário antes do jogo", 13],
  ["dressing-rise", "Vestiário antes do jogo", 17],
  ["training-contact", "Finalização", 1.972],
  ["trophy", "Comemoração de título", 8],
  ["press", "Apresentação à imprensa", 13],
  ["medical", "Departamento médico", 13],
  ["tunnel-mobile", "Túnel de acesso", 0],
];
try {
  for (const [name, title, moment] of fixtures) {
    await page.setViewportSize(
      name.endsWith("mobile") ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
    );
    await page.goto(origin + "/cinematic-studio.html", {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });
    const scene = page.getByRole("combobox", { name: "Cena cinematográfica", exact: true });
    await scene.locator("option", { hasText: title }).first().waitFor({ state: "attached" });
    const options = await scene
      .locator("option")
      .evaluateAll((items) => items.map((item) => ({ value: item.value, text: item.textContent })));
    const selected = options.find((item) => item.text === title);
    assert(selected, `Missing scene: ${title}`);
    await scene.selectOption(selected.value);
    await page.getByText("Ajustes de exibição e encenação", { exact: true }).click();
    await page
      .getByRole("combobox", { name: "Qualidade do cinema", exact: true })
      .selectOption(name.endsWith("mobile") ? "baixa" : "alta");
    await page
      .getByRole("combobox", { name: "Momento da encenação", exact: true })
      .selectOption(String(moment));
    await page.getByLabel("Reprodução automática", { exact: true }).uncheck();
    await page.getByLabel("Ouvir diálogos", { exact: true }).uncheck();
    await page.getByLabel("Pausar ao abrir", { exact: true }).check();
    await page.getByRole("button", { name: "Ver cena", exact: true }).click();
    await page.locator("canvas").first().waitFor({ timeout: 90000 });
    await page.waitForFunction(
      () => document.querySelector('[data-cinematic-ready="true"]'),
      null,
      { timeout: 90000 },
    );
    const state = await page.evaluate(() => {
      const canvas = document.querySelector("canvas");
      const gl = canvas?.getContext("webgl2") ?? canvas?.getContext("webgl");
      const debug = gl?.getExtension("WEBGL_debug_renderer_info");
      return {
        renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : null,
        scene: { ...document.querySelector("[data-scene-paused]")?.dataset },
        metrics: { ...document.querySelector("[data-cinematic-ready]")?.dataset },
        buttons: [...document.querySelectorAll("button")]
          .map((button) => button.getAttribute("aria-label") || button.innerText)
          .filter(Boolean),
      };
    });
    assert.equal(state.scene.scenePaused, "true");
    await page.screenshot({ path: path.join(out, name + ".png"), fullPage: true });
    if (name === "dressing-gaze") {
      report.pending = { name, title, moment, ...state };
      await fs.writeFile(path.join(out, "progress.json"), JSON.stringify(report, null, 2));
      const initialClock = Number(state.metrics.cinematicTime);
      await page.getByRole("button", { name: "Reproduzir cena", exact: true }).click();
      await page.waitForFunction(
        (start) =>
          Number(document.querySelector("[data-cinematic-time]")?.dataset.cinematicTime) >
          start + 0.6,
        initialClock,
        { timeout: 120000 },
      );
      await page.getByRole("button", { name: "Pausar cena", exact: true }).click();
      const frozen = await page
        .locator("[data-cinematic-time]")
        .getAttribute("data-cinematic-time");
      await page.waitForTimeout(500);
      assert.equal(
        await page.locator("[data-cinematic-time]").getAttribute("data-cinematic-time"),
        frozen,
      );
      state.pauseResume = { passed: true, frozenTime: frozen };
      delete report.pending;
    }
    await page.getByRole("button", { name: "Pular cena", exact: true }).click();
    await page.locator("[data-scene-paused]").waitFor({ state: "detached" });
    report.views.push({ name, title, moment, ...state, skipPassed: true });
    await fs.writeFile(path.join(out, "progress.json"), JSON.stringify(report, null, 2));
  }
  assert.deepEqual(report.errors, []);
  report.complete = true;
} catch (error) {
  report.complete = false;
  report.failure = error.stack;
  report.failureState = await page.evaluate(() =>
    [...document.querySelectorAll("[data-scene-paused], [data-cinematic-ready]")].map((node) => ({
      ...node.dataset,
    })),
  );
  process.exitCode = 1;
  await page
    .screenshot({ path: path.join(out, "failure.png"), fullPage: true })
    .catch(() => undefined);
  await fs
    .writeFile(path.join(out, "failure.txt"), await page.locator("body").innerText())
    .catch(() => undefined);
} finally {
  report.completedAt = new Date().toISOString();
  await fs.writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify({
      complete: report.complete,
      views: report.views.length,
      failure: report.failure,
      errors: report.errors,
    }),
  );
  await browser.close();
}
