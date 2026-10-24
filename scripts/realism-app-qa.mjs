import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("C:/Users/User/.codex/mcp-game-runtime/node_modules/playwright");
const out = path.resolve("verification/realism-data-20261022/after/app");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath:
    "C:/Users/User/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe",
  args: [
    "--use-angle=d3d11",
    "--enable-gpu",
    "--ignore-gpu-blocklist",
    "--disable-software-rasterizer",
  ],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
const failures = [];
const checks = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("response", (response) => {
  if (response.status() >= 400)
    failures.push({ url: response.url().split("?")[0], status: response.status() });
});
await page.route("**/__l5e/assets-v1/**", (route) =>
  route.fulfill({ status: 404, body: "controlled fallback" }),
);
try {
  await page.goto("http://127.0.0.1:4266/club", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2500);
  const essential = page.getByRole("button", { name: "Só o essencial", exact: true });
  if (await essential.count()) await essential.click();
  await page.screenshot({ path: path.join(out, "club-without-career.png"), fullPage: true });
  await writeFile(path.join(out, "empty-career-dom.txt"), await page.locator("body").innerText());
  await page.evaluate(async () => {
    const { initCareer } = await import("/src/game/career.ts");
    const { saveLocalCareer } = await import("/src/lib/offline/store.ts");
    const career = initCareer("bra", "fla", "Verificação local");
    await saveLocalCareer(career, "QA isolated guest", null);
    localStorage.setItem("manager3d.ceremony", "off");
    localStorage.setItem("manager3d.prematchIntro", "off");
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(7000);
  for (const route of ["club", "squad", "tactics", "transfers"]) {
    const link = page.locator(`a[href="/${route}"]`).first();
    if (await link.count()) {
      await link.hover();
      await page.waitForTimeout(200);
      await link.click();
    } else await page.goto(`http://127.0.0.1:4266/${route}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(route === "club" ? 7000 : 2500);
    await page.screenshot({ path: path.join(out, `${route}-desktop.png`), fullPage: true });
    const text = await page.locator("body").innerText();
    await writeFile(path.join(out, `${route}-dom.txt`), text);
    checks.push({
      route,
      url: page.url(),
      bodyLength: text.length,
      buttons: await page.getByRole("button").allTextContents(),
      images: await page.locator("img").evaluateAll((images) =>
        images.map((image) => ({
          alt: image.alt,
          src: image.src,
          loaded: image.complete && image.naturalWidth > 0,
        })),
      ),
      officialProfile: text.includes("Identidade e partidas oficiais"),
      players: text.includes("Atletas na base oficial"),
    });
    if (route === "club") {
      checks.push({
        route: "official-venue",
        present: text.includes("Maracanã"),
        capacity: text.includes("78.838"),
      });
      if (!text.includes("Maracanã"))
        throw new Error("Official venue projection did not reach the club page");
    }
    if (route === "tactics") {
      await page.getByRole("button", { name: "4-4-2", exact: true }).click();
      await page.waitForTimeout(700);
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1500);
      const persisted = await page
        .getByRole("button", { name: "4-4-2", exact: true })
        .getAttribute("aria-pressed");
      if (persisted !== "true") throw new Error("Formation did not survive a reload");
      checks.push({ route: "tactics-persistence", selected: "4-4-2", persisted: true });
      await page.screenshot({ path: path.join(out, "tactics-persisted.png"), fullPage: true });
    }
  }
  await page.goto("http://127.0.0.1:4266/match", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(8000);
  await page.screenshot({ path: path.join(out, "match-desktop.png"), fullPage: true });
  await writeFile(path.join(out, "match-dom.txt"), await page.locator("body").innerText());
  checks.push({
    route: "match",
    canvas: await page.locator("canvas").count(),
    buttons: await page.getByRole("button").allTextContents(),
  });
  const beforeCamera = await page.getByRole("button").allTextContents();
  await page.keyboard.press("c");
  await page.waitForTimeout(1500);
  const afterCamera = await page.getByRole("button").allTextContents();
  checks.push({
    route: "match-camera",
    before: beforeCamera,
    after: afterCamera,
    changed: JSON.stringify(beforeCamera) !== JSON.stringify(afterCamera),
  });
  await page.screenshot({ path: path.join(out, "match-camera-changed.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://127.0.0.1:4266/club", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4500);
  await page.screenshot({ path: path.join(out, "club-mobile.png"), fullPage: true });
  checks.push({
    route: "club-mobile",
    overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
  });
  if (checks.at(-1).overflow) throw new Error("Club content exceeds the mobile viewport");
  if (!checks.find((check) => check.route === "match-camera")?.changed)
    throw new Error("The match camera did not change");
} catch (error) {
  errors.push(error.stack);
  await page.screenshot({ path: path.join(out, "qa-error.png"), fullPage: true });
} finally {
  await writeFile(
    path.join(out, "checks.json"),
    JSON.stringify(
      {
        scope:
          "local Vite development UI; isolated guest career; not production load-time evidence",
        checks,
        errors,
        failures,
      },
      null,
      2,
    ),
  );
  await browser.close();
}
console.log(JSON.stringify({ checks: checks.length, errors, failures: failures.length }));
if (errors.length || failures.some((failure) => !failure.url.includes("/__l5e/assets-v1/")))
  process.exitCode = 1;
