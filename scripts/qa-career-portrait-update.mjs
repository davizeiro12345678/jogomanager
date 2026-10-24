import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";

const runtime = process.env.QA_RUNTIME_MODULES;
if (!runtime) throw new Error("Set QA_RUNTIME_MODULES to the bundled Playwright runtime");
const { chromium } = createRequire(path.join(runtime, "package.json"))("playwright");
const origin = process.argv[2] || "http://127.0.0.1:4222";
const tag = process.argv[3] || "career-before";
const out = path.resolve("output/playwright/graphics-realism-20261020", tag);
const fixedIdentity = "4dd94df4-2579-4dbc-b33a-202610200001";
const fixedTime = Date.UTC(2026, 9, 20, 12, 0, 0);
const after = tag !== "career-before";
const beforeDirectory = path.resolve("output/playwright/graphics-realism-20261020/career-before");
const priorStorage = after
  ? JSON.parse(await fs.readFile(path.join(beforeDirectory, "guest-storage-state.json"), "utf8"))
  : null;
if (priorStorage) for (const item of priorStorage.origins) item.origin = origin;
await fs.mkdir(out, { recursive: true });
const report = {
  origin,
  tag,
  startedAt: new Date().toISOString(),
  fixture: { fixedIdentity, fixedTime, name: "QA Retrato", club: "fla", position: "ATA" },
  views: [],
  errors: [],
  failedRequests: [],
};
const browser = await chromium.launch({ channel: "msedge", headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
  locale: "pt-BR",
  reducedMotion: "reduce",
  ...(priorStorage ? { storageState: priorStorage } : {}),
});
// The UI's creation flow samples these two identity inputs. Fixing them in
// this isolated guest context gives both builds exactly the same saved athlete.
await context.addInitScript(
  ({ fixedIdentity, fixedTime }) => {
    crypto.randomUUID = () => fixedIdentity;
    Date.now = () => fixedTime;
  },
  { fixedIdentity, fixedTime },
);
const page = await context.newPage();
page.setDefaultTimeout(30000);
page.on("pageerror", (error) => report.errors.push(error.message));
page.on("requestfailed", (request) =>
  report.failedRequests.push({ url: request.url(), error: request.failure()?.errorText }),
);

async function capture(name, selector) {
  console.log("Capturing " + name);
  const host = page.locator(selector);
  await host.scrollIntoViewIfNeeded();
  await host.evaluate((element) => {
    const top = element.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: Math.max(0, top - 180), behavior: "instant" });
  });
  await host.locator("canvas").waitFor({ timeout: 90000 });
  await page.waitForTimeout(1800);
  const state = await host.evaluate((element) => {
    const canvas = element.querySelector("canvas");
    const gl = canvas?.getContext("webgl2") || canvas?.getContext("webgl");
    const debug = gl?.getExtension("WEBGL_debug_renderer_info");
    return {
      label: element.getAttribute("aria-label"),
      graphicsActive: element.dataset.graphicsActive,
      renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : null,
      canvas: canvas ? { width: canvas.width, height: canvas.height } : null,
      fallback: element.textContent,
    };
  });
  assert.ok(state.canvas?.width > 0);
  // Canvas carries fallback HTML in textContent even when WebGL is working.
  // Require the real renderer; inspect the captured pixels for the rig.
  assert.ok(state.renderer, "A real WebGL renderer is required for portrait QA");
  await host.screenshot({ path: path.join(out, name + "-portrait.png"), timeout: 45000 });
  await page.screenshot({
    path: path.join(out, name + "-page.png"),
    fullPage: true,
    timeout: 45000,
  });
  await fs.writeFile(path.join(out, name + ".txt"), await page.locator("body").innerText());
  report.views.push({ name, route: new URL(page.url()).pathname, ...state });
  await fs.writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2));
}

try {
  if (after) {
    // Load the saved career from BEFORE in a fresh isolated context. Visual
    // inspection must not recreate or reset an existing athlete's progress.
    await page.goto(origin + "/jogador/painel?slot=1", {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });
    await page.getByRole("button", { name: /^Abrir modelo 3D de / }).click();
    await capture("career-panel", ".athlete-hero-model");
  }
  await page.goto(origin + "/jogador/novo?slot=" + (after ? "2" : "1"), {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  await page.getByRole("heading", { name: "Criar atleta", exact: true }).waitFor();
  console.log("Loaded actual athlete creation page");
  const consent = page.getByRole("button", { name: "Só o essencial", exact: true });
  if (await consent.isVisible()) await consent.click();
  const controls = await page.evaluate(() => ({
    text: document.body.innerText,
    labels: [...document.querySelectorAll("label")].map((item) => item.outerHTML),
    selects: [...document.querySelectorAll("select")].map((item) => ({
      label: item.getAttribute("aria-label"),
      html: item.outerHTML,
    })),
  }));
  await fs.writeFile(path.join(out, "creation-controls.json"), JSON.stringify(controls, null, 2));
  await page.screenshot({ path: path.join(out, "creation-initial.png"), fullPage: true });
  if (process.argv[4] === "inspect") {
    report.inspectOnly = true;
  } else {
    await page.getByLabel("Nome completo", { exact: true }).fill("QA Retrato");
    await page.getByLabel("Nome na camisa", { exact: true }).fill("RETRATO");
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
    await page
      .getByRole("group", { name: "Clube", exact: true })
      .getByRole("button", { name: /FLA/ })
      .click();
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
    const appearanceSelect = (label) =>
      page
        .locator("label.athlete-field")
        .filter({ has: page.getByText(label, { exact: true }) })
        .locator("select");
    await appearanceSelect("Barba").selectOption("stubble");
    for (const hair of ["short", "ponytail", "dreads", "braids", "mohawk", "bun"]) {
      await appearanceSelect("Cabelo").selectOption(hair);
      await capture("create-" + hair, ".athlete-3d-preview");
    }
    await appearanceSelect("Cabelo").selectOption("short");
    if (!after) {
      await page.getByRole("button", { name: "Confirmar e começar carreira", exact: true }).click();
      await page.waitForURL("**/jogador/painel?slot=1", { timeout: 90000 });
      await page.getByRole("button", { name: /^Abrir modelo 3D de / }).click();
      await capture("career-panel", ".athlete-hero-model");
    }
    if (after) {
      await page.getByRole("button", { name: "Ver meu atleta no estúdio 3D", exact: true }).click();
      await page.locator(".studio-card").waitFor();
      await page.waitForFunction(
        () =>
          Number(
            document.querySelector("[data-rendered-player-vertices]")?.dataset
              .renderedPlayerVertices,
          ) > 0,
      );
      await page
        .locator(".studio-card")
        .getByRole("tab", { name: /Movimento/ })
        .click();
      await page
        .locator(".studio-card select")
        .filter({ has: page.locator('option[value="shotPower"]') })
        .selectOption("shotPower");
      const frames = [];
      for (const [name, label] of [
        ["preparation", "Preparação"],
        ["contact", "Contato"],
        ["recovery", "Recuperação"],
      ]) {
        const stage = page.getByRole("button", { name: label, exact: true });
        await stage.click();
        assert.equal(await stage.getAttribute("aria-pressed"), "true");
        await capture("motion-" + name, ".studio-canvas");
        frames.push(
          createHash("sha256")
            .update(await fs.readFile(path.join(out, "motion-" + name + "-portrait.png")))
            .digest("hex"),
        );
      }
      assert.equal(
        new Set(frames).size,
        3,
        "Preparation, contact and recovery must render three distinct actual poses",
      );
      report.motion = {
        action: "shotPower",
        stages: ["preparation", "contact", "recovery"],
        distinctCanvasFrames: new Set(frames).size,
        fingerprints: frames,
      };
    }
    const storage = await context.storageState();
    await fs.writeFile(
      path.join(out, "guest-storage-state.json"),
      JSON.stringify(storage, null, 2),
    );
    const athleteEntries = storage.origins
      .flatMap((item) => item.localStorage)
      .filter((item) => item.name.startsWith("manager3d.athlete."));
    assert.ok(athleteEntries.length > 0);
    const envelope = athleteEntries.find((item) => item.name.includes("envelope"));
    const state = envelope ? JSON.parse(envelope.value).state : null;
    assert.equal(state?.name, "QA Retrato");
    assert.equal(state?.clubId, "fla");
    assert.equal(typeof state?.seed, "string");
    assert.ok(state.seed.length > 0);
    const fingerprint = createHash("sha256").update(JSON.stringify(state)).digest("hex");
    report.athlete = { state, fingerprint, storageKeys: athleteEntries.map((item) => item.name) };
    if (tag !== "career-before") {
      const before = JSON.parse(
        await fs.readFile(
          path.resolve("output/playwright/graphics-realism-20261020/career-before/report.json"),
          "utf8",
        ),
      );
      assert.equal(
        fingerprint,
        before.athlete.fingerprint,
        "The same career athlete must survive both builds",
      );
      report.identicalAthleteToBefore = true;
    }
    assert.equal(report.errors.length, 0, "The actual career/Studio flow must have no page errors");
    report.complete = true;
  }
} finally {
  if (!report.complete) {
    report.lastPage = await page
      .evaluate(() => ({
        route: location.pathname,
        text: document.body.innerText,
        portrait: document.querySelector(".athlete-3d-preview")?.outerHTML.slice(0, 700),
      }))
      .catch(() => null);
  }
  report.finishedAt = new Date().toISOString();
  await fs.writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
console.log(
  JSON.stringify({
    complete: report.complete,
    views: report.views.length,
    errors: report.errors,
    out,
  }),
);
