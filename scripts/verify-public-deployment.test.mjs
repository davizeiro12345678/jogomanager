import { test } from "node:test";
import assert from "node:assert/strict";
import { verifyPublicDeployment } from "./verify-public-deployment.mjs";
import { verifyPublicSeo } from "./verify-public-seo.mjs";

const EXPECTED_SHA = "0123456789abcdef0123456789abcdef01234567";
const OLD_SHA = "fedcba9876543210fedcba9876543210fedcba98";

function verifyExpectedDeployment(options) {
  return verifyPublicDeployment({ expectedSha: EXPECTED_SHA, ...options });
}

function response(body, { type = "text/html", status = 200, url = "" } = {}) {
  const result = new Response(body, { status, headers: { "content-type": type } });
  Object.defineProperty(result, "url", { value: url });
  return result;
}

function successfulResponse(url) {
  return url.endsWith("/api/health")
    ? response(JSON.stringify({ status: "ready", release: { commit: EXPECTED_SHA } }), {
        type: "application/json",
      })
    : response("<title>Pro Football Manager 3D</title>", {
        url: url.startsWith("https://www.") ? "https://jogomanager.com/" : url,
      });
}

test("checks public health, apex, and the canonical www redirect without credentials", async () => {
  const calls = [];
  const reports = [];
  await verifyExpectedDeployment({
    expectedSha: EXPECTED_SHA,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return successfulResponse(url);
    },
    report: (message) => reports.push(message),
  });
  assert.equal(calls.length, 3);
  assert.deepEqual(
    calls.map((call) => call.options.redirect),
    ["manual", "manual", "follow"],
  );
  for (const { options } of calls) {
    assert.deepEqual(options.headers, { "cache-control": "no-cache" });
    assert.ok(options.signal instanceof AbortSignal);
  }
  assert.equal(reports.length, 3);
});

test("rejects a healthy server running an older commit", async () => {
  await assert.rejects(
    verifyExpectedDeployment({
      expectedSha: EXPECTED_SHA,
      fetchImpl: async (url) =>
        url.endsWith("/api/health")
          ? response(JSON.stringify({ status: "ready", release: { commit: OLD_SHA } }), {
              type: "application/json",
            })
          : successfulResponse(url),
      report() {},
    }),
    /deployed commit does not match/,
  );
});

test("rejects a healthy server without build identity", async () => {
  await assert.rejects(
    verifyExpectedDeployment({
      expectedSha: EXPECTED_SHA,
      fetchImpl: async (url) =>
        url.endsWith("/api/health")
          ? response('{"status":"ready"}', { type: "application/json" })
          : successfulResponse(url),
      report() {},
    }),
    /missing or invalid deployed commit/,
  );
});

for (const expectedSha of [undefined, "", "main", "0123456", "https://example.test"]) {
  test(`requires a full expected Git SHA before making requests: ${expectedSha}`, async () => {
    let requested = false;
    await assert.rejects(
      verifyExpectedDeployment({
        expectedSha,
        fetchImpl: async (url) => {
          requested = true;
          return successfulResponse(url);
        },
        report() {},
      }),
      /expected commit must be a full/,
    );
    assert.equal(requested, false);
  });
}

for (const status of [302, 401, 500]) {
  test(`rejects HTTP ${status} instead of calling a deployment healthy`, async () => {
    await assert.rejects(
      verifyExpectedDeployment({ fetchImpl: async () => response("", { status }), report() {} }),
      new RegExp(`got ${status}`),
    );
  });
}

for (const url of [
  "https://team.cloudflareaccess.com/login",
  "https://cloudflareaccess.com/login",
  "https://jogomanager.com/cdn-cgi/access/login",
]) {
  test(`rejects a 200 response redirected to Access: ${url}`, async () => {
    await assert.rejects(
      verifyExpectedDeployment({
        fetchImpl: async () => response('{"status":"ready"}', { type: "application/json", url }),
        report() {},
      }),
      /redirected to Cloudflare Access/,
    );
  });
}

function seoSite(overrides = {}) {
  const pages = {
    "/sitemap.xml": response(
      "<urlset><url><loc>https://jogomanager.com/</loc></url><url><loc>https://jogomanager.com/tabelas/liga</loc></url></urlset>",
      { type: "application/xml" },
    ),
    "/": response(
      '<html><head><link rel="canonical" href="https://jogomanager.com/"></head><body><a href="/tabelas/liga#classificacao">Liga</a><a href="/guia">Guia</a><a href="/checkout/return?claim=private">Compra</a><a href="https://external.example/">Fonte</a></body></html>',
    ),
    "/tabelas/liga": response(
      "<html><head><link href='https://jogomanager.com/tabelas/liga' rel='canonical'></head><body><a href='/guia#resumo'>Guia</a></body></html>",
    ),
    "/guia": response("<html><body>Guia de futebol</body></html>"),
    ...overrides,
  };
  const calls = [];
  return {
    calls,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      const key = new URL(url).pathname;
      const result = pages[key];
      assert.ok(result, `Unexpected request: ${url}`);
      return result.clone();
    },
  };
}

test("checks sitemap HTML and deduplicated public links without crawling external or transactional URLs", async () => {
  const site = seoSite();
  const result = await verifyPublicSeo({ ...site, report() {} });
  assert.equal(result.sitemapPages, 2);
  assert.equal(result.linkedPages, 1);
  assert.equal(result.failures.length, 0);
  assert.deepEqual(site.calls.map(({ url }) => new URL(url).pathname).sort(), [
    "/",
    "/guia",
    "/sitemap.xml",
    "/tabelas/liga",
  ]);
  for (const { options } of site.calls) {
    assert.equal(options.redirect, "manual");
    assert.ok(options.signal instanceof AbortSignal);
    assert.equal(options.headers["cache-control"], "no-cache");
    assert.match(options.headers["user-agent"], /JogoManager-Public-SEO/);
    assert.equal(options.headers.cookie, undefined);
    assert.equal(options.headers.authorization, undefined);
  }
});

test("reports all server failures and noindex sitemap pages in one failed audit", async () => {
  const unavailable = response("<html>Unavailable</html>", { status: 500 });
  const blocked = response('<link rel="canonical" href="https://jogomanager.com/">');
  blocked.headers.set("x-robots-tag", "noindex, follow");
  const site = seoSite({ "/": blocked, "/tabelas/liga": unavailable });
  await assert.rejects(verifyPublicSeo({ ...site, report() {} }), (error) => {
    assert.equal(error.result.failures.length, 2);
    assert.match(error.message, /noindex/);
    assert.match(error.message, /HTTP 500/);
    return true;
  });
});

for (const html of [
  '<meta content="noindex,follow" name="robots"><link rel="canonical" href="https://jogomanager.com/">',
  '<meta name="googlebot" content="none"><link rel="canonical" href="https://jogomanager.com/">',
  '<link rel="canonical" href="https://jogomanager.com/old">',
  "<html><head><title>Just a moment...</title></head></html>",
]) {
  test(`rejects index-blocking or missing/wrong canonical HTML: ${html.slice(0, 45)}`, async () => {
    const site = seoSite({ "/": response(html) });
    await assert.rejects(verifyPublicSeo({ ...site, report() {} }), /noindex|canonical/);
  });
}

test("rejects a broken internal link found on a healthy sitemap page", async () => {
  const site = seoSite({ "/guia": response("Not found", { status: 404 }) });
  await assert.rejects(verifyPublicSeo({ ...site, report() {} }), /\/guia.*HTTP 404/);
});

test("does not follow a redirected sitemap entry or an off-site internal link redirect", async () => {
  const redirected = response("", { status: 301 });
  redirected.headers.set("location", "https://external.example/login");
  const site = seoSite({ "/tabelas/liga": redirected, "/guia": redirected });
  await assert.rejects(verifyPublicSeo({ ...site, report() {} }), (error) => {
    assert.match(error.message, /sitemap.*HTTP 301/);
    assert.match(error.message, /outside the canonical origin/);
    return true;
  });
  assert.ok(site.calls.every(({ url }) => new URL(url).origin === "https://jogomanager.com"));
});

test("follows bounded same-origin link redirects and checks their final status", async () => {
  const redirected = response("", { status: 301 });
  redirected.headers.set("location", "/tabelas/liga");
  const site = seoSite({ "/guia": redirected });
  const result = await verifyPublicSeo({ ...site, report() {} });
  assert.equal(result.failures.length, 0);
  assert.equal(site.calls.filter(({ url }) => url.endsWith("/guia")).length, 1);
});

test("fails closed instead of truncating an oversized sitemap or link inventory", async () => {
  await assert.rejects(verifyPublicSeo({ ...seoSite(), maxPages: 1, report() {} }), /page limit/);
  await assert.rejects(verifyPublicSeo({ ...seoSite(), maxPages: 2, report() {} }), /page limit/);
});

test("ignores script text that resembles links and decodes HTML link attributes", async () => {
  const site = seoSite({
    "/": response(
      '<link rel="canonical" href="https://jogomanager.com/"><script>const example = \'<a href="/fake">\';</script><a href="/guia?x=1&amp;y=2#section">Guia</a>',
    ),
  });
  await verifyPublicSeo({ ...site, report() {} });
  assert.ok(site.calls.some(({ url }) => url === "https://jogomanager.com/guia?x=1&y=2"));
  assert.ok(site.calls.every(({ url }) => !url.includes("/fake")));
});

for (const loc of [
  "http://jogomanager.com/",
  "https://www.jogomanager.com/",
  "https://external.example/",
  "https://jogomanager.com/checkout/return?claim=private",
]) {
  test(`refuses unsafe or noncanonical sitemap destinations before fetching them: ${loc}`, async () => {
    const site = seoSite({
      "/sitemap.xml": response(`<urlset><url><loc>${loc}</loc></url></urlset>`, {
        type: "application/xml",
      }),
    });
    await assert.rejects(verifyPublicSeo({ ...site, report() {} }), /canonical|transactional/);
    assert.equal(site.calls.length, 1);
  });
}

for (const body of [
  "Cloudflare Access",
  "/cdn-cgi/access/login",
  "Log in to private Cloudflare Workers",
]) {
  test(`rejects an Access page with HTTP 200: ${body}`, async () => {
    await assert.rejects(
      verifyExpectedDeployment({ fetchImpl: async () => response(body), report() {} }),
      /login page served/,
    );
  });
}

test("rejects degraded backend health", async () => {
  await assert.rejects(
    verifyExpectedDeployment({
      fetchImpl: async () => response('{"status":"degraded"}', { type: "application/json" }),
      report() {},
    }),
    /backend health is not ready/,
  );
});

test("rejects HTML masquerading as a JSON health endpoint", async () => {
  await assert.rejects(
    verifyExpectedDeployment({
      fetchImpl: async () => response('{"status":"ready"}'),
      report() {},
    }),
    /expected JSON health/,
  );
});

test("rejects an unexpected homepage after health passes", async () => {
  await assert.rejects(
    verifyExpectedDeployment({
      fetchImpl: async (url) =>
        url.endsWith("/api/health")
          ? successfulResponse(url)
          : response("<title>Unknown site</title>"),
      report() {},
    }),
    /expected public game HTML/,
  );
});

for (const url of [
  "https://legacy-origin.example.invalid/",
  "http://jogomanager.com/",
  "https://www.jogomanager.com:8443/",
]) {
  test(`rejects a canonical redirect outside the intended HTTPS origins: ${url}`, async () => {
    await assert.rejects(
      verifyExpectedDeployment({
        fetchImpl: async (requestedUrl) =>
          requestedUrl.startsWith("https://www.")
            ? response("<title>Pro Football Manager 3D</title>", { url })
            : successfulResponse(requestedUrl),
        report() {},
      }),
      /unexpected public origin/,
    );
  });
}

test("includes a safe CF-Ray correlation ID when the edge or origin returns HTTP 403", async () => {
  const forbidden = response("Forbidden", { status: 403 });
  forbidden.headers.set("cf-ray", "a5a8a141396f1fa0-GIG");
  forbidden.headers.set("cf-mitigated", "challenge");
  await assert.rejects(
    verifyExpectedDeployment({ fetchImpl: async () => forbidden, report() {} }),
    /got 403 \[CF-Ray: a5a8a141396f1fa0-GIG; Cloudflare challenge: yes;/,
  );
});

test("redacts untrusted 403 headers instead of logging arbitrary response data", async () => {
  const forbidden = response("sensitive origin error body", { status: 403 });
  forbidden.headers.set("cf-ray", "secret-invalid-id");
  forbidden.headers.set("server", "internal-private-server");
  await assert.rejects(
    verifyExpectedDeployment({ fetchImpl: async () => forbidden, report() {} }),
    (error) => {
      assert.match(error.message, /got 403 \[CF-Ray: unavailable; Cloudflare challenge: no;/);
      assert.doesNotMatch(error.message, /secret-invalid-id|internal-private-server|sensitive/);
      return true;
    },
  );
});
