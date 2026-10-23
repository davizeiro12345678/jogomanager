import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("C:/Users/User/.codex/mcp-game-runtime/node_modules/playwright");
const out = path.resolve("verification/realism-data-20261022/after/report");
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath:
    "C:/Users/User/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe",
});
const errors = [];
const checks = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://127.0.0.1:4265/report.html", { waitUntil: "networkidle" });
  const rows = await page.locator("#metrics-body tr").count();
  if (rows !== 90) throw new Error(`Expected 90 metric rows, got ${rows}`);
  checks.push({ name: "all metrics", rows });
  await page.screenshot({ path: path.join(out, "overview.png") });
  await page.locator(".gallery").screenshot({ path: path.join(out, "stadium-comparison.png") });
  await page.selectOption("#shot", "player-face");
  await page.waitForFunction(() =>
    [...document.querySelectorAll(".gallery img")].every(
      (image) => image.complete && image.naturalWidth > 0 && image.src.endsWith("/player-face.png"),
    ),
  );
  await page.locator(".gallery").screenshot({ path: path.join(out, "player-comparison.png") });
  checks.push({ name: "gallery selection", loadedImages: 3 });
  await page.locator("#wipe").fill("75");
  const wipe = await page.locator("#compare-after").evaluate((node) => node.style.clipPath);
  if (!/^inset\((?:0|0px) 25% (?:0|0px) (?:0|0px)\)$/.test(wipe))
    throw new Error("Comparison wipe did not respond: " + wipe);
  checks.push({ name: "comparison wipe", clipPath: wipe });
  await page.selectOption("#group", "Narração");
  const filtered = await page.locator("#metrics-body tr").count();
  if (filtered !== 4) throw new Error("Area filter did not narrow narration metrics");
  await page.locator("#search").fill("Falas únicas · pt");
  if ((await page.locator("#metrics-body tr").count()) !== 1)
    throw new Error("Metric search did not narrow the table");
  checks.push({ name: "area and text filters", filtered, searched: 1 });
  await page.locator(".image-button").first().click();
  if (!(await page.locator("#image-dialog").evaluate((node) => node.open)))
    throw new Error("Original image dialog did not open");
  await page.locator("#close-dialog").click();
  checks.push({ name: "original image dialog", opened: true, closed: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => scrollTo(0, 0));
  const width = await page.evaluate(() => ({
    viewport: innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  if (width.document > width.viewport)
    throw new Error("Report exceeds mobile width: " + JSON.stringify(width));
  await page.screenshot({ path: path.join(out, "mobile.png") });
  checks.push({ name: "mobile report", ...width });
} catch (error) {
  errors.push(error.stack);
} finally {
  await browser.close();
  fs.writeFileSync(path.join(out, "checks.json"), JSON.stringify({ checks, errors }, null, 2));
}
console.log(JSON.stringify({ checks, errors }));
if (errors.length) process.exitCode = 1;
