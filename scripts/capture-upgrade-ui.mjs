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
const report = {
  label,
  baseUrl,
  browser: null,
  captures: [],
  errors: [],
  video: null,
  fpsCertification: false,
  method: "Playwright fallback; cloud browser has WebGL disabled",
};
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
  const context = await browser.newContext({
    viewport: { width: 1363, height: 936 },
    locale: "pt-BR",
    deviceScaleFactor: 1,
    recordVideo: { dir: path.join(output, "video"), size: { width: 1363, height: 936 } },
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => report.errors.push(error.message));
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
      const response = await page.goto(new URL(route, target).href, {
          waitUntil: "domcontentloaded",
        timeout: 60000,
      });
        await page.locator("h1").first().waitFor({ timeout: 30000 });
        await page.waitForTimeout(1200);
      const content = await page.locator("body").innerText();
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
        title: await page.title(),
        headings: await page.getByRole("heading").allTextContents(),
        horizontalOverflow: await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        ),
        addressVisible: content.includes("Av. Hugo Viola, 351"),
        cpfVisible: content.includes("170.312.897-42"),
      });
      if (route === "/new") {
        report.careerCountryOptions = await page.locator("select").evaluateAll((selects) =>
          selects.map((select) => ({
            name: select.name,
            options: [...select.options].map((option) => option.textContent),
          })),
        );
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
    }
  }
  const video = page.video();
  await context.close();
  report.video = video ? path.relative(output, await video.path()) : null;
} finally {
  await browser?.close();
  server?.kill("SIGTERM");
  await writeFile(path.join(output, "ui-report.json"), `${JSON.stringify(report, null, 2)}\n`);
}
console.log(
  JSON.stringify({
    label,
    captures: report.captures.length,
    errors: report.errors.length,
    video: report.video,
  }),
);
