import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createServer } from "node:net";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const root = path.resolve(import.meta.dirname, "..");
const { chromium } = await import(
  process.env.PFM_PLAYWRIGHT_MODULE ??
    pathToFileURL(path.join(root, ".cache/quick-browser/node_modules/playwright/index.mjs")).href
);
const output = path.resolve(process.argv[2] ?? "verification/quick-catalogue");
await mkdir(output, { recursive: true });
const report = {
  passed: false,
  scope:
    "Real built application, SSR hydration, deferred catalogue and selection lifecycle. Functional evidence; no GPU/FPS or first-input latency claim.",
  builds: [],
  cases: [],
  errors: [],
  expectedFailures: [],
};
const builds = process.env.PFM_QUICK_BASELINE
    ? [process.env.PFM_QUICK_BASELINE, ".output"]
    : [".output"],
  services = [],
  releases = [];
const catalogue = /\/leagues-[^/]+\.js(?:\?|$)/;
let browser, currentPage;
const teams = () =>
  [...document.querySelectorAll("section > h2 + div > span.font-display")].map(
    (e) => e.textContent,
  );
async function freePort(port) {
  await new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(port, "127.0.0.1", () => probe.close(resolve));
  });
}
async function stopService(service) {
  if (service.exitCode !== null || service.signalCode !== null) return;
  if (process.platform === "win32") {
    // Wrangler starts a Node/workerd tree. Target only the PID this harness
    // created; never terminate an unknown process discovered by its port.
    await new Promise((resolve, reject) => {
      const stop = spawn("taskkill.exe", ["/PID", String(service.pid), "/T", "/F"], {
        windowsHide: true,
        stdio: "ignore",
      });
      stop.once("error", reject);
      stop.once("exit", resolve);
    });
  } else {
    process.kill(-service.pid, "SIGTERM");
  }
}
async function bound(page, selector, event = "onClick") {
  await page.waitForFunction(
    ({ selector, event }) =>
      [...document.querySelectorAll(selector)].some((e) =>
        Object.keys(e).some(
          (k) => k.startsWith("__reactProps$") && typeof e[k]?.[event] === "function",
        ),
      ),
    { selector, event },
  );
}
async function settled(page) {
  await page.waitForFunction(
    () =>
      document.querySelector("#quick-league")?.getAttribute("aria-busy") !== "true" &&
      !document.querySelector('[role="alert"]'),
  );
}
async function newPage(base, width = 390, options = {}) {
  const context = await browser.newContext({
      viewport: { width, height: 844 },
      deviceScaleFactor: 1,
      locale: "pt-BR",
    }),
    page = await context.newPage();
  let expectedOffline = false;
  currentPage = page;
  const requests = [];
  page.on("request", (r) => requests.push(r.url()));
  page.on("pageerror", (e) => report.errors.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 400) report.errors.push(r.status() + " " + r.url());
  });
  page.on("requestfailed", (r) => {
    const failure = { url: r.url(), error: r.failure()?.errorText };
    const expected =
      (options.expectedCatalogueFailure && catalogue.test(r.url())) ||
      (expectedOffline &&
        new URL(r.url()).pathname.startsWith("/_serverFn/") &&
        failure.error === "net::ERR_INTERNET_DISCONNECTED");
    (expected ? report.expectedFailures : report.errors).push(failure);
  });
  if (options.route) await page.route(catalogue, options.route);
  const response = await page.goto(base + "/partida-rapida", { waitUntil: "networkidle" });
  const html = await response.text();
  await bound(page, "#quick-league", "onChange");
  const essential = page.getByRole("button", { name: "Só o essencial", exact: true });
  if (await essential.isVisible()) {
    await bound(page, "button");
    await essential.click();
    await page
      .getByRole("dialog", { name: "Privacidade", exact: true })
      .waitFor({ state: "hidden" });
  }
  await page.getByRole("heading", { name: "Partida rápida", exact: true }).waitFor();
  return {
    context,
    page,
    requests,
    htmlBytes: Buffer.byteLength(html),
    goOffline: async () => {
      expectedOffline = true;
      await context.setOffline(true);
    },
  };
}
function heldRoute() {
  let release;
  const hold = new Promise((resolve) => (release = resolve));
  releases.push(release);
  return {
    release,
    route: async (r) => {
      await hold;
      await r.continue();
    },
  };
}
try {
  browser = await chromium.launch({
    ...(process.env.PFM_BROWSER_CHANNEL ? { channel: process.env.PFM_BROWSER_CHANNEL } : {}),
    headless: true,
    args: process.platform === "win32" ? ["--use-angle=d3d11"] : [],
  });
  for (let index = 0; index < builds.length; index++) {
    const candidate = index === builds.length - 1;
    const build = builds[index],
      assets = path.join(root, build, "public/assets"),
      hash = createHash("sha256");
    for (const name of (await readdir(assets)).sort()) {
      hash.update(name);
      hash.update(await readFile(path.join(assets, name)));
    }
    await freePort(4514 + index);
    await freePort(9314 + index);
    const base = "http://127.0.0.1:" + (4514 + index),
      service = spawn(
        process.execPath,
        [
          "node_modules/wrangler/bin/wrangler.js",
          "dev",
          "--config",
          build + "/server/wrangler.json",
          "--local",
          "--ip",
          "127.0.0.1",
          "--port",
          String(4514 + index),
          "--inspector-port",
          String(9314 + index),
          "--persist-to",
          ".cache/quick-catalogue-" + index,
        ],
        {
          cwd: root,
          windowsHide: true,
          detached: process.platform !== "win32",
          stdio: "pipe",
          env: {
            ...process.env,
            WRANGLER_SEND_METRICS: "false",
            WRANGLER_LOG_PATH: path.join(output, "wrangler-" + index + ".log"),
          },
        },
      );
    services.push(service);
    let log = "",
      ready = false;
    for (const stream of [service.stdout, service.stderr])
      stream.on("data", (data) => (log += data));
    for (let attempt = 0; attempt < 100; attempt++) {
      try {
        if ((await fetch(base + "/partida-rapida", { signal: AbortSignal.timeout(2000) })).ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    assert(ready, log);
    report.builds.push({ build, assetsSha256: hash.digest("hex") });
    for (const width of [390, 768, 1280]) {
      report.stage = { index, width, step: "hydration" };
      const { context, page, requests, htmlBytes } = await newPage(base, width);
      const initialTeams = await page.evaluate(teams);
      assert.equal(initialTeams.length, 2);
      const catalogueRequests = requests.filter((url) => catalogue.test(url));
      assert.equal(catalogueRequests.length, candidate ? 0 : 1);
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false,
      );
      const clubs = await page.locator("section button").count();
      assert(clubs >= 4);
      await page.screenshot({
        path: path.join(output, (candidate ? "candidate" : "baseline") + "-" + width + ".png"),
      });
      report.cases.push({
        index,
        width,
        step: "hydration",
        initialTeams,
        clubs,
        htmlBytes,
        catalogueRequests,
      });
      await context.close();
    }
    if (!candidate) continue;
    {
      report.stage = { step: "latest-selection-and-offline-cache" };
      const hold = heldRoute(),
        { context, page, requests, goOffline } = await newPage(base, 390, { route: hold.route });
      const before = await page.evaluate(teams),
        select = page.locator("#quick-league"),
        choices = await select.evaluate((e) => [...e.options].map((o) => o.value));
      const initial = await select.inputValue(),
        alternatives = choices.filter((id) => id !== initial);
      await select.selectOption(alternatives[0]);
      await select.selectOption(alternatives[1]);
      assert.equal(await select.getAttribute("aria-busy"), "true");
      assert(await page.getByRole("button", { name: "Jogar", exact: true }).isDisabled());
      assert.deepEqual(await page.evaluate(teams), before);
      hold.release();
      await settled(page);
      assert.equal(await select.inputValue(), alternatives[1]);
      const expected = await page.evaluate(async (id) => {
        const resource = performance
          .getEntriesByType("resource")
          .find((e) => /\/leagues-[^/]+\.js$/.test(e.name));
        const module = await import(resource.name);
        const leagues = Object.values(module).find((v) => Array.isArray(v) && v[0]?.clubs);
        return leagues
          .find((l) => l.id === id)
          .clubs.slice(0, 2)
          .map((c) => c.name);
      }, alternatives[1]);
      assert.deepEqual(await page.evaluate(teams), expected);
      const sections = page.locator("section"),
        home = sections.nth(0),
        away = sections.nth(1);
      await home.locator("button:not([disabled])").last().click();
      const picked = await page.evaluate(teams);
      assert(
        await away.evaluate(
          (element, name) =>
            [...element.querySelectorAll("button")].some(
              (button) =>
                [...button.childNodes].some(
                  (node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim() === name,
                ) && button.disabled,
            ),
          picked[0],
        ),
      );
      await page.getByRole("button", { name: "Difícil", exact: true }).click();
      assert.equal(
        await page
          .getByRole("button", { name: "Difícil", exact: true })
          .getAttribute("aria-pressed"),
        "true",
      );
      await goOffline();
      await select.selectOption(alternatives[2]);
      await settled(page);
      assert.equal(await select.inputValue(), alternatives[2]);
      await page.getByRole("button", { name: "Sortear confronto", exact: true }).click();
      await settled(page);
      const randomized = await page.evaluate(teams);
      assert.notEqual(randomized[0], randomized[1]);
      assert.equal(requests.filter((url) => catalogue.test(url)).length, 1);
      report.cases.push({
        step: report.stage.step,
        expected,
        picked,
        randomized,
        oneCatalogueRequest: true,
      });
      await context.close();
    }
    {
      report.stage = { step: "cancel-pending-selection" };
      const hold = heldRoute(),
        { context, page } = await newPage(base, 390, { route: hold.route }),
        select = page.locator("#quick-league"),
        initial = await select.inputValue(),
        before = await page.evaluate(teams);
      const alternative = await select.evaluate(
        (e, id) => [...e.options].find((o) => o.value !== id).value,
        initial,
      );
      await select.selectOption(alternative);
      await select.selectOption(initial);
      assert.equal(await select.getAttribute("aria-busy"), "false");
      assert(await page.getByRole("button", { name: "Jogar", exact: true }).isEnabled());
      hold.release();
      await page.waitForLoadState("networkidle");
      assert.equal(await select.inputValue(), initial);
      assert.deepEqual(await page.evaluate(teams), before);
      report.cases.push({ step: report.stage.step, initial, before });
      await context.close();
    }
    {
      report.stage = { step: "failure-retry-and-reload" };
      let attempts = 0;
      const { context, page } = await newPage(base, 390, {
          expectedCatalogueFailure: true,
          route: (r) => {
            attempts++;
            return r.abort("failed");
          },
        }),
        select = page.locator("#quick-league"),
        initial = await select.inputValue(),
        before = await page.evaluate(teams);
      const alternative = await select.evaluate(
        (e, id) => [...e.options].find((o) => o.value !== id).value,
        initial,
      );
      await select.selectOption(alternative);
      await page.getByRole("alert").waitFor();
      assert(await page.getByRole("button", { name: "Jogar", exact: true }).isDisabled());
      assert.deepEqual(await page.evaluate(teams), before);
      await page.getByRole("button", { name: "Tentar novamente", exact: true }).click();
      await page.getByRole("alert").waitFor();
      assert.deepEqual(await page.evaluate(teams), before);
      await page.unroute(catalogue);
      await page.getByRole("button", { name: "Atualizar página", exact: true }).click();
      await page.waitForLoadState("networkidle");
      await bound(page, "#quick-league", "onChange");
      await page.locator("#quick-league").selectOption(alternative);
      await settled(page);
      assert.equal(await page.locator("#quick-league").inputValue(), alternative);
      report.cases.push({ step: report.stage.step, attempts, reloaded: true });
      await context.close();
    }
    {
      report.stage = { step: "unmount-during-load" };
      const hold = heldRoute(),
        { context, page } = await newPage(base, 390, { route: hold.route }),
        select = page.locator("#quick-league"),
        initial = await select.inputValue();
      const alternative = await select.evaluate(
        (e, id) => [...e.options].find((o) => o.value !== id).value,
        initial,
      );
      await select.selectOption(alternative);
      await page.locator('a[href="/"]').last().click();
      await page.waitForURL(base + "/");
      hold.release();
      await page.waitForLoadState("networkidle");
      await page.locator("#quick-league").waitFor({ state: "detached" });
      assert.equal(await page.locator("#quick-league").count(), 0);
      report.cases.push({ step: report.stage.step });
      await context.close();
    }
  }
  assert.equal(report.errors.length, 0, JSON.stringify(report.errors));
  assert.equal(report.cases.length, builds.length * 3 + 4);
  report.passed = true;
} catch (error) {
  report.failure = {
    name: error.name,
    message: error.message,
    stack: error.stack,
    stage: report.stage,
  };
  try {
    if (currentPage && !currentPage.isClosed()) {
      report.failure.text = (await currentPage.locator("body").innerText()).slice(0, 2500);
      await currentPage.screenshot({ path: path.join(output, "failure.png"), timeout: 5000 });
    }
  } catch {}
  throw error;
} finally {
  for (const release of releases) release();
  await browser?.close();
  await Promise.all(services.map(stopService));
  await Promise.all(
    services.map((service) =>
      service.exitCode !== null || service.signalCode !== null
        ? Promise.resolve()
        : new Promise((resolve) => {
            const timeout = setTimeout(resolve, 5000);
            service.once("exit", () => {
              clearTimeout(timeout);
              resolve();
            });
          }),
    ),
  );
  report.cleanup = {
    browserClosed: !browser?.isConnected(),
    services: services.map((service) => ({
      pid: service.pid,
      killed: service.killed,
      exitCode: service.exitCode,
      signalCode: service.signalCode,
    })),
  };
  report.cleanup.ports = await Promise.all(
    services.flatMap((_service, index) =>
      [4514 + index, 9314 + index].map(async (port) => {
        try {
          await freePort(port);
          return { port, available: true };
        } catch {
          return { port, available: false };
        }
      }),
    ),
  );
  if (report.cleanup.ports.some((port) => !port.available)) {
    report.passed = false;
    report.cleanup.failure = "A harness port remains occupied after shutdown";
    process.exitCode = 1;
  }
  await writeFile(path.join(output, "receipt.json"), JSON.stringify(report, null, 2));
}
console.log(
  JSON.stringify({
    passed: report.passed,
    cases: report.cases.length,
    errors: report.errors.length,
  }),
);
