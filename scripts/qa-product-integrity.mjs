import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";

const runtime = process.env.QA_RUNTIME_MODULES;
if (!runtime) throw new Error("Set QA_RUNTIME_MODULES to the installed Playwright runtime");
const { chromium } = createRequire(path.join(runtime, "package.json"))("playwright");
const origin = process.argv[2] || "http://127.0.0.1:4222";
const out = path.resolve("output/playwright/product-integrity-20261020");
const fixture = path.resolve("tests/fixtures/career-backup/backup-fixture.pfm3d.json");
const expected = JSON.parse(
  await fs.readFile("tests/fixtures/career-backup/backup-fixture-expected.json", "utf8"),
);
await fs.mkdir(out, { recursive: true });
const report = {
  origin,
  startedAt: new Date().toISOString(),
  fixture: "Synthetic progressed Flamengo career; no real user account/payment",
  checks: [],
  views: [],
  errors: [],
};
const browser = await chromium.launch({ channel: "msedge", headless: true });
const digest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const contexts = [];
async function dismissOptionalConsent(page) {
  const essential = page.getByRole("button", { name: "Só o essencial", exact: true });
  try {
    await essential.waitFor({ state: "visible", timeout: 3000 });
  } catch {
    return;
  }
  await essential.click();
}
async function profile() {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    locale: "pt-BR",
    acceptDownloads: true,
  });
  contexts.push(context);
  const page = await context.newPage();
  page.on("pageerror", (error) => report.errors.push(error.message));
  await page.goto(origin + "/perfil", { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.getByRole("heading", { name: "Perfil vazio" }).waitFor();
  await dismissOptionalConsent(page);
  assert.equal(await page.evaluate(() => localStorage.getItem("manager3d.career.v1")), null);
  return { context, page };
}
async function capture(page, name) {
  // Visibility ignores opacity. Let finite UI transitions finish before saving
  // pixels/text, otherwise a transient heading can masquerade as recovery.
  await page.evaluate(async () => {
    await Promise.all(
      document
        .getAnimations()
        .filter((animation) => {
          const end = animation.effect?.getComputedTiming().endTime;
          return typeof end === "number" && Number.isFinite(end) && end < 6000;
        })
        .map((animation) => animation.finished.catch(() => undefined)),
    );
  });
  const text = await page.locator("body").innerText();
  const width = await page.evaluate(() => ({
    viewport: innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  const screenshot = path.join(out, name + ".png");
  await page.screenshot({ path: screenshot, fullPage: true, timeout: 45000 });
  report.views.push({ name, route: new URL(page.url()).pathname, text, width, screenshot });
  await fs.writeFile(path.join(out, name + ".txt"), text);
}
async function restoredState(page) {
  await page.waitForFunction(
    () =>
      JSON.parse(localStorage.getItem("manager3d.career.v1") || "null")?.managerName ===
      "QA Restauração",
  );
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem("manager3d.career.v1")));
  const fingerprints = Object.fromEntries(
    Object.keys(expected.fingerprints).map((key) => [key, digest(state[key])]),
  );
  assert.deepEqual(fingerprints, expected.fingerprints);
  assert.equal(state.clubId, expected.clubId);
  assert.equal(state.season, expected.season);
  assert.equal(state.round, expected.round);
  return fingerprints;
}
async function importThroughUi(page, file, name) {
  await page.getByLabel("Selecionar arquivo JSON de carreira de treinador").setInputFiles(file);
  const review = page.getByRole("region", { name: "Revisar restauração da carreira" });
  await review.waitFor();
  await capture(page, name + "-review");
  assert.match(await review.innerText(), /Flamengo/);
  assert.equal(await page.evaluate(() => localStorage.getItem("manager3d.career.v1")), null);
  await page
    .getByRole("button", { name: "Confirmar restauração da carreira", exact: true })
    .click();
  await page.getByRole("button", { name: "Exportar carreira", exact: true }).waitFor();
  report.checks.push({
    name: name + " persisted critical fields",
    fingerprints: await restoredState(page),
    passed: true,
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Exportar carreira", exact: true }).waitFor();
  report.checks.push({
    name: name + " survived reload",
    fingerprints: await restoredState(page),
    passed: true,
  });
  await capture(page, name + "-restored");
}
try {
  const a = await profile();
  await importThroughUi(a.page, fixture, "profile-a");
  await a.page.getByRole("button", { name: "Exportar carreira", exact: true }).click();
  await a.page.getByRole("region", { name: "Revisar exportação da carreira" }).waitFor();
  await capture(a.page, "export-review");
  await a.page.getByRole("region", { name: "Revisar exportação da carreira" }).screenshot({
    path: path.join(out, "export-review-fields.png"),
  });
  const downloadPromise = a.page.waitForEvent("download");
  await a.page.getByRole("button", { name: "Baixar carreira validada", exact: true }).click();
  const download = await downloadPromise;
  const downloadedPath = path.join(out, download.suggestedFilename());
  await download.saveAs(downloadedPath);
  const downloaded = JSON.parse(await fs.readFile(downloadedPath, "utf8"));
  assert.equal(downloaded.kind, "pro-football-manager-3d-career");
  for (const key of Object.keys(expected.fingerprints))
    assert.equal(digest(downloaded.career[key]), expected.fingerprints[key]);
  report.checks.push({
    name: "download contains validated career and eight unchanged sections",
    passed: true,
    downloadedPath,
  });
  const b = await profile();
  await importThroughUi(b.page, downloadedPath, "profile-b");
  for (const route of ["/squad", "/finances", "/history", "/league"]) {
    await b.page.goto(origin + route, { waitUntil: "domcontentloaded", timeout: 90000 });
    await b.page.getByRole("heading", { level: 1 }).first().waitFor();
    await capture(b.page, "restored" + route.replaceAll("/", "-"));
    const rendered = await b.page.locator("body").innerText();
    assert.doesNotMatch(
      rendered,
      /Você ainda não tem uma carreira|Não há carreira ativa|Página não encontrada/,
    );
    if (route === "/league") assert.match(rendered, /Rodada 4/);
  }
  report.checks.push({
    name: "second isolated browser profile renders squad finances history and league calendar",
    passed: true,
  });
  await b.page.goto(origin + "/perfil", { waitUntil: "domcontentloaded" });
  await b.page.getByRole("button", { name: "Exportar carreira", exact: true }).waitFor();
  await b.page.getByRole("button", { name: "Exportar carreira", exact: true }).waitFor();
  await b.page.setViewportSize({ width: 390, height: 844 });
  await b.page.getByRole("button", { name: "Exportar carreira", exact: true }).click();
  await capture(b.page, "export-mobile");
  assert.equal(
    await b.page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    false,
  );
  for (const route of ["/sobre", "/ligas-de-futebol", "/partida-rapida", "/perguntas-frequentes"]) {
    await a.page.goto(origin + route, { waitUntil: "domcontentloaded", timeout: 90000 });
    await a.page.getByRole("heading", { level: 1 }).first().waitFor();
    await capture(a.page, route.slice(1));
    const rendered = await a.page.locator("body").innerText();
    if (route !== "/perguntas-frequentes") {
      assert.match(rendered, /300/);
      assert.match(rendered, /4\.601/);
      assert.doesNotMatch(rendered, /4\.548|4\.642 clubes/);
    } else {
      assert.match(rendered, /Exportar carreira/);
      assert.match(rendered, /Perfil/);
    }
    if (route === "/partida-rapida")
      assert.ok((await a.page.locator("#quick-league option").count()) >= 300);
  }
  await b.page.setViewportSize({ width: 1440, height: 1000 });
  await b.page.goto(origin + "/editor", { waitUntil: "domcontentloaded" });
  await b.page.getByRole("tab", { name: "Importar/Exportar", exact: true }).click();
  await b.page
    .getByRole("button", { name: "Exportar personalizações do editor", exact: true })
    .waitFor();
  const editorDownloadPromise = b.page.waitForEvent("download");
  await b.page
    .getByRole("button", { name: "Exportar personalizações do editor", exact: true })
    .click();
  const editorDownload = await editorDownloadPromise;
  const editorPath = path.join(out, editorDownload.suggestedFilename());
  await editorDownload.saveAs(editorPath);
  const customizations = JSON.parse(await fs.readFile(editorPath, "utf8"));
  assert.equal(customizations.career, undefined);
  assert.equal(customizations.finances, undefined);
  await b.page.getByLabel("Escolher pacote do editor para revisar").setInputFiles(downloadedPath);
  await b.page
    .getByRole("alert")
    .filter({ hasText: /carreira/i })
    .waitFor();
  await capture(b.page, "editor-rejects-career");
  await restoredState(b.page);
  await b.page.goto(origin + "/perfil", { waitUntil: "domcontentloaded" });
  await b.page
    .getByLabel("Selecionar arquivo JSON de carreira de treinador")
    .setInputFiles(editorPath);
  await b.page.getByText("Este arquivo não é uma carreira compatível.", { exact: true }).waitFor();
  await capture(b.page, "career-rejects-editor");
  await restoredState(b.page);
  report.checks.push({
    name: "editor and career exports are distinct and wrong-file imports preserve the career",
    passed: true,
  });
  const creation = await profile();
  await creation.page.goto(origin + "/new", { waitUntil: "domcontentloaded" });
  await creation.page.getByRole("heading", { name: "Novo treinador", exact: true }).waitFor();
  await creation.page.getByRole("button", { name: "Usar retrato", exact: true }).click();
  for (let step = 0; step < 2; step++)
    await creation.page.getByRole("button", { name: "Continuar", exact: true }).click();
  await creation.page.getByRole("button", { name: "Escolher meu clube", exact: true }).click();
  await creation.page
    .getByText(/ligas e divisões compatíveis com carreira neste aparelho/)
    .waitFor();
  const creationText = await creation.page.locator("body").innerText();
  assert.match(creationText, /incluindo importações/);
  assert.match(creationText, /catálogo incluído tem 300 competições e 4\.601 clubes únicos/);
  assert.equal(
    await creation.page.evaluate(() => localStorage.getItem("manager3d.career.v1")),
    null,
  );
  await capture(creation.page, "new-career-catalog-scope");
  report.checks.push({
    name: "new-career counts distinguish compatible device leagues from included catalog",
    passed: true,
  });
  const futureContext = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: "pt-BR",
  });
  contexts.push(futureContext);
  await futureContext.addInitScript(
    (state) => {
      if (!localStorage.getItem("qa.future.seeded")) {
        localStorage.setItem("manager3d.career.v1", JSON.stringify(state));
        localStorage.setItem("qa.future.seeded", "yes");
      }
    },
    { ...downloaded.career, version: 4 },
  );
  const futurePage = await futureContext.newPage();
  await futurePage.goto(origin + "/squad", { waitUntil: "domcontentloaded", timeout: 90000 });
  await dismissOptionalConsent(futurePage);
  await futurePage.getByRole("heading", { name: "Carreira preservada para recuperação" }).waitFor();
  assert.equal(
    await futurePage.evaluate(
      () => JSON.parse(localStorage.getItem("manager3d.career.v1")).version,
    ),
    4,
  );
  await capture(futurePage, "unsupported-save-preserved");
  assert.match(
    await futurePage.locator("body").innerText(),
    /Carreira preservada para recuperação/,
  );
  assert.doesNotMatch(await futurePage.locator("body").innerText(), /Carregando sua carreira/);
  await futurePage.goto(origin + "/perfil", { waitUntil: "domcontentloaded" });
  await futurePage.getByRole("heading", { name: "Carreira requer recuperação" }).waitFor();
  assert.equal(
    await futurePage.getByRole("link", { name: "Criar treinador", exact: true }).count(),
    0,
  );
  await futurePage.goto(origin + "/new", { waitUntil: "domcontentloaded" });
  await futurePage
    .getByRole("heading", { name: "Recupere a carreira antes de criar outra" })
    .waitFor();
  assert.equal(
    await futurePage.evaluate(
      () => JSON.parse(localStorage.getItem("manager3d.career.v1")).version,
    ),
    4,
  );
  await capture(futurePage, "unsupported-save-creation-blocked");
  assert.match(
    await futurePage.locator("body").innerText(),
    /Recupere a carreira antes de criar outra/,
  );
  report.checks.push({
    name: "unsupported future version produces recovery UI and is never downgraded",
    passed: true,
  });
  report.complete = true;
} catch (error) {
  report.complete = false;
  report.failure = error.stack;
  for (const context of contexts)
    for (const page of context.pages())
      try {
        await capture(page, "failure-" + contexts.indexOf(context));
      } catch {}
  process.exitCode = 1;
} finally {
  report.finishedAt = new Date().toISOString();
  await fs.writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify(
      {
        complete: report.complete,
        checks: report.checks,
        errors: report.errors,
        failure: report.failure,
        report: path.join(out, "report.json"),
      },
      null,
      2,
    ),
  );
  await browser.close();
}
