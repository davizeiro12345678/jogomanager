import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const runtime = process.env.QA_RUNTIME_MODULES;
if (!runtime) throw new Error("Set QA_RUNTIME_MODULES");
const { chromium } = createRequire(path.join(runtime, "package.json"))("playwright");
const origin = process.argv[2] || "http://127.0.0.1:4222";
const out = path.resolve("output/playwright/product-integrity-20261020/quota");
const tag = process.argv[3] || "final";
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
const report = { tag, checks: [], errors: [] };
let page;
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    locale: "pt-BR",
    acceptDownloads: true,
  });
  page = await context.newPage();
  page.on("pageerror", (error) => report.errors.push(error.message));
  await page.goto(origin + "/perfil", { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.getByRole("heading", { name: "Perfil vazio", exact: true }).waitFor();
  const consent = page.getByRole("button", { name: "Só o essencial", exact: true });
  await consent.waitFor({ timeout: 3000 }).catch(() => undefined);
  if (await consent.isVisible()) await consent.click();
  await page
    .getByLabel("Selecionar arquivo JSON de carreira de treinador")
    .setInputFiles(
      path.resolve("verification/product-integrity-20261020/backup-fixture.pfm3d.json"),
    );
  await page
    .getByRole("button", { name: "Confirmar restauração da carreira", exact: true })
    .click();
  await page.getByRole("button", { name: "Exportar carreira", exact: true }).waitFor();
  await page.goto(origin + "/training", { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.getByRole("heading", { name: "Treino da semana", exact: true }).waitFor();
  const durable = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("manager3d.career.v1")),
  );
  assert.notEqual(durable.training, "fisico");
  await page.evaluate(() => {
    const set = Storage.prototype.setItem;
    const put = IDBObjectStore.prototype.put;
    window.qaBlockedWrites = { local: 0, idb: 0 };
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith("manager3d.career") || key.startsWith("career.")) {
        window.qaBlockedWrites.local++;
        throw new DOMException("Synthetic QA quota", "QuotaExceededError");
      }
      return set.call(this, key, value);
    };
    IDBObjectStore.prototype.put = function () {
      window.qaBlockedWrites.idb++;
      throw new DOMException("Synthetic QA quota", "QuotaExceededError");
    };
    window.qaRestoreWrites = () => {
      Storage.prototype.setItem = set;
      IDBObjectStore.prototype.put = put;
    };
  });
  await page.getByRole("button", { name: /^Físico/ }).click();
  await page.waitForFunction(
    () => window.qaBlockedWrites.idb > 0 && window.qaBlockedWrites.local > 0,
  );
  const blocked = await page.evaluate(() => window.qaBlockedWrites);
  assert.equal(
    await page.evaluate(() => JSON.parse(localStorage.getItem("manager3d.career.v1")).training),
    durable.training,
  );
  assert.equal(
    await page.getByRole("button", { name: /^Físico/ }).getAttribute("aria-pressed"),
    "true",
  );
  report.checks.push({
    name: "synthetic writes rejected in both backends while the current UI retains the new choice",
    blocked,
    passed: true,
  });
  const warning = page.getByRole("alert", { name: "Falha ao salvar carreira" });
  await warning.waitFor({ timeout: 10000 });
  assert.match(await warning.innerText(), /apenas nesta sessão/i);
  assert.ok(blocked.idb > 0 && blocked.local > 0);
  assert.equal(
    await page.evaluate(() => JSON.parse(localStorage.getItem("manager3d.career.v1")).training),
    durable.training,
  );
  await page.screenshot({ path: path.join(out, tag + "-unsaved.png"), fullPage: true });
  await context.setOffline(true);
  await page.waitForFunction(() => !navigator.onLine);
  await warning.waitFor();
  await page.getByRole("button", { name: "Preferências e conta", exact: true }).click();
  await page.locator('[data-career-sync="unsaved"]').waitFor();
  assert.equal(await page.getByText(/Offline.*salvo no aparelho/).count(), 0);
  await page.getByRole("dialog").getByRole("button", { name: "Fechar", exact: true }).click();
  await context.setOffline(false);
  await warning.getByRole("link").click();
  await page.getByRole("button", { name: "Exportar carreira", exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Baixar carreira validada", exact: true }).click();
  const download = await downloadPromise;
  const filename = path.join(out, tag + "-memory-career.pfm3d.json");
  await download.saveAs(filename);
  const exported = JSON.parse(await fs.readFile(filename, "utf8"));
  assert.equal(exported.career.training, "fisico");
  for (const key of ["players", "lineup", "bench", "finances", "fixtures", "results", "history"])
    assert.deepEqual(exported.career[key], durable[key]);
  report.checks.push({
    name: "both storage writes rejected; unsaved state survives profile navigation and real download",
    blocked,
    passed: true,
  });
  await page.evaluate(() => window.qaRestoreWrites());
  await page.getByRole("link", { name: "Treino", exact: true }).first().click();
  await page.getByRole("button", { name: /^Técnica/ }).click();
  await page.waitForFunction(
    () => JSON.parse(localStorage.getItem("manager3d.career.v1") || "null")?.training === "tecnica",
  );
  await warning.waitFor({ state: "hidden" });
  report.checks.push({
    name: "a later verified save clears the failure and persists the latest state",
    passed: true,
  });
  report.complete = true;
} catch (error) {
  report.complete = false;
  report.failure = error.stack;
  if (page) {
    await page
      .screenshot({ path: path.join(out, tag + "-failure.png"), fullPage: true })
      .catch(() => undefined);
    await fs.writeFile(
      path.join(out, tag + "-failure.txt"),
      await page.locator("body").innerText(),
    );
  }
  process.exitCode = 1;
} finally {
  await fs.writeFile(path.join(out, tag + "-report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}
