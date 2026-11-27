/** Public, non-destructive visual QA. No account creation or messages are sent. */
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const [baseUrl, outputArg, label = "candidate", rootArg] = process.argv.slice(2);
if (!baseUrl || !outputArg) throw new Error("Usage: capture-upgrade-ui URL OUTPUT LABEL");
const target = new URL(baseUrl);
if (!["127.0.0.1", "localhost"].includes(target.hostname))
  throw new Error("This capture is restricted to the disposable local preview.");
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const output = path.resolve(outputArg);
await mkdir(output, { recursive: true });
const server = rootArg
  ? spawn(
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
        target.port,
      ],
      {
        cwd: path.resolve(rootArg),
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
      },
    )
  : null;
let serverLog = "";
if (server) {
  for (const stream of [server.stdout, server.stderr])
    stream.on("data", (value) => {
      serverLog = (serverLog + value.toString()).slice(-60000);
    });
}
let browser;
let context;
let page;
let ownedNavigation = false;
let closingContext = false;
const pending = [];
const fixture = process.env.PFM_UI_FIXTURE === "1";
const createGuest = process.env.PFM_UI_CREATE_GUEST === "1";
if (createGuest && !fixture) throw new Error("Guest creation requires the local fixture.");
const report = {
  label,
  baseUrl,
  browser: null,
  captures: [],
  errors: [],
  console: [],
  failedRequests: [],
  expectedCancellations: [],
  errorResponses: [],
  journeys: [],
  fixtureRequests: [],
  blockedExternalRequests: [],
  backend: fixture
    ? {
        kind: "local-fixture",
        host: "preview-data.jogomanager.invalid",
        session: "no persisted session; real guest branch",
        catalog: "empty remote catalog and official crest/kit maps; bundled clubs",
        serviceWorkers: "blocked to ensure all fixture requests remain intercepted",
        limitations: "No production auth, database or webhook validation",
      }
    : { kind: "configured-preview" },
  video: null,
  fpsCertification: false,
  method: "Playwright fallback; cloud browser has WebGL disabled",
};
async function navigate(url, options) {
  ownedNavigation = true;
  try {
    return await page.goto(url, options);
  } finally {
    ownedNavigation = false;
  }
}

try {
  if (server) {
    let ready = false;
    for (let attempt = 0; attempt < 90; attempt++) {
      if (server.exitCode !== null) throw new Error(`Preview exited: ${serverLog.slice(-3000)}`);
      try {
        if ((await fetch(baseUrl, { signal: AbortSignal.timeout(1000) })).ok) {
          ready = true;
          break;
        }
      } catch {
        /* disposable preview is still starting */
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    if (!ready) throw new Error(`Preview unavailable: ${serverLog.slice(-3000)}`);
  }
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  report.browser = browser.version();
  context = await browser.newContext({
    viewport: { width: 1363, height: 936 },
    locale: "pt-BR",
    deviceScaleFactor: 1,
    serviceWorkers: fixture ? "block" : "allow",
    recordVideo: { dir: path.join(output, "video"), size: { width: 1363, height: 936 } },
  });
  if (fixture)
    await context.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      const method = route.request().method();
      if (
        [target.hostname, "127.0.0.1", "localhost"].includes(url.hostname) &&
        url.pathname === "/api/public/football-assets" &&
        method === "GET"
      ) {
        report.fixtureRequests.push({
          url: url.href,
          method,
          fixture: "empty official asset maps; no server/database request",
        });
        return route.fulfill({ status: 200, json: { crests: {}, kits: {} } });
      }
      if (
        [target.hostname, "127.0.0.1", "localhost"].includes(url.hostname) ||
        !["http:", "https:"].includes(url.protocol)
      )
        return route.continue();
      if (url.hostname === "preview-data.jogomanager.invalid") {
        report.fixtureRequests.push({ url: url.href, method });
        if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
          report.errors.push({ kind: "unexpected-fixture-write", url: url.href, method });
          return route.abort("blockedbyclient");
        }
        if (url.pathname.startsWith("/rest/v1/"))
          return route.fulfill({
            status: 200,
            json: [],
            headers: { "access-control-allow-origin": "*", "content-range": "*/0" },
          });
        if (url.pathname.startsWith("/auth/v1/"))
          return route.fulfill({
            status: 401,
            json: { code: "session_not_found", message: "Local fixture has no signed-in session" },
          });
        return route.fulfill({ status: 404, json: { message: "No fixture for this endpoint" } });
      }
      report.blockedExternalRequests.push({ url: url.href, method });
      return route.abort("blockedbyclient");
    });
  page = await context.newPage();
  page.on("pageerror", (error) =>
    report.errors.push({
      kind: "pageerror",
      message: error.message,
      stack: error.stack,
      route: page.url(),
    }),
  );
  page.on("console", (message) => {
    if (!["error", "warning"].includes(message.type())) return;
    const item = {
      type: message.type(),
      text: message.text(),
      route: page.url(),
      location: message.location(),
      args: [],
    };
    report.console.push(item);
    if (message.type() === "error")
      report.errors.push({ kind: "console-error", message: message.text(), route: page.url() });
    pending.push(
      Promise.allSettled(
        message
          .args()
          .map((arg) =>
            arg.evaluate((value) =>
              value instanceof Error ? { message: value.message, stack: value.stack } : value,
            ),
          ),
      ).then((values) => {
        item.args = values.map((value) =>
          value.status === "fulfilled" ? value.value : "unavailable",
        );
      }),
    );
  });
  page.on("requestfailed", (request) => {
    const item = {
      url: request.url(),
      method: request.method(),
      failure: request.failure(),
      resourceType: request.resourceType(),
      ownedNavigation,
      closingContext,
    };
    const expected =
      item.failure?.errorText === "net::ERR_ABORTED" &&
      ["image", "font", "media"].includes(item.resourceType) &&
      (ownedNavigation || closingContext);
    item.expectedNavigationCancellation = expected;
    report.failedRequests.push(item);
    if (expected) report.expectedCancellations.push(item);
    else report.errors.push({ kind: "requestfailed", ...item });
  });
  page.on("response", (response) => {
    if (response.status() < 400) return;
    const item = { url: response.url(), status: response.status(), body: "" };
    report.errorResponses.push(item);
    report.errors.push({ kind: "http-error", url: item.url, status: item.status });
    pending.push(
      response
        .text()
        .then((text) => {
          item.body = text.slice(0, 4000);
        })
        .catch(() => {}),
    );
  });
  page.setDefaultTimeout(15000);
  for (const viewport of [
    { width: 1363, height: 936 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    for (const [name, route] of [
      ["home", "/"],
      ["quick", "/partida-rapida"],
      ["career", "/new"],
      ["about", "/sobre"],
      ["contact", "/contato"],
    ]) {
      const journey = { route, viewport, status: "running" };
      report.journeys.push(journey);
      try {
        const response = await navigate(new URL(route, target).href, {
          waitUntil: "domcontentloaded",
          timeout: 60000,
        });
        await page.locator("h1").first().waitFor({ timeout: 30000 });
        await page.waitForTimeout(1200);
        const essential = page.getByRole("button", { name: "Só o essencial", exact: true });
        if ((await essential.count()) && (await essential.isVisible())) await essential.click();
        const content = await page.locator("body").innerText();
        const boundary = /Não foi possível carregar esta página|Página não encontrada/.test(
          content,
        );
        if (boundary) report.errors.push({ kind: "dom-boundary", route, viewport });
        const file = `${name}-${viewport.width}x${viewport.height}.png`;
        await page.screenshot({
          path: path.join(output, file),
          fullPage: true,
          animations: "disabled",
        });
        report.captures.push({
          file,
          route,
          viewport,
          status: response?.status(),
          boundary,
          title: await page.title(),
          headings: await page.getByRole("heading").allTextContents(),
          horizontalOverflow: await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth + 1,
          ),
          addressVisible: content.includes("Av. Hugo Viola, 351"),
          cpfVisible: content.includes("170.312.897-42"),
        });
        if (boundary || !response?.ok())
          throw new Error(`Unusable ${route}: boundary=${boundary}, HTTP=${response?.status()}`);
        if (route === "/new") {
          await careerWizard(viewport);
        }
        const support = page.getByRole("button", { name: "Abrir formulário de suporte" });
        if (route === "/contato" && (await support.count())) {
          await support.click();
          await page.getByText(/formulário está temporariamente indisponível/).waitFor();
          const supportFile = `support-unavailable-${viewport.width}.png`;
          await page.screenshot({
            path: path.join(output, supportFile),
            fullPage: true,
            animations: "disabled",
          });
          report.captures.push({
            file: supportFile,
            route,
            viewport,
            supportUnavailableFallback: true,
          });
        }
        journey.status = "passed";
      } catch (error) {
        journey.status = "failed";
        journey.failure = error.message;
        report.errors.push({ kind: "journey", route, viewport, message: error.message });
        await page
          .screenshot({
            path: path.join(output, `${name}-failure-${viewport.width}.png`),
            fullPage: true,
          })
          .catch(() => {});
      }
    }
  }
  if (createGuest) {
    const viewport = { width: 1363, height: 936 };
    await page.setViewportSize(viewport);
    await navigate(new URL("/new", target).href, { waitUntil: "domcontentloaded" });
    await careerWizard(viewport, true);
  }
  const video = page.video();
  closingContext = true;
  await context.close();
  report.video = video ? path.relative(output, await video.path()) : null;
} catch (error) {
  report.errors.push({ kind: "collector", message: error.message, stack: error.stack });
} finally {
  await Promise.allSettled(pending);
  const pendingVideo = page?.video();
  closingContext = true;
  await context?.close();
  if (!report.video && pendingVideo)
    report.video = path.relative(output, await pendingVideo.path()).replaceAll("\\", "/");
  await browser?.close();
  server?.kill("SIGTERM");
  report.validationStatus =
    report.errors.length === 0 &&
    report.journeys.length > 0 &&
    report.journeys.every((journey) => journey.status === "passed")
      ? fixture
        ? "passed-local-fixture"
        : "passed-configured-preview"
      : "failed-or-partial";
  await writeFile(path.join(output, "server.log"), serverLog);
  await writeFile(path.join(output, "ui-report.json"), `${JSON.stringify(report, null, 2)}\n`);
}
console.log(
  JSON.stringify({
    label,
    captures: report.captures.length,
    errors: report.errors.length,
    video: report.video,
    validationStatus: report.validationStatus,
    journeys: report.journeys,
  }),
);

if (!report.validationStatus.startsWith("passed-")) process.exitCode = 1;

async function careerWizard(viewport, makeGuest = false) {
  const journey = {
    name: makeGuest ? "synthetic-local-guest" : "career-wizard",
    viewport,
    synthetic: makeGuest,
    status: "running",
    steps: [],
  };
  report.journeys.push(journey);
  try {
    await page.locator("#manager-name").fill("QA Local Fixture", { timeout: 20000 });
    journey.countries = await page.locator(".career-country-list button").allTextContents();
    journey.duplicates = journey.countries.filter(
      (name, index, list) => list.indexOf(name) !== index,
    );
    if (!journey.countries.length || journey.duplicates.length)
      throw new Error("Missing or duplicate country options");
    journey.steps.push("identity");
    for (const [name, button] of [
      ["appearance", "Continuar"],
      ["profile", "Continuar"],
      ["clubs", "Escolher meu clube"],
    ]) {
      await page.getByRole("button", { name: button, exact: true }).click();
      await page.waitForTimeout(350);
      if (
        (await page.locator("body").innerText()).includes("Não foi possível carregar esta página")
      )
        throw new Error(`Career boundary at ${name}`);
      const file = `career-${makeGuest ? "guest-" : ""}${name}-${viewport.width}x${viewport.height}.png`;
      await page.screenshot({ path: path.join(output, file), fullPage: true });
      report.captures.push({ file, route: "/new", viewport, step: name });
      journey.steps.push(name);
    }
    await page.locator(".career-club:not([disabled])").first().click();
    journey.selectedClub = await page.locator(".career-selection h3").innerText();
    const file = `career-${makeGuest ? "guest-" : ""}review-${viewport.width}x${viewport.height}.png`;
    await page.screenshot({ path: path.join(output, file), fullPage: true });
    report.captures.push({ file, route: "/new", viewport, step: "club-review" });
    journey.steps.push("club-review");
    if (makeGuest) {
      await page.getByRole("button", { name: /^Assumir / }).click();
      await page.waitForTimeout(10500);
      const error = page.locator(".career-error[role=alert]");
      if (await error.count()) throw new Error(await error.first().innerText());
      // The create button persists the guest career; no save or session is injected.
      for (const [name, route] of [
        ["club", "/club"],
        ["finances", "/finances"],
        ["tactics", "/tactics"],
      ]) {
        await navigate(new URL(route, target).href, { waitUntil: "domcontentloaded" });
        await page.getByRole("heading").first().waitFor({ timeout: 20000 });
        await page.waitForTimeout(1500);
        const body = await page.locator("body").innerText();
        if (
          body.includes("Não foi possível carregar esta página") ||
          new URL(page.url()).pathname !== route
        )
          throw new Error(`Guest ${name} failed to hydrate`);
        const shot = `guest-${name}-${viewport.width}x${viewport.height}.png`;
        await page.screenshot({ path: path.join(output, shot), fullPage: true });
        report.captures.push({
          file: shot,
          route,
          viewport,
          syntheticGuest: true,
          actualUrl: page.url(),
          headings: await page.getByRole("heading").allTextContents(),
        });
        journey.steps.push(name);
      }
    }
    journey.status = "passed";
  } catch (error) {
    journey.status = "failed";
    journey.failure = error.message;
    report.errors.push({ kind: "journey", name: journey.name, message: error.message, viewport });
    await page
      .screenshot({
        path: path.join(output, `career-${makeGuest ? "guest-" : ""}failure-${viewport.width}.png`),
        fullPage: true,
      })
      .catch(() => {});
  }
}
