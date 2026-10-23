import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const runtime = process.env.QA_RUNTIME_MODULES;
if (!runtime) throw new Error("Set QA_RUNTIME_MODULES to the Playwright runtime");
const { chromium } = createRequire(path.join(runtime, "package.json"))("playwright");
const origin = process.argv[2] || "http://127.0.0.1:4222";
const output = path.resolve("output/playwright/product-integrity-20261020/store");
await fs.mkdir(output, { recursive: true });
const products = [
  ["coins_starter", "Moedas iniciais", 490, 200],
  ["coins_small", "Bolsa de moedas", 490, 500],
  ["coins_medium", "Cofre de moedas", 1290, 1500],
  ["coins_large", "Cofre de moedas", 5990, 4000],
].map(([key, name, price_cents, coins]) => ({
  key,
  name,
  description: "Descrição antiga com melhor bônus por real",
  price_cents,
  coins,
  currency: "brl",
  kind: "coins",
  sale_percent_off: 0,
  sale_starts_at: null,
  sale_ends_at: null,
}));
products.push({
  key: "theme_pack",
  name: "Tema visual",
  description: "Aparência sem benefício competitivo",
  price_cents: 990,
  coins: 0,
  currency: "brl",
  kind: "cosmetic",
  sale_percent_off: 0,
  sale_starts_at: null,
  sale_ends_at: null,
});
const browser = await chromium.launch({ channel: "msedge", headless: true });
const report = {
  origin,
  fixture:
    "Isolated public catalog response: reported 200/500 same price, 1500 best rate, 4000 worse rate; no live product mutation or payment",
  views: [],
  checks: [],
  errors: [],
};
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    locale: "pt-BR",
  });
  await context.route("**/rest/v1/store_products**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(products) }),
  );
  const page = await context.newPage();
  page.on("pageerror", (error) => report.errors.push(error.message));
  for (const surface of ["produtos", "loja"]) {
    await page.goto(origin + "/" + surface, { waitUntil: "domcontentloaded", timeout: 90000 });
    const selector = surface === "produtos" ? "#coins_medium" : "#store-product-coins_medium";
    await page.locator(selector).waitFor();
    const essential = page.getByRole("button", { name: "Só o essencial", exact: true });
    if (surface === "produtos") {
      await essential.waitFor({ state: "visible", timeout: 3000 }).catch(() => undefined);
      if (await essential.isVisible()) await essential.click();
    }
    const prefix = surface === "produtos" ? "#" : "#store-product-";
    const medium = page.locator(prefix + "coins_medium");
    const large = page.locator(prefix + "coins_large");
    const starter = page.locator(prefix + "coins_starter");
    assert.match(await medium.innerText(), /Melhor relação moedas\/preço/i);
    assert.doesNotMatch(
      await large.innerText(),
      /Melhor relação moedas\/preço|melhor bônus por real/i,
    );
    assert.match(await medium.innerText(), /116,28 moedas\/R\$/);
    assert.match(await large.innerText(), /66,78 moedas\/R\$/);
    assert.match(await starter.innerText(), /500 moedas por preço igual ou menor/);
    assert.equal(
      await starter.getByRole("button", { name: "Venda indisponível", exact: true }).isDisabled(),
      true,
    );
    assert.equal(
      await page
        .locator(prefix + "theme_pack")
        .getByRole("button", { name: "Venda indisponível", exact: true })
        .count(),
      0,
    );
    const text = await page.locator("body").innerText();
    await fs.writeFile(path.join(output, surface + ".txt"), text);
    await page.screenshot({ path: path.join(output, surface + ".png"), fullPage: true });
    report.views.push({ surface, text });
    report.checks.push({
      surface,
      winner: "coins_medium",
      starterDominatedBy: "coins_small",
      legacyPurchasesDisabled: true,
      cosmeticPolicyPreserved: true,
    });
    await starter.getByRole("link", { name: /^Bolsa de moedas$/i }).click();
    assert.equal(
      new URL(page.url()).hash,
      surface === "produtos" ? "#coins_small" : "#store-product-coins_small",
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(output, surface + "-mobile.png"), fullPage: true });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  report.complete = true;
} catch (error) {
  report.complete = false;
  report.failure = error.stack;
  process.exitCode = 1;
} finally {
  await fs.writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify(
      {
        complete: report.complete,
        checks: report.checks,
        errors: report.errors,
        failure: report.failure,
      },
      null,
      2,
    ),
  );
  await browser.close();
}
