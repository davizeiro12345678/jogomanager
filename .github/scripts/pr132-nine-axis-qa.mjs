import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { committedSourceInventory } from "./read-qa-committed-source.mjs";
import path from "node:path";
import { studioFixtureUrl } from "../../scripts/studio-qa-origin.mjs";

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
const studioUrl = studioFixtureUrl(process.env["GRAPHICS_FIXTURE_ORIGIN"] ?? "");
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
async function waitForAuthView(page) {
  const current = new URL(page.url());
  if (current.origin !== origin.origin || current.pathname !== "/auth") {
    throw new Error("Authentication QA left the expected local route.");
  }
  const main = page.locator("main.auth-stage");
  const unavailable = main.locator("#auth-unavailable-title:visible");
  const entry = main
    .locator(
      '#auth-email:enabled:visible, input[type="tel"]:enabled:visible, button.auth-social:enabled:visible',
    )
    .or(main.getByRole("button", { name: "Entrar com chave de acesso", disabled: false }));
  await unavailable.or(entry).first().waitFor({ state: "visible", timeout: 12000 });
  return (await unavailable.isVisible()) ? "unavailable" : "configured";
}

const png = async (page, name) => {
  if (new URL(page.url()).pathname === "/auth") await waitForAuthView(page);
  const file = path.join("screenshots", name + ".png");
  // Full-page screenshots can omit offscreen content-visibility:auto subtrees.
  // Temporarily expose the Home guide only in the screenshot rendering pass;
  // app CSS and the preceding layout/performance measurements stay unchanged.
  const screenshotStyle =
    new URL(page.url()).pathname === "/"
      ? ".home-guide-content { content-visibility: visible !important; contain-intrinsic-size: none !important; }"
      : undefined;
  await page.screenshot({
    path: path.join(output, file),
    fullPage: true,
    animations: "disabled",
    ...(screenshotStyle ? { style: screenshotStyle } : {}),
  });
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
  const loadedStudioTextures = new Set();
  const isStudioTexture = (url) =>
    url.origin === studioUrl.origin &&
    url.pathname.startsWith("/__l5e/assets-v1/") &&
    url.pathname.endsWith(".ktx2");
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
    const texture = isStudioTexture(url);
    if (url.origin === origin.origin || texture) {
      networkFailures.push({
        route: new URL(page.url()).pathname,
        asset: url.pathname,
        error: request.failure()?.errorText,
        requiredTexture: texture,
      });
    }
  });
  page.on("response", (response) => {
    const url = new URL(response.url());
    const texture = isStudioTexture(url);
    if (texture && response.ok()) loadedStudioTextures.add(url.pathname);
    if (response.status() < 400) return;
    if (texture || (url.origin === origin.origin && /\.(js|css|wasm)(\?|$)/.test(url.pathname))) {
      networkFailures.push({
        asset: url.pathname,
        status: response.status(),
        route: new URL(page.url()).pathname,
        requiredTexture: texture,
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
    if (route === "/new" && response?.ok()) {
      // This route renders only after its lazy client bundle has loaded.
      // Keep the existing missing-heading finding if it never appears.
      try {
        await page.locator("main.career-create h1").waitFor({ state: "visible", timeout: 8_000 });
      } catch (error) {
        if (error?.name !== "TimeoutError") throw error;
      }
    }
    const status = response?.status() ?? 0;
    const name = route === "/" ? "home" : route.slice(1);
    const authView = route === "/auth" ? await waitForAuthView(page) : undefined;
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
    report.axes.runtime.metrics[name] = {
      status,
      headings: baseMetrics.headings,
      ...(authView && { authView }),
    };
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
      const responsiveAuthView = route === "/auth" ? await waitForAuthView(page) : undefined;
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
      report.axes.responsive.metrics[name + "-" + width] = {
        ...layout,
        ...(responsiveAuthView && { authView: responsiveAuthView }),
      };
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
        const guestLink = page.locator("#moderation-sign-in");
        const panel = page.locator("#moderation-center-title");
        const expectedReturn = "/contato#moderacao";
        const view = {
          state: "unresolved",
          signInPageReached: false,
          signInAvailability: "unknown",
          returnEntryVerified: false,
        };
        try {
          await guestLink.or(panel).first().waitFor({ state: "visible", timeout: 9000 });
          view.state = (await panel.count()) ? "unexpected-private-panel" : "guest-sign-in";
          if (view.state === "unexpected-private-panel") {
            throw new Error("The private review panel appeared in an anonymous browser.");
          }
          if (new URL(page.url()).pathname !== route) {
            throw new Error("Opening moderation unexpectedly navigated away from contact.");
          }
          const target = new URL(await guestLink.getAttribute("href"), page.url());
          const isModerationSignIn = (url) =>
            url.origin === origin.origin &&
            url.pathname === "/auth" &&
            url.searchParams.get("next") === expectedReturn;
          if (!isModerationSignIn(target)) throw new Error("Incorrect moderation sign-in link.");
          await png(page, "contato-moderation-open");
          await guestLink.click();
          await page.waitForURL(isModerationSignIn, { timeout: 9000 });
          view.signInAvailability = await waitForAuthView(page);
          view.signInPageReached = true;
          if (view.signInAvailability === "unavailable") {
            const back = page.getByRole("link", { name: "Voltar ao jogo" });
            if ((await back.getAttribute("href")) !== expectedReturn)
              throw new Error("Unavailable login lost the moderation return.");
            await back.click();
          } else {
            // No credentials in this campaign. Verify the redirect destination independently.
            await page.goto(new URL(target.searchParams.get("next"), origin).href);
          }
          await guestLink.waitFor();
          const returned = new URL(page.url());
          if (
            returned.origin !== origin.origin ||
            returned.pathname + returned.search + returned.hash !== expectedReturn
          )
            throw new Error("Sign-in return did not reach the moderation section.");
          if (await panel.count()) throw new Error("Guest return exposed the private panel.");
          view.returnEntryVerified = true;
        } catch (error) {
          find(
            "interaction",
            "error",
            { route, state: view.state },
            "Moderation guest flow failed: " + error.message,
            "Check the private panel boundary, sign-in action and local moderation return.",
          );
        }
        report.axes.interaction.metrics["moderationViewOpened"] =
          view.state === "unexpected-private-panel";
        report.axes.interaction.metrics["moderationViewAfterClick"] = view;
        if (new URL(page.url()).pathname !== route) {
          await page.goto(new URL(route, origin).href, { waitUntil: "domcontentloaded" });
        }
      } else {
        find(
          "interaction",
          "error",
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
    if (route === "/auth") await waitForAuthView(page);
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

  // A clean first visit must leave both the privacy decision and the fixed
  // career navigation usable, even when accessible text doubles the nav rows.
  for (const { width, textSize } of [
    { width: 390, textSize: "normal" },
    { width: 320, textSize: "xlarge" },
  ]) {
    const consentContext = await browser.newContext({
      locale: "pt-BR",
      viewport: { width, height: 844 },
      reducedMotion: "reduce",
      deviceScaleFactor: 1,
      serviceWorkers: "block",
    });
    try {
      await consentContext.addInitScript((size) => {
        localStorage.setItem("manager3d.accessibility.v1", JSON.stringify({ textSize: size }));
      }, textSize);
      const consentPage = await consentContext.newPage();
      consentPage.on("pageerror", (error) => {
        pageErrors.push({
          url: consentPage.url(),
          message: String(error.message).slice(0, 260),
          stack: String(error.stack ?? "").slice(0, 900),
        });
      });
      const response = await consentPage.goto(new URL("/dashboard", origin).href, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
      if (!response?.ok()) throw new Error("Anonymous dashboard did not load");
      await consentPage
        .locator("#career-content h1")
        .waitFor({ state: "visible", timeout: 20_000 });
      const banner = consentPage.locator("[data-pfm-consent-banner]");
      const nav = consentPage.locator(".career-bottom-nav");
      await banner.waitFor({ state: "visible" });
      await nav.waitFor({ state: "visible" });
      await consentPage.waitForFunction(
        (size) => {
          const outlet = document.getElementById("conteudo");
          const footer = document.querySelector(".career-bottom-nav");
          return (
            outlet &&
            footer &&
            document.documentElement.dataset.textSize === size &&
            Math.abs(
              parseFloat(outlet.style.getPropertyValue("--pfm-career-nav-height")) -
                footer.getBoundingClientRect().height,
            ) < 1
          );
        },
        textSize,
        { timeout: 12_000 },
      );
      const layout = await consentPage.evaluate(() => {
        const notice = document.querySelector("[data-pfm-consent-banner]");
        const nav = document.querySelector(".career-bottom-nav");
        const menu = nav.querySelector("button");
        const b = notice.getBoundingClientRect();
        const n = nav.getBoundingClientRect();
        const m = menu.getBoundingClientRect();
        const target = document.elementFromPoint((m.left + m.right) / 2, (m.top + m.bottom) / 2);
        return {
          gapPx: n.top - b.bottom,
          menuHit: Boolean(target && menu.contains(target)),
          bannerHeight: b.height,
          navHeight: n.height,
          overflowPx: document.documentElement.scrollWidth - innerWidth,
        };
      });
      report.axes.responsive.metrics[`dashboard-consent-${width}-${textSize}`] = layout;
      await png(consentPage, `dashboard-consent-${width}-${textSize}`);
      if (layout.gapPx < 5 || !layout.menuHit || layout.overflowPx > 2) {
        throw new Error("First-visit consent obscures the fixed career navigation or overflows");
      }
      await nav.locator("button").click();
      const menu = consentPage.locator("#career-mobile-menu");
      await menu.waitFor({ state: "visible" });
      await consentPage.keyboard.press("Escape");
      await menu.waitFor({ state: "hidden" });
      await banner.getByRole("button", { name: "Só o essencial", exact: true }).click();
      await banner.waitFor({ state: "hidden" });
      report.axes.interaction.metrics[`dashboard-consent-${width}-${textSize}`] = {
        menuOpenedAndClosed: true,
        dismissed: true,
      };
    } catch (error) {
      find(
        "interaction",
        "error",
        { route: "/dashboard", width, textSize },
        String(error.message || error).slice(0, 300),
        "Keep the first-visit consent controls and measured mobile navigation independently reachable.",
      );
    } finally {
      await consentContext.close();
    }
  }

  // Full athlete Studio lives in the isolated 3D build, not in a public
  // SSR route. Only a credential-free loopback fixture is accepted.
  await page.setViewportSize({ width: 1365, height: 900 });
  const studioResponse = await page.goto(studioUrl.href, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  if (studioResponse?.status() !== 200) {
    throw new Error("Isolated athlete Studio returned HTTP " + studioResponse?.status());
  }
  const framing = page.locator("select").filter({
    has: page.locator('option[value="body"]'),
  });
  await framing.waitFor({ state: "visible", timeout: 25_000 });
  const canvas = page.locator("canvas").first();
  await canvas.waitFor({ state: "visible", timeout: 25_000 });
  await framing.selectOption("face");
  await page.waitForTimeout(1_200);
  const framebuffer = await canvas.evaluate((element) => ({
    width: element.width,
    height: element.height,
  }));
  if (!framebuffer.width || !framebuffer.height) {
    throw new Error("The real athlete Studio did not initialize a framebuffer.");
  }
  await png(page, "player-studio-face-detailed");
  // The Studio is localized; compare the actual pressed state instead of
  // assuming an English accessible name in a pt-BR browser context.
  const comparison = page.locator(".studio-view-actions button[aria-pressed]").last();
  await comparison.waitFor({ state: "visible" });
  if ((await comparison.getAttribute("aria-pressed")) !== "false") {
    throw new Error("Athlete Studio did not start with the detailed rig.");
  }
  await comparison.click();
  if ((await comparison.getAttribute("aria-pressed")) !== "true") {
    throw new Error("Athlete Studio did not switch to the lightweight rig.");
  }
  await page.waitForTimeout(700);
  await png(page, "player-studio-face-lightweight");
  await framing.selectOption("hands");
  await page.waitForTimeout(650);
  await png(page, "player-studio-hands-lightweight");
  report.axes.interaction.metrics.playerStudio = {
    status: "captured",
    source: "/player-studio.html",
    framebuffer,
    comparisons: ["face-detailed", "face-lightweight", "hands-lightweight"],
  };

  const quickMatchRoute = "/partida-rapida?q=baixa";
  for (const viewport of [
    { width: 1365, height: 900 },
    { width: 375, height: 812 },
    { width: 320, height: 700 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    const response = await page.goto(new URL(quickMatchRoute, origin).href, {
      waitUntil: "domcontentloaded",
    });
    if (response?.status() !== 200) throw new Error("Quick match selection did not load");
    await page.getByRole("heading", { level: 1, name: "Partida rápida", exact: true }).waitFor();
    const pick = page.getByLabel("Seu time", { exact: true });
    // The club list is populated asynchronously after the page heading appears.
    // Wait for the third enabled option rather than sampling the list too early.
    const thirdEnabledClub = pick.locator("option:not([disabled])").nth(2);
    await thirdEnabledClub.waitFor({ state: "attached", timeout: 15_000 });
    const nextClub = await thirdEnabledClub.getAttribute("value");
    if (!nextClub) throw new Error("Quick match roster options did not load");
    await pick.selectOption(nextClub);
    if ((await page.locator("html").getAttribute("lang")) !== "pt-BR") {
      throw new Error("Quick match selection did not retain pt-BR after hydration");
    }
    await png(page, `quick-match-selection-${viewport.width}`);
    await page.getByRole("button", { name: "Jogar", exact: true }).click();
    const scoreboard = page.locator(".match-scoreboard-quick");
    await scoreboard.waitFor({ timeout: 45_000 });
    const pause = page.getByRole("button", { name: "Pausar partida", exact: true });
    await pause.focus();
    await pause.press("Enter");
    const resume = page.getByRole("button", { name: "Retomar partida", exact: true });
    await resume.waitFor();
    const trigger = page.getByRole("button", { name: "Opções da partida", exact: true });
    await trigger.click();
    const options = page.locator("#match-quick-tools");
    await options.waitFor();
    const speed = page.getByRole("combobox", { name: "Velocidade", exact: true });
    await speed.selectOption("4");
    const camera = page.getByRole("combobox", { name: "Câmera da partida", exact: true });
    const beforeCamera = await camera.inputValue();
    const secondCamera = await camera.locator("option").nth(1).getAttribute("value");
    if (!secondCamera || beforeCamera === secondCamera)
      throw new Error("Camera preset unavailable");
    await camera.selectOption(secondCamera);
    const shortcuts = options.getByRole("button", { name: "Atalhos de teclado", exact: true });
    await shortcuts.click();
    const shortcutDialog = page.getByRole("dialog", {
      name: "Atalhos de teclado",
      exact: true,
    });
    await shortcutDialog.waitFor();
    await page.keyboard.press("1");
    if (
      (await page.locator(".match-quick-speed").inputValue()) !== "4" ||
      (await page.locator(".match-quick-camera").inputValue()) !== secondCamera
    )
      throw new Error("Match shortcuts changed state while the keyboard guide was open");
    await page.keyboard.press("Escape");
    await shortcutDialog.waitFor({ state: "hidden" });
    await options.waitFor();
    await png(page, `quick-match-controls-${viewport.width}`);
    await options.getByRole("button", { name: "Lances recentes", exact: true }).click();
    const events = page.getByRole("log", { name: "Lances recentes", exact: true });
    await events.waitFor();
    const matchesViewport = await page.evaluate(() =>
      [".match-scoreboard-quick", ".match-quick-transport", ".match-quick-feed"].every(
        (selector) => {
          const el = document.querySelector(selector);
          if (!el) return false;
          const box = el.getBoundingClientRect();
          return (
            box.left >= -1 &&
            box.right <= innerWidth + 1 &&
            box.bottom <= innerHeight + 1 &&
            el.scrollWidth <= el.clientWidth + 1
          );
        },
      ),
    );
    if (!matchesViewport) throw new Error(`Quick match controls overflowed at ${viewport.width}px`);
    await events.getByRole("button", { name: "Fechar", exact: true }).click();
    if (!(await trigger.evaluate((element) => element === document.activeElement)))
      throw new Error("Closing the match feed did not restore keyboard focus");
    const matchEvidence = { passed: true, locale: "pt-BR" };
    if (viewport.width === 375) {
      const clock = /, Minuto (\d+)$/.exec((await scoreboard.getAttribute("aria-label")) ?? "");
      if (!clock) throw new Error("Missing Portuguese score clock");
      const before = Number(clock[1]);
      await speed.selectOption("8");
      await resume.press("Enter");
      await pause.waitFor();
      const advanced = await page.waitForFunction(
        (previous) => {
          const label = document
            .querySelector(".match-scoreboard-quick")
            ?.getAttribute("aria-label");
          const minute = /, Minuto (\d+)$/.exec(label ?? "");
          return minute && Number(minute[1]) > previous ? Number(minute[1]) : false;
        },
        before,
        { timeout: 20_000 },
      );
      matchEvidence.clock = { before, after: await advanced.jsonValue() };
      await advanced.dispose();
      const essential = page.getByRole("button", { name: "Só o essencial", exact: true });
      if (await essential.isVisible()) await essential.click();
      await trigger.click();
      await options.getByRole("button", { name: "Pular para o fim", exact: true }).click();
      const fullTime = page.getByRole("dialog", { name: "Fim de jogo", exact: true });
      await fullTime.waitFor({ timeout: 45_000 });
      if (await fullTime.getByRole("complementary", { name: "Salvar carreira na nuvem" }).count()) {
        throw new Error("Quick match report unexpectedly offered career cloud saving");
      }
      await png(page, "quick-match-full-time-375");
      await fullTime
        .getByRole("button", { name: "Voltar à escolha de times", exact: true })
        .click();
      matchEvidence.fullTimeReturnedToSelection = true;
    } else {
      await page.getByRole("button", { name: "Voltar à escolha de times", exact: true }).click();
    }
    await page.locator("#quick-league").waitFor();
    report.axes.interaction.metrics[`quickMatch${viewport.width}`] = matchEvidence;
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
      item.requiredTexture ? "error" : "warning",
      { route: item.route, asset: item.asset },
      "Resource failed: " + (item.status ?? item.error),
      "Check file URL, caching and content type. Compare the network waterfall before changing the code.",
    );
  }
  report.axes.runtime.metrics.pageErrors = pageErrors.length;
  report.axes.runtime.metrics.consoleErrors = consoleErrors.length;
  report.axes.network.metrics.failed = networkFailures.length;
  report.axes.network.metrics.loadedStudioTextures = loadedStudioTextures.size;
  if (!loadedStudioTextures.size) {
    find(
      "network",
      "error",
      { route: studioUrl.pathname },
      "The athlete Studio loaded no public KTX2 textures.",
      "Verify texture loading and the prepared fixture before certifying athlete materials.",
    );
  }

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
    ["diff", "--name-only", "-z", "--diff-filter=ACMR", "origin/main...HEAD"],
    { encoding: "utf8", maxBuffer: 5_000_000 },
  )
    .split("\0")
    .filter((p) =>
      /^(src|services|cloudflare|scripts|drizzle)\/.*\.(?:ts|tsx|mjs|js|sql)$/.test(p),
    );
  const committed = committedSourceInventory(sha);
  const staticResults = [];
  let inspected = 0;
  for (const file of files.slice(0, 2000)) {
    const source = committed.read(file, true);
    if (source?.text == null) {
      find(
        "static",
        "warning",
        { file },
        "Committed regular source unavailable or exceeds byte limit.",
        "Review the Git object separately; no checkout file was read.",
      );
      continue;
    }
    inspected++;
    const lines = source.text.split(/\r?\n/);
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
    inspectedChangedCodeFiles: inspected,
    eligibleChangedCodeFiles: files.length,
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
  const committed = committedSourceInventory(sha);
  const inventory = [];
  const infrastructure = [
    ".github/workflows/",
    "drizzle/migrations/",
    "services/match-authority/",
    "cloudflare/",
  ];
  const sensitive =
    /(?:auth|payment|stripe|secret|moderation|realtime|multiplayer|matchmaking|security|ticket|anticheat)/i;
  const visuals =
    /(?:cinematic|stadium|renderer|webgl|webgpu|physics|shaders|texture|graphics|3d)/i;
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
      const info = committed.read(
        file,
        /\.(?:ts|tsx|mjs|js|json|yaml|yml|css|md|sql|html)$/i.test(file),
      );
      if (!info) state = "deleted-or-unavailable";
      else {
        sizeBytes = info.sizeBytes;
        if (info.text !== null) lineCount = info.text.split(/\r?\n/).length;
      }
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
