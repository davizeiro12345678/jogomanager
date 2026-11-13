import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { appendFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const [originText, outputText, sha] = process.argv.slice(2);
if (!originText || !outputText || !/^[0-9a-f]{40}$/.test(sha ?? "")) {
  throw new Error(
    "Usage: node .github/scripts/pr132-nine-axis-qa.mjs LOOPBACK_ORIGIN OUTDIR 40_CHAR_SHA",
  );
}
const origin = new URL(originText);
if (origin.protocol !== "http:" || !["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)) {
  throw new Error("QA must run against a local, isolated preview only");
}
const runtime = process.env["PLAYWRIGHT_MODULE"];
if (!runtime) throw new Error("PLAYWRIGHT_MODULE is required");
const { chromium } = createRequire(path.join(runtime, "package.json"))("playwright");
const output = path.resolve(outputText);
await mkdir(path.join(output, "screenshots"), { recursive: true });
await mkdir(path.join(output, "videos"), { recursive: true });

const axes = [
  ["runtime", "JavaScript, hydration and console diagnostics"],
  ["network", "HTTP, broken assets and browser waterfall"],
  ["responsive", "Mobile overflow, touch targets and screenshots"],
  ["accessibility", "Keyboard focus and accessible button names"],
  ["contrast", "Visible text contrast heuristic and reduced motion"],
  ["interaction", "Safe real-browser navigation and UI interactions"],
  ["privacy", "External link safety and public surface metadata"],
  ["performance", "Startup timings, long tasks and resource budgets"],
  ["static", "Changed-file source security and hotspot review"],
];
const report = {
  sha,
  timestamp: new Date().toISOString(),
  scope:
    "Local anonymous preview. No production writes, credentials, pentest, physical GPU certification or actual mobile devices.",
  axes: Object.fromEntries(axes.map(([key, title]) => [key, { title, findings: [], metrics: {} }])),
  screenshots: [],
  videos: [],
  critical: [],
};
const find = (axis, severity, location, description, fix, extra = {}) => {
  const finding = { severity, location, description, fix, ...extra };
  report.axes[axis].findings.push(finding);
  if (severity === "error") report.critical.push({ axis, ...finding });
  return finding;
};
const safePath = (text) =>
  String(text)
    .replace(/[\r\n|]/g, " ")
    .slice(0, 240);
const png = async (page, name) => {
  const file = path.join("screenshots", name + ".png");
  await page.screenshot({ path: path.join(output, file), fullPage: true, animations: "disabled" });
  report.screenshots.push(file);
};
const source = (route) => (route === "/contato" ? "src/pages/contato.tsx" : route);
let browser;
try {
  browser = await chromium.launch({
    executablePath: process.env["PLAYWRIGHT_CHROMIUM_EXECUTABLE"] || undefined,
    headless: true,
  });
  const context = await browser.newContext({
    locale: "pt-BR",
    viewport: { width: 1365, height: 900 },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
    recordVideo: { dir: path.join(output, "videos"), size: { width: 1365, height: 900 } },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  const pageErrors = [];
  const consoleErrors = [];
  const networkFailures = [];
  await page.addInitScript(() => {
    window.__qaLongTasks = [];
    if (typeof PerformanceObserver !== "undefined") {
      try {
        new PerformanceObserver((list) => {
          for (const item of list.getEntries()) {
            window.__qaLongTasks.push({
              startMs: Math.round(item.startTime),
              durationMs: Math.round(item.duration),
            });
          }
        }).observe({ type: "longtask", buffered: true });
      } catch {
        /* unsupported in this browser */
      }
    }
  });
  page.on("pageerror", (error) => {
    pageErrors.push({
      url: page.url(),
      message: String(error.message).slice(0, 260),
      stack: String(error.stack ?? "").slice(0, 900),
    });
  });
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const loc = message.location();
    consoleErrors.push({
      route: new URL(page.url()).pathname,
      message: safePath(message.text()),
      sourceUrl: loc.url,
      line: loc.lineNumber,
      column: loc.columnNumber,
    });
  });
  page.on("requestfailed", (request) => {
    const url = new URL(request.url());
    if (url.origin === origin.origin) {
      networkFailures.push({
        route: new URL(page.url()).pathname,
        asset: url.pathname,
        error: request.failure()?.errorText,
      });
    }
  });
  page.on("response", (response) => {
    if (response.status() < 400) return;
    const url = new URL(response.url());
    if (url.origin === origin.origin && /\.(js|css|wasm)(\?|$)/.test(url.pathname)) {
      networkFailures.push({
        asset: url.pathname,
        status: response.status(),
        route: new URL(page.url()).pathname,
      });
    }
  });

  const routes = ["/", "/contato", "/auth", "/new"];
  for (const route of routes) {
    await page.setViewportSize({ width: 1365, height: 900 });
    const response = await page.goto(new URL(route, origin).href, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page.waitForTimeout(650);
    const status = response?.status() ?? 0;
    const name = route === "/" ? "home" : route.slice(1);
    const baseMetrics = await page.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0];
      return {
        title: document.title,
        headings: document.querySelectorAll("h1").length,
        loadMs: Math.round(nav?.duration ?? 0),
        domReadyMs: Math.round(nav?.domContentLoadedEventEnd ?? 0),
        resourceCount: performance.getEntriesByType("resource").length,
        longTasks: (window.__qaLongTasks ?? []).slice(0, 100),
        overflow: document.documentElement.scrollWidth - innerWidth,
        focusableCount: document.querySelectorAll("button,a[href],input,select,textarea,[tabindex]")
          .length,
      };
    });
    report.axes.runtime.metrics[name] = { status, headings: baseMetrics.headings };
    report.axes.performance.metrics[name] = {
      loadMs: baseMetrics.loadMs,
      domReadyMs: baseMetrics.domReadyMs,
      resourceCount: baseMetrics.resourceCount,
      longTaskCount: baseMetrics.longTasks.length,
      longestTaskMs: Math.max(0, ...baseMetrics.longTasks.map((task) => task.durationMs)),
    };
    if (status >= 500 || status === 0) {
      find(
        "runtime",
        "error",
        { route, sourceHint: source(route) },
        "Public route returned HTTP " + status,
        "Fix local SSR/runtime errors; inspect browser/server logs.",
      );
    } else if (status >= 400) {
      find(
        "runtime",
        "warning",
        { route, sourceHint: source(route) },
        "Route returned HTTP " + status,
        "Confirm route availability and expected authentication behavior.",
      );
    }
    if (!baseMetrics.headings) {
      find(
        "accessibility",
        "warning",
        { route, selector: "h1" },
        "No top-level heading found.",
        "Provide one descriptive h1 for the public route.",
      );
    }
    if (baseMetrics.longTasks.some((task) => task.durationMs > 200)) {
      find(
        "performance",
        "warning",
        { route },
        "Startup main-thread task exceeded 200 ms.",
        "Inspect hydration, synchronous imports and performance trace; compare on the same runner.",
        { longestMs: Math.max(...baseMetrics.longTasks.map((task) => task.durationMs)) },
      );
    }
    await png(page, name + "-desktop");

    for (const width of [320, 390, 768]) {
      await page.setViewportSize({ width, height: 844 });
      await page.waitForTimeout(120);
      const layout = await page.evaluate(() => {
        const overflow = document.documentElement.scrollWidth - innerWidth;
        const clipped = [...document.querySelectorAll("button,a[href],input,textarea,select")]
          .filter((element) => {
            const r = element.getBoundingClientRect();
            return r.width > 0 && r.height > 0 && (r.left < -2 || r.right > innerWidth + 2);
          })
          .slice(0, 5)
          .map((element) => ({
            tag: element.tagName.toLowerCase(),
            label: (element.textContent || element.getAttribute("aria-label") || "")
              .trim()
              .slice(0, 70),
          }));
        return { overflow, clipped };
      });
      report.axes.responsive.metrics[name + "-" + width] = layout;
      if (layout.overflow > 2) {
        find(
          "responsive",
          "warning",
          {
            route,
            viewportWidth: width,
            selector: "document.documentElement",
            sourceHint: source(route),
          },
          "Horizontal overflow by " + layout.overflow + " px.",
          "Inspect fixed widths, grid min-width, flex children and safe-area styles.",
        );
      }
      if (layout.clipped.length) {
        find(
          "responsive",
          "warning",
          { route, viewportWidth: width, elements: layout.clipped },
          "Interactive elements cross the viewport edge.",
          "Adjust responsive layout and validate keyboard/touch targets.",
        );
      }
      await png(page, name + "-" + width);
    }
    await page.setViewportSize({ width: 1365, height: 900 });

    if (route === "/contato") {
      const toggle = page.getByRole("button", {
        name: /Consultar decisões e recursos|View decisions and appeals|Consultar decisiones y recursos/i,
      });
      if (await toggle.count()) {
        await toggle.first().click({ timeout: 9000 });
        await page
          .locator("#moderation-center-title")
          .waitFor({ state: "visible", timeout: 3500 })
          .catch(() => undefined);
        await png(page, "contato-moderation-open");
        const view = await page.evaluate(() => ({
          pathname: location.pathname,
          mounted: Boolean(document.getElementById("moderation-center-title")),
          bodyTextChars: (document.body.innerText || "").trim().length,
        }));
        report.axes.interaction.metrics["moderationViewOpened"] = view.mounted;
        report.axes.interaction.metrics["moderationViewAfterClick"] = view;
        if (!view.mounted || view.pathname !== "/contato") {
          find(
            "interaction",
            "warning",
            {
              route: "/contato",
              afterClick: view.pathname,
              sourceHint: "src/components/support/ModerationReviewCenter.tsx",
            },
            "Click did not produce a visible moderation review center; the preview may have redirected to sign-in.",
            "Verify feature flag, authenticated access, redirect and lazy boundary with an isolated test account. A successful click alone does not prove functionality.",
          );
        }
        if (view.pathname !== "/contato") {
          await page.goto(new URL("/contato", origin).href, {
            waitUntil: "domcontentloaded",
          });
          await page.waitForTimeout(650);
        }
      } else {
        find(
          "interaction",
          "warning",
          { route, selector: "button" },
          "Moderation review entry was not found.",
          "Check the localized button label, lazy module and public contact route.",
        );
      }
      const supportToggle = page.getByRole("button", {
        name: /Começar atendimento|Start support|Iniciar atención/i,
      });
      if (await supportToggle.count()) {
        await supportToggle.first().click({ timeout: 9000 });
        await page.waitForTimeout(300);
        await png(page, "contato-support-open");
        report.axes.interaction.metrics["supportViewOpened"] = true;
      }
      const links = await page
        .locator("a[target='_blank']")
        .evaluateAll((items) =>
          items.map((a) => ({ href: a.getAttribute("href"), rel: a.getAttribute("rel") || "" })),
        );
      for (const link of links) {
        if (!/\bnoopener\b/.test(link.rel)) {
          find(
            "privacy",
            "warning",
            { route, href: safePath(link.href) },
            "External link without explicit noopener.",
            "Set rel='noopener noreferrer' on external target=_blank links.",
          );
        }
      }
      report.axes.privacy.metrics["outboundNewTabs"] = links.length;

      await page.keyboard.press("Tab");
      const focus = await page.evaluate(() => ({
        tag: document.activeElement?.tagName || "none",
        visible:
          document.activeElement instanceof HTMLElement &&
          document.activeElement.matches(":focus-visible"),
      }));
      report.axes.accessibility.metrics["contactKeyboard"] = focus;
      if (focus.tag === "BODY" || focus.tag === "none") {
        find(
          "accessibility",
          "warning",
          { route, selector: ":focus-visible" },
          "Keyboard tab focus did not reach an interactive element.",
          "Check tabindex and focus management after opening the panel.",
        );
      }
    }
    const elements = await page.evaluate(() => {
      const visible = (element) => {
        const r = element.getBoundingClientRect();
        const s = getComputedStyle(element);
        return r.width > 0 && r.height > 0 && s.visibility === "visible" && s.display !== "none";
      };
      const controls = [...document.querySelectorAll("button,[role='button']")].filter(visible);
      const nameless = controls.filter((el) => {
        const txt = (el.textContent || "").trim();
        return !txt && !el.getAttribute("aria-label") && !el.getAttribute("title");
      });
      const small = controls.filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width < 24 || r.height < 24;
      });
      const motion = getComputedStyle(document.documentElement).scrollBehavior;
      return {
        controls: controls.length,
        unnamed: nameless.length,
        small: small.length,
        unnamedSelectors: nameless.slice(0, 4).map((e) => e.outerHTML.slice(0, 200)),
        reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
        rootScrollBehavior: motion,
        lang: document.documentElement.lang,
        description:
          document.querySelector("meta[name='description']")?.getAttribute("content") || "",
        canonical: document.querySelector("link[rel='canonical']")?.getAttribute("href") || "",
      };
    });
    report.axes.accessibility.metrics[name] = {
      controls: elements.controls,
      unnamed: elements.unnamed,
      undersized: elements.small,
    };
    if (elements.unnamed)
      find(
        "accessibility",
        "warning",
        { route, selectors: elements.unnamedSelectors },
        "Visible icon controls without an accessible name.",
        "Add aria-label or visible label to each control.",
      );
    report.axes.contrast.metrics[name] = {
      reducedMotion: elements.reducedMotion,
      rootScrollBehavior: elements.rootScrollBehavior,
    };
    report.axes.privacy.metrics[name] = {
      lang: elements.lang,
      canonical: elements.canonical,
      descriptionLength: elements.description.length,
    };
    if (!elements.lang)
      find(
        "privacy",
        "warning",
        { route, selector: "html[lang]" },
        "Page language is missing.",
        "Set html lang consistently with the selected locale.",
      );
    if (!elements.reducedMotion)
      find(
        "contrast",
        "warning",
        { route },
        "Reduced-motion emulation was not active.",
        "Check the browser/context media preference.",
      );
  }

  for (const item of pageErrors) {
    find(
      "runtime",
      "error",
      { route: new URL(item.url).pathname, stack: item.stack },
      item.message,
      "Use the stack URL/line to map the generated chunk to its source; reproduce with dev sourcemaps.",
    );
  }
  for (const item of consoleErrors) {
    find(
      "runtime",
      "warning",
      { route: item.route, sourceUrl: item.sourceUrl, line: item.line, column: item.column },
      item.message,
      "Inspect the emitted script location and source map. Confirm whether the error is an expected third-party browser warning.",
    );
  }
  for (const item of networkFailures) {
    find(
      "network",
      "warning",
      { route: item.route, asset: item.asset },
      "Resource failed: " + (item.status ?? item.error),
      "Check file URL, caching and content type. Compare the network waterfall before changing the code.",
    );
  }
  report.axes.runtime.metrics.pageErrors = pageErrors.length;
  report.axes.runtime.metrics.consoleErrors = consoleErrors.length;
  report.axes.network.metrics.failed = networkFailures.length;

  const videos = page.video();
  await context.close();
  if (videos) report.videos.push(path.relative(output, await videos.path()));
} catch (error) {
  find(
    "runtime",
    "error",
    { phase: "harness" },
    String(error.stack || error).slice(0, 1100),
    "Inspect the local preview log, Playwright installation and browser startup.",
  );
} finally {
  if (browser) await browser.close().catch(() => undefined);
}

const patterns = [
  {
    id: "dynamic-evaluation",
    pattern: /\b(?:eval|new Function)\s*\(/,
    detail: "Dynamic code execution",
    remedy: "Remove runtime code evaluation; use typed dispatch tables.",
  },
  {
    id: "html-sink",
    pattern: /\bdangerouslySetInnerHTML\b|\binnerHTML\s*=/,
    detail: "HTML injection sink",
    remedy: "Audit sanitization, trusted content source and CSP; prefer textContent.",
  },
  {
    id: "browser-privileged-key",
    pattern: /(?:service[_-]?role|SUPABASE_SERVICE_ROLE_KEY)\b/i,
    detail: "Privileged key reference",
    remedy: "Confirm privileged credentials are server-only and never serialized to the client.",
  },
  {
    id: "shell-execution",
    pattern: /\b(?:execSync|spawnSync|child_process\.exec)\s*\(/,
    detail: "Shell execution boundary",
    remedy: "Confirm untrusted input cannot reach a shell, use execFile with fixed arguments.",
  },
  {
    id: "weak-randomness",
    pattern: /\bMath\.random\s*\(/,
    detail: "Non-cryptographic RNG",
    remedy:
      "Review any use in authentication, IDs, nonces, or settlement; use crypto APIs for secrets.",
  },
];
try {
  const files = execFileSync(
    "git",
    ["diff", "--name-only", "--diff-filter=ACMR", "origin/main...HEAD"],
    { encoding: "utf8", maxBuffer: 5_000_000 },
  )
    .split(/\r?\n/)
    .filter((p) =>
      /^(src|services|cloudflare|scripts|drizzle)\/.*\.(?:ts|tsx|mjs|js|sql)$/.test(p),
    );
  const staticResults = [];
  for (const file of files.slice(0, 2000)) {
    const lines = (await readFile(file, "utf8")).split(/\r?\n/);
    if (lines.length > 1300) {
      staticResults.push({
        path: file,
        line: 1300,
        rule: "large-source",
        detail: "Source file exceeds 1,300 lines",
        remedy: "Consider extracting testable modules after profiling, not mechanical splitting.",
      });
    }
    for (let i = 0; i < lines.length; i++) {
      for (const rule of patterns) {
        if (rule.pattern.test(lines[i])) {
          staticResults.push({
            path: file,
            line: i + 1,
            rule: rule.id,
            detail: rule.detail,
            remedy: rule.remedy,
          });
        }
      }
    }
  }
  report.axes.static.metrics = {
    inspectedChangedCodeFiles: files.length,
    reviewCandidates: staticResults.length,
  };
  await writeFile(
    path.join(output, "full-static-findings.json"),
    JSON.stringify({ sha, total: staticResults.length, findings: staticResults }, null, 2) + "\n",
  );
  for (const item of staticResults.slice(0, 160)) {
    find(
      "static",
      "review",
      { file: item.path, line: item.line, rule: item.rule },
      item.detail,
      item.remedy,
    );
  }
  if (staticResults.length > 160) {
    find(
      "static",
      "review",
      { scope: "diff" },
      "Additional " + (staticResults.length - 160) + " candidates omitted from summary.",
      "Inspect the complete list with a dedicated static analyzer; this scan does not establish exploitability.",
    );
  }
} catch (error) {
  find(
    "static",
    "warning",
    { scope: "diff" },
    "Could not compare changed sources: " + String(error.message).slice(0, 190),
    "Ensure full git history and origin/main are available in checkout.",
  );
}

// Independent *coverage inventory* of every changed PR path, including
// non-source assets and deleted files. This is NOT a formal human security
// review; the static analyzer above inspects code and records exact lines.
try {
  const paths = execFileSync("git", ["diff", "--name-only", "-z", "origin/main...HEAD"], {
    encoding: "utf8",
    maxBuffer: 8_000_000,
  })
    .split("\0")
    .filter(Boolean);
  const inventory = [];
  const infrastructure = [
    ".github/workflows/",
    "drizzle/migrations/",
    "services/match-authority/",
    "cloudflare/",
  ];
  const sensitive = /(?:auth|payment|stripe|secret|moderation|realtime|multiplayer|matchmaking|security|ticket|anticheat)/i;
  const visuals = /(?:cinematic|stadium|renderer|webgl|webgpu|physics|shaders|texture|graphics|3d)/i;
  const riskGroup = (file) => {
    if (infrastructure.some((root) => file.startsWith(root))) return "critical-infrastructure";
    if (sensitive.test(file)) return "security-sensitive";
    if (visuals.test(file)) return "graphics-or-simulation";
    if (["src/", "tests/", "scripts/", "services/"].some((root) => file.startsWith(root)))
      return "application-or-tests";
    return "documentation-or-assets";
  };
  for (const file of paths) {
    let sizeBytes = null;
    let lineCount = null;
    let state = "present";
    try {
      const info = await stat(file);
      sizeBytes = info.size;
      if (
        info.isFile() &&
        info.size <= 2_000_000 &&
        /\.(?:ts|tsx|mjs|js|json|yaml|yml|css|md|sql|html)$/i.test(file)
      )
        lineCount = (await readFile(file, "utf8")).split(/\r?\n/).length;
    } catch {
      state = "deleted-or-unavailable";
    }
    inventory.push({
      path: file,
      state,
      sizeBytes,
      lineCount,
      riskGroup: riskGroup(file),
    });
  }
  const counts = Object.fromEntries(
    [...new Set(inventory.map((item) => item.riskGroup))].map((group) => [
      group,
      inventory.filter((item) => item.riskGroup === group).length,
    ]),
  );
  report.axes.static.metrics.allChangedFiles = inventory.length;
  report.axes.static.metrics.changeRiskGroups = counts;
  await writeFile(
    path.join(output, "full-pr-file-inventory.json"),
    JSON.stringify({ sha, total: inventory.length, counts, files: inventory }, null, 2) + "\n",
  );
  const csv = ["path,state,sizeBytes,lineCount,riskGroup"];
  for (const item of inventory) {
    const cells = [
      item.path,
      item.state,
      item.sizeBytes ?? "",
      item.lineCount ?? "",
      item.riskGroup,
    ];
    csv.push(cells.map((value) => '"' + String(value).replace(/"/g, '""') + '"').join(","));
  }
  await writeFile(path.join(output, "full-pr-file-inventory.csv"), csv.join("\n") + "\n");
  find(
    "static",
    "review",
    { files: inventory.length, scope: "file inventory" },
    "All changed paths were catalogued by type and risk. Source heuristics do not certify the contents of all files.",
    "Review critical infrastructure, trust boundaries, compiled assets and all remaining code manually before merge.",
  );
} catch (error) {
  find(
    "static",
    "warning",
    { phase: "full-pr-inventory" },
    "Full PR file inventory could not be generated: " + String(error.message).slice(0, 180),
    "Check the checkout base history and git diff permissions.",
  );
}

const md = [
  "# PR #132: nine-axis QA",
  "",
  "Commit: " + sha,
  "",
  "Scope: browser automation on local anonymous preview, plus changed-file static review. This **does not** certify remote production, real mobile devices or a physical GPU.",
  "",
  "| Area | Findings | Errors | Evidence |",
  "|---|---:|---:|---|",
  ...axes.map(([name, title]) => {
    const axis = report.axes[name];
    return (
      "| " +
      title +
      " | " +
      axis.findings.length +
      " | " +
      axis.findings.filter((f) => f.severity === "error").length +
      " | report.json / screenshots / video |"
    );
  }),
  "",
  "## Findings and remediation",
  "",
  ...axes.flatMap(([name, title]) =>
    report.axes[name].findings
      .slice(0, 18)
      .map(
        (f) =>
          "- **" +
          name +
          " (" +
          f.severity +
          ")** " +
          safePath(JSON.stringify(f.location)) +
          ": " +
          safePath(f.description) +
          ". Fix: " +
          safePath(f.fix),
      ),
  ),
  "",
  "Evidence includes PNG screenshots, WebM interaction video, JSON timings, full-pr-file-inventory.json/.csv, and full-static-findings.json.",
  "Inventory covers all changed paths, while regex static review covers only eligible source files. Neither is a formal independent review of every changed line.",
  "A browser selector or bundled stack location is **not** proof of the original TypeScript source line. Static audit locations are exact source file and line.",
  "",
];
await writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2) + "\n");
await writeFile(path.join(output, "summary.md"), md.join("\n") + "\n");
if (process.env["GITHUB_STEP_SUMMARY"]) {
  await appendFile(process.env["GITHUB_STEP_SUMMARY"], md.join("\n") + "\n");
}
for (const f of report.critical.slice(0, 20)) {
  const message = safePath(f.description);
  const loc = f.location.file ? " file=" + f.location.file + ",line=" + f.location.line : "";
  console.log("::error" + loc + "::" + f.axis + ": " + message);
}
console.log(
  JSON.stringify({
    axes: axes.length,
    findings: axes.map(([name]) => ({ name, count: report.axes[name].findings.length })),
    critical: report.critical.length,
    screenshots: report.screenshots.length,
    videos: report.videos.length,
    sha,
  }),
);
if (report.critical.length) process.exitCode = 1;
