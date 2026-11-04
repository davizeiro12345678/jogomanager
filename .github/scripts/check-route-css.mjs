import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { setTimeout as delay } from "node:timers/promises";
import assert from "node:assert/strict";

// The browser package is installed outside the application dependency tree,
// as in the existing Match 3D browser checks.
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const origin = "http://127.0.0.1:4173";
const server = spawn(
  process.execPath,
  [
    "node_modules/wrangler/bin/wrangler.js",
    "dev",
    "--config",
    ".output/server/wrangler.json",
    "--local",
    "--ip",
    "127.0.0.1",
    "--port",
    "4173",
  ],
  { stdio: "ignore", env: { ...process.env, WRANGLER_SEND_METRICS: "false" } },
);

try {
  let ready = false;
  for (let attempt = 0; attempt < 90; attempt++) {
    try {
      if ((await fetch(origin)).ok) {
        ready = true;
        break;
      }
    } catch {
      // The local Worker is still starting.
    }
    await delay(500);
  }
  assert.ok(ready, "The local Worker did not become ready");

  for (const [name, viewport] of [
    ["mobile", { width: 390, height: 844 }],
    ["desktop", { width: 1440, height: 900 }],
  ]) {
    const browser = await chromium.launch({
      headless: true,
      ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
        ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
        : {}),
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });
    try {
      const page = await browser.newPage({ viewport });
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.route("**/*", (route) =>
        route
          .request()
          .url()
          .startsWith(origin + "/")
          ? route.continue()
          : route.abort(),
      );
      const response = await page.goto(origin, { waitUntil: "domcontentloaded" });
      assert.equal(response.status(), 200);
      await page.waitForTimeout(3000); // allow deferred hydration before testing intent
      const initial = await page.evaluate(() => ({
        style: document.querySelector("#route-stylesheet")?.getAttribute("href"),
        prefetched: [...document.querySelectorAll('link[rel="prefetch"]')].some((link) =>
          /\/assets\/styles-[^/]+\.css/.test(link.getAttribute("href") || ""),
        ),
        navigation: getComputedStyle(document.querySelector(".home-nav")).display,
        heading: document.querySelector("h1")?.textContent,
      }));
      assert.match(initial.style, /home-styles/);
      assert.equal(initial.prefetched, false, "Game CSS was prefetched before intent");
      assert.equal(initial.navigation, "flex");
      assert.ok(initial.heading);

      const play = page.locator(".home-hero-actions a").first();
      await play.focus();
      await page.waitForFunction(() =>
        [...document.querySelectorAll('link[rel="prefetch"]')].some((link) =>
          /\/assets\/styles-[^/]+\.css/.test(link.getAttribute("href") || ""),
        ),
      );
      await play.click();
      await page.waitForURL("**/new");
      await page.waitForFunction(() =>
        /\/styles-[^/]+\.css/.test(
          document.querySelector("#route-stylesheet")?.getAttribute("href") || "",
        ),
      );
      assert.match(
        await page.locator("#route-stylesheet").getAttribute("href"),
        /\/styles-[^/]+\.css/,
      );
      assert.equal(await page.locator("#route-stylesheet").count(), 1);
      await page.goBack({ waitUntil: "domcontentloaded" });
      await page.waitForFunction(() =>
        (document.querySelector("#route-stylesheet")?.getAttribute("href") || "").includes(
          "home-styles",
        ),
      );
      assert.match(await page.locator("#route-stylesheet").getAttribute("href"), /home-styles/);
      assert.equal(await page.locator("#route-stylesheet").count(), 1);
      assert.deepEqual(errors, [], `${name}: unhandled browser errors`);
      console.log(`Verified ${name}: CSS intent, game navigation and return`);
    } finally {
      await browser.close();
    }
  }
} finally {
  server.kill("SIGTERM");
}
