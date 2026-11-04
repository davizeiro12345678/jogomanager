import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const origin = process.env.CSS_QA_ORIGIN || "http://127.0.0.1:4173";
const output = process.argv[2] || "verification/css-browser-pr123";
const targets = [
  { path: "/", public: true },
  { path: "/guias", public: true },
  { path: "/melhores-formacoes", public: true },
  { path: "/termos", public: true },
  { path: "/partida-rapida", public: true },
  { path: "/new", public: false },
];
mkdirSync(output, { recursive: true });
const results = [];

async function inspect(page, path, isPublic, mode) {
  const errors = [];
  const cssFailures = [];
  const onError = (error) => errors.push(error.message);
  const onResponse = (response) => {
    if (
      response.url().startsWith(origin) &&
      /\.css(?:\?|$)/.test(response.url()) &&
      response.status() >= 400
    )
      cssFailures.push({
        status: response.status(),
        url: new URL(response.url()).pathname,
      });
  };
  page.on("pageerror", onError);
  page.on("response", onResponse);
  const response = await page.goto(origin + path, {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  assert.equal(response?.status(), 200, mode + " " + path + ": SSR response must be 200");
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll('head link[rel="stylesheet"]')].some((link) => !!link.sheet),
    undefined,
    { timeout: 15000 },
  );
  await page.waitForTimeout(1000);
  await page.waitForFunction(
    () => {
      const links = [...document.querySelectorAll('head link[rel="stylesheet"]')];
      return links.length > 0 && links.every((link) => !!link.sheet);
    },
    undefined,
    { timeout: 20000 },
  );
  const state = await page.evaluate(() => {
    const html = document.documentElement;
    const sheets = [...document.querySelectorAll('head link[rel="stylesheet"]')].map((link) => ({
      path: new URL(link.href).pathname,
      ready: !!link.sheet,
    }));
    return {
      sheets,
      overflow: html.scrollWidth - innerWidth,
      background: getComputedStyle(document.body).backgroundColor,
      heading: document.querySelector("h1")?.textContent?.trim().slice(0, 100) || null,
    };
  });
  assert.ok(
    state.sheets.every((link) => link.ready),
    mode + " " + path + ": stylesheet was not loaded",
  );
  assert.ok(
    state.sheets.some((link) => (isPublic ? /public-styles-/ : /\/styles-/).test(link.path)),
    mode + " " + path + ": incorrect SSR stylesheet family",
  );
  assert.ok(state.overflow <= 5, mode + " " + path + ": horizontal overflow");
  assert.equal(cssFailures.length, 0, mode + " " + path + ": CSS HTTP failures");
  assert.equal(errors.length, 0, mode + " " + path + ": browser script errors");
  if (path === "/" || path === "/new") {
    await page.screenshot({
      path: join(output, mode + "-" + (path === "/" ? "home" : "new") + ".png"),
      fullPage: false,
    });
  }
  results.push({ mode, path, status: 200, ...state, cssFailures, errors });
  page.off("pageerror", onError);
  page.off("response", onResponse);
}

async function verifySpa(page, mode) {
  await page.goto(origin + "/", { waitUntil: "domcontentloaded" });
  const link = page
    .locator('a[href="/new"]')
    .filter({ hasText: /começar a jogar/i })
    .first();
  await link.waitFor({ state: "visible", timeout: 15000 });
  await link.click();
  await page.waitForURL(origin + "/new", { timeout: 15000 });
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll('head link[rel="stylesheet"]')].some(
        (link) => /\/styles-/.test(new URL(link.href).pathname) && !!link.sheet,
      ),
    undefined,
    { timeout: 15000 },
  );
  await page.goBack({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll('head link[rel="stylesheet"]')].some(
        (link) => /public-styles-/.test(new URL(link.href).pathname) && !!link.sheet,
      ),
    undefined,
    { timeout: 15000 },
  );
  results.push({ mode, path: "SPA / → /new → /", status: 200, passed: true });
}

const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
    : {}),
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
try {
  for (const [mode, viewport] of [
    ["mobile", { width: 390, height: 844 }],
    ["desktop", { width: 1440, height: 900 }],
  ]) {
    const context = await browser.newContext({
      viewport,
      deviceScaleFactor: 1,
    });
    try {
      const page = await context.newPage();
      for (const target of targets) await inspect(page, target.path, target.public, mode);
      await verifySpa(page, mode);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
  writeFileSync(join(output, "css-browser-qa.json"), JSON.stringify(results, null, 2));
}
console.log("PASS: " + results.length + " CSS/SSR/browser assertions and SPA navigation scenarios");
