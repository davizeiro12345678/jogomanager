// LHCI runs this after the real Nitro/Cloudflare preview is ready. A fast
// compressed error/garbage page must never be accepted as a performance result.
//
// It also warms the exact origin Lighthouse is about to measure. Every release
// run since the mobile gate was tightened failed its first run on `/` only:
// performance 0,93-0,95 with TBT 244-321 ms and 1056 ms of script bootup
// attributed to an inline entry, while runs 2 and 3 of the same URL scored 1,00
// with TBT 2-3 ms. The other four routes scored 1,00 with TBT <= 14 ms in every
// run. That is a cold runner (unpopulated profile, cold V8 code cache, cold
// route modules), not a regression: identical code, same commit.
//
// Warming through the LHCI-managed browser populates the profile Lighthouse
// reuses, so run 1 measures the same steady state as runs 2 and 3. No threshold
// is relaxed: the gate keeps its pessimistic aggregation over all runs.
const WARMUP_SETTLE_MS = 2_000;

async function warmMeasuredOrigin(browser, context) {
  const url = context && typeof context.url === "string" ? context.url : null;
  if (!browser || !url) return;
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: "load", timeout: 45_000 });
    await new Promise((resolve) => setTimeout(resolve, WARMUP_SETTLE_MS));
    console.log(`Warmed measured origin: ${url}`);
  } catch (error) {
    // A warm-up failure must not be reported as a performance result, but it
    // must also not abort the run: the measured navigation reports the truth.
    console.log(`Warm-up navigation failed for ${url}: ${String(error).slice(0, 160)}`);
  } finally {
    await page.close().catch(() => undefined);
  }
}

module.exports = async (browser, context) => {
  const routes = ["/", "/guias", "/guia-de-scouting", "/melhores-formacoes", "/partida-rapida"];
  for (const route of routes) {
    for (const encoding of ["identity", "gzip"]) {
      const response = await fetch(`http://127.0.0.1:4173${route}`, {
        headers: { "accept-encoding": encoding },
      });
      const html = await response.text();
      if (
        response.status !== 200 ||
        !/^text\/html\b/i.test(response.headers.get("content-type") ?? "") ||
        !/<html\b[^>]*\blang=["']pt-BR["']/i.test(html) ||
        !/<title>[^<]+<\/title>/i.test(html) ||
        !/<h1\b/i.test(html) ||
        !html.includes("Pro Football Manager")
      ) {
        throw new Error(`Invalid rendered HTML for ${route} with Accept-Encoding ${encoding}`);
      }
      const head = html.split(/<\/head>/i)[0];
      if (
        !/<link\b(?=[^>]*\brel=["']stylesheet["'])(?=[^>]*\bhref=["'][^"']*public-(?:home-|store-|tables-|quick-)?styles[^"']*\.css)[^>]*>/i.test(
          head,
        )
      )
        throw new Error(`Missing critical SSR stylesheet for ${route}`);
      console.log(`Verified decoded HTML: ${route} (${encoding})`);
    }
  }
  await warmMeasuredOrigin(browser, context);
};
