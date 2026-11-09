import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const [originArg, outputArg, tag] = process.argv.slice(2);
if (!originArg || !outputArg || !/^[a-z0-9_-]+$/i.test(tag ?? ""))
  throw new Error("Usage: node scripts/quality-interface-evidence.mjs LOCAL_ORIGIN OUTPUT TAG");
const origin = new URL(originArg);
if (!["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname))
  throw new Error("Interface evidence is restricted to a local preview.");
const runtime = process.env["QA_RUNTIME_MODULES"];
if (!runtime) throw new Error("Set QA_RUNTIME_MODULES to the bundled Playwright node_modules.");
const { chromium } = createRequire(path.join(runtime, "package.json"))("playwright");
const output = path.resolve(outputArg, tag);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
const context = await browser.newContext({
  viewport: { width: 1365, height: 900 },
  locale: "pt-BR",
  deviceScaleFactor: 1,
  recordVideo: { dir: path.join(output, "video"), size: { width: 1365, height: 900 } },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) =>
  errors.push({ path: new URL(page.url()).pathname, message: error.message }),
);
const failures = [];
page.on("response", (response) => {
  if (response.status() >= 400 && /\.(?:css|js)(?:[?#]|$)/.test(response.url()))
    failures.push({ path: new URL(response.url()).pathname, status: response.status() });
});
const report = {
  tag,
  startedAt: new Date().toISOString(),
  origin: origin.href,
  viewport: { width: 1365, height: 900, dpr: 1 },
  scope:
    "Local public UI captures; video overhead is present. No FPS certification, sign-in, account creation, ticket submission or production mutation.",
  routes: [],
  errors,
  failedAssets: failures,
};
try {
  for (const route of ["/", "/contato", "/sobre", "/criador", "/auth", "/new"]) {
    const response = await page.goto(new URL(route, origin).href, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    await page.locator("h1").first().waitFor({ state: "visible", timeout: 15_000 });
    await page.waitForTimeout(800);
    const name = route === "/" ? "home" : route.slice(1);
    await page.screenshot({
      path: path.join(output, `${name}.png`),
      fullPage: true,
      animations: "disabled",
    });
    const metrics = await page.evaluate(() => ({
      title: document.title,
      heading: document.querySelector("h1")?.textContent?.trim(),
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      headingFont: getComputedStyle(document.querySelector("h1")).fontSize,
      navigation: performance.getEntriesByType("navigation").map((entry) => ({
        responseStart: entry.responseStart,
        domContentLoaded: entry.domContentLoadedEventEnd,
        duration: entry.duration,
      })),
    }));
    report.routes.push({
      route,
      status: response?.status(),
      screenshot: `${name}.png`,
      ...metrics,
    });
    const support = page.getByRole("button", { name: "Começar atendimento", exact: true });
    if (route === "/contato" && (await support.count())) {
      await support.click();
      await page
        .getByRole("link", { name: "Entrar e abrir um pedido" })
        .waitFor({ timeout: 15_000 });
      await page.screenshot({
        path: path.join(output, "contato-open.png"),
        fullPage: true,
        animations: "disabled",
      });
    }
    if (["/contato", "/new", "/auth"].includes(route)) {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({
        path: path.join(output, `${name}-mobile.png`),
        fullPage: true,
        animations: "disabled",
      });
      report.routes.at(-1).mobileHorizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      );
      await page.setViewportSize({ width: 1365, height: 900 });
    }
    console.log(JSON.stringify({ tag, route, status: response?.status() }));
  }
  report.success =
    errors.length === 0 &&
    failures.length === 0 &&
    report.routes.every(
      (route) =>
        route.status === 200 && !route.horizontalOverflow && !route.mobileHorizontalOverflow,
    );
} catch (error) {
  report.success = false;
  report.failure = String(error.stack ?? error);
  await page
    .screenshot({ path: path.join(output, "failure.png"), fullPage: true })
    .catch(() => undefined);
} finally {
  report.completedAt = new Date().toISOString();
  const video = page.video();
  await context.close();
  if (video) report.video = path.relative(output, await video.path());
  await browser.close();
  await writeFile(path.join(output, "interface.json"), JSON.stringify(report, null, 2) + "\n");
}
if (!report.success) process.exitCode = 1;
