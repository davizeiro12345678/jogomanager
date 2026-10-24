import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const runtime = process.env.QA_RUNTIME_MODULES;
if (!runtime) throw new Error("Set QA_RUNTIME_MODULES to bundled dependencies");
const { chromium } = createRequire(path.join(runtime, "package.json"))("playwright");
const origin = process.argv[2] ?? "http://127.0.0.1:4240";
const tag = process.argv[3] ?? "baseline";
const mode = process.argv[4] ?? "inspect";
const out = path.resolve("output/playwright/graphics-realism-20261020", tag);
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
  locale: "pt-BR",
});
const page = await context.newPage();
const report = {
  tag,
  origin,
  mode,
  startedAt: new Date().toISOString(),
  pages: [],
  errors: [],
  failedRequests: [],
};
page.on("pageerror", (error) => report.errors.push(error.message));
page.on("requestfailed", (request) =>
  report.failedRequests.push({ url: request.url(), error: request.failure()?.errorText }),
);
try {
  const routes =
    mode === "inspect"
      ? [
          [
            "player-body",
            "/player-studio.html?movement=idle&phase=0.45&framing=body&angle=threeQuarter",
          ],
          ["player-face", "/player-studio.html?movement=idle&phase=0.45&framing=face&angle=front"],
          [
            "player-profile",
            "/player-studio.html?movement=idle&phase=0.45&framing=face&angle=profile",
          ],
          ["cinema", "/cinematic-studio.html"],
          ["match", "/graphics-benchmark.html?scenario=broadcast&manual=1"],
        ]
      : [
          [
            "match-measure",
            "/graphics-benchmark.html?scenario=broadcast&manual=1&warmup=60&duration=300",
          ],
        ];
  for (const [name, route] of routes) {
    await page.goto(origin + route, { waitUntil: "domcontentloaded", timeout: 90000 });
    if (name === "cinema") {
      await page.getByText("Ajustes de exibição e encenação", { exact: true }).click();
      await page
        .getByRole("combobox", { name: "Qualidade do cinema", exact: true })
        .selectOption("alta");
      await page.getByLabel("Reprodução automática", { exact: true }).uncheck();
      await page.getByLabel("Pausar ao abrir", { exact: true }).check();
      await page.getByRole("button", { name: "Ver cena", exact: true }).click();
    }
    await page.locator("canvas").first().waitFor({ timeout: 90000 });
    if (name.startsWith("player"))
      await page.waitForFunction(
        () =>
          Number(
            document.querySelector("[data-rendered-player-vertices]")?.dataset
              .renderedPlayerVertices,
          ) > 0,
        { timeout: 90000 },
      );
    if (mode === "measure") {
      await page.waitForFunction(
        () => {
          try {
            const sample = JSON.parse(document.querySelector("#metrics")?.textContent || "{}");
            return sample.complete === true || sample.measurement?.complete === true;
          } catch {
            return false;
          }
        },
        null,
        { timeout: 480000 },
      );
    }
    if (name === "match")
      await page.waitForFunction(
        () => {
          try {
            return JSON.parse(document.querySelector("#metrics")?.textContent || "{}").draws > 0;
          } catch {
            return false;
          }
        },
        null,
        { timeout: 90000 },
      );
    await page.evaluate(
      () =>
        new Promise((resolve) => {
          let remaining = 12;
          const next = () => (--remaining ? requestAnimationFrame(next) : resolve());
          requestAnimationFrame(next);
        }),
    );
    const state = await page.evaluate(() => {
      const canvas = document.querySelector("canvas");
      const gl = canvas?.getContext("webgl2") ?? canvas?.getContext("webgl");
      const debug = gl?.getExtension("WEBGL_debug_renderer_info");
      const renderer = debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : null;
      return {
        renderer,
        viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
        body: document.body.innerText,
        controls: [...document.querySelectorAll("select")].map((el) => ({
          label: el.getAttribute("aria-label"),
          value: el.value,
          options: [...el.options].map((x) => ({ value: x.value, text: x.text })),
        })),
        datasets: [
          ...document.querySelectorAll(
            "[data-rendered-player-vertices], [data-cinematic-fps], [data-backend], #metrics",
          ),
        ].map((el) => ({
          tag: el.tagName,
          id: el.id,
          data: { ...el.dataset },
          text: el.id === "metrics" ? el.textContent : undefined,
        })),
        benchmark: window.__PFM_GRAPHICS_BENCHMARK__ ?? null,
        game: window.render_game_to_text?.() ?? null,
        bundles: [...document.scripts].map((x) => x.src).filter(Boolean),
      };
    });
    await page.screenshot({ path: path.join(out, name + ".png"), fullPage: true });
    await fs.writeFile(path.join(out, name + ".json"), JSON.stringify(state, null, 2));
    report.pages.push({ name, route, renderer: state.renderer, bundles: state.bundles });
    if (name === "player-profile") {
      await page.getByRole("tab", { name: "Aparência", exact: true }).click();
      for (const style of ["ponytail", "braids", "dreads", "mohawk", "bun"]) {
        await page
          .getByRole("combobox", { name: "Cabelo do atleta", exact: true })
          .selectOption(style);
        await page.waitForFunction(
          (style) =>
            document.querySelector("[data-rendered-player-hair-style]")?.dataset
              .renderedPlayerHairStyle === style,
          style,
        );
        await page.evaluate(
          () =>
            new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
        );
        await page.screenshot({ path: path.join(out, "hair-" + style + ".png"), fullPage: true });
      }
    }
  }
  report.complete = true;
} catch (error) {
  report.complete = false;
  report.failure = error.stack;
  await page
    .screenshot({ path: path.join(out, "failure.png"), fullPage: true })
    .catch(() => undefined);
  await fs
    .writeFile(path.join(out, "failure.txt"), await page.locator("body").innerText())
    .catch(() => undefined);
  process.exitCode = 1;
} finally {
  report.completedAt = new Date().toISOString();
  await fs.writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}
