import { afterEach, describe, expect, it, vi } from "vitest";
import { createCspNonce, secureResponse } from "./security-headers";
import { publicPageRedirect } from "./public-page-redirects";
import { renderErrorPage } from "./error-page";
const deps = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("@tanstack/react-start/server-entry", () => ({ default: { fetch: deps.fetch } }));
import server from "../server";
afterEach(() => vi.restoreAllMocks());

describe("outer response protection", () => {
  it("removes only stale noindex, follow from the six verified indexable public pages", async () => {
    const paths = [
      "/jogo-de-manager-de-futebol",
      "/tabelas",
      "/mercado-de-transferencias",
      "/melhores-formacoes",
      "/guia-de-scouting",
      "/dicas-de-gestao",
    ];
    for (const path of paths) {
      for (const method of ["GET", "HEAD"]) {
        const response = secureResponse(
          new Response("<html><h1>Public content</h1></html>", {
            status: 200,
            headers: {
              "content-type": "text/html; charset=utf-8",
              "x-robots-tag": "noindex, follow",
            },
          }),
          new Request(`https://jogomanager.com${path}?utm_source=test`, { method }),
        );
        expect(response.status, path).toBe(200);
        expect(response.headers.get("x-robots-tag"), `${method} ${path}`).toBeNull();
        expect(response.headers.get("x-content-type-options")).toBe("nosniff");
        if (method === "HEAD") expect(await response.text()).toBe("");
      }
    }
  });

  it("does not remove intentional indexing restrictions or index error/private responses", () => {
    const cases = [
      { path: "/auth", status: 200, incoming: "noindex, follow", expected: "noindex, nofollow" },
      {
        path: "/tabelas/brasileirao-serie-a",
        status: 500,
        incoming: "noindex, follow",
        expected: "noindex, nofollow",
      },
      {
        path: "/guia-de-scouting",
        status: 503,
        incoming: "noindex, follow",
        expected: "noindex, nofollow",
      },
      {
        path: "/guia-de-scouting",
        status: 302,
        incoming: "noindex, follow",
        expected: "noindex, follow",
      },
      {
        path: "/unknown-public-alias",
        status: 200,
        incoming: "noindex, follow",
        expected: "noindex, follow",
      },
      {
        path: "/melhores-formacoes",
        status: 200,
        incoming: "googlebot: noindex",
        expected: "googlebot: noindex",
      },
      {
        path: "/melhores-formacoes",
        status: 200,
        incoming: "nosnippet",
        expected: "nosnippet",
      },
    ];
    for (const entry of cases) {
      const response = secureResponse(
        new Response(null, {
          status: entry.status,
          headers: {
            "content-type": "text/html; charset=utf-8",
            "x-robots-tag": entry.incoming,
          },
        }),
        new Request(`https://jogomanager.com${entry.path}`),
      );
      expect(response.headers.get("x-robots-tag"), entry.path).toBe(entry.expected);
    }
  });

  it("keeps noindex on other methods, non-HTML and stronger directives", () => {
    const cases = [
      { method: "POST", contentType: "text/html", robots: "noindex, follow" },
      { method: "GET", contentType: "application/json", robots: "noindex, follow" },
      { method: "GET", contentType: "text/html", robots: "noindex, nofollow" },
      { method: "HEAD", contentType: "text/html", robots: "noindex" },
    ];
    for (const { method, contentType, robots } of cases) {
      const response = secureResponse(
        new Response("public resource", {
          status: 200,
          headers: { "content-type": contentType, "x-robots-tag": robots },
        }),
        new Request("https://jogomanager.com/melhores-formacoes", { method }),
      );
      expect(response.status).toBe(200);
      expect(response.headers.get("x-robots-tag"), `${method} ${contentType}`).toBe(robots);
    }
  });

  it("adds protections to recovered h3 failures and thrown failures", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    for (const fail of [false, true]) {
      deps.fetch.mockImplementation(async () => {
        if (fail) throw new Error("private details");
        return Response.json({ unhandled: true, message: "HTTPError" }, { status: 500 });
      });
      const response = await server.fetch(new Request("https://jogomanager.com/dashboard"), {}, {});
      expect(response.status).toBe(500);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
      expect(response.headers.get("content-security-policy")).toContain("object-src 'none'");
      const html = await response.text();
      expect(html).toContain('lang="pt-BR"');
      expect(html).not.toContain("private details");
    }
  });
  it("replaces an incoming nonce with a new server nonce and keeps the strict policy report-only", async () => {
    deps.fetch.mockResolvedValue(
      new Response("<html></html>", { headers: { "content-type": "text/html" } }),
    );
    const response = await server.fetch(
      new Request("https://jogomanager.com/", { headers: { "x-manager-csp-nonce": "attacker" } }),
      {},
      {},
    );
    const request = deps.fetch.mock.calls.at(-1)![0] as Request;
    const nonce = request.headers.get("x-manager-csp-nonce");
    expect(nonce).toMatch(/^[A-Za-z0-9+/]{32}$/);
    expect(nonce).not.toBe("attacker");
    const report = response.headers.get("content-security-policy-report-only")!;
    expect(report).toContain(`'nonce-${nonce}'`);
    expect(report).toContain("'wasm-unsafe-eval'");
    expect(report).not.toContain("'unsafe-eval'");
    expect(report).not.toContain("'unsafe-inline' https://js.stripe.com");
    expect(createCspNonce()).not.toBe(nonce);
  });
  it("disallows HTML event-handler scripts and limits web app manifests in both CSP modes", () => {
    for (const path of ["/", "/auth", "/checkout/return"]) {
      const response = secureResponse(
        new Response("<html></html>", {
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
        new Request(`https://jogomanager.com${path}`),
        createCspNonce(),
      );
      for (const name of ["content-security-policy", "content-security-policy-report-only"]) {
        const csp = response.headers.get(name);
        expect(csp, `${path} ${name}`).toContain("script-src-attr 'none'");
        expect(csp, `${path} ${name}`).toContain("manifest-src 'self'");
        expect(csp, `${path} ${name}`).toContain("object-src 'none'");
      }
      // Existing SSR injects inline script blocks: migration to nonce enforcement
      // must be staged and browser-tested rather than silently breaking auth/Stripe.
      expect(response.headers.get("content-security-policy")).toContain("'unsafe-inline'");
    }
  });

  it("exposes initial SSR duration without weakening private cache protection", async () => {
    deps.fetch.mockResolvedValue(
      new Response("<html></html>", {
        headers: { "content-type": "text/html" },
      }),
    );
    const response = await server.fetch(new Request("https://jogomanager.com/auth"), {}, {});
    expect(response.headers.get("server-timing")).toMatch(/app;dur=\d+(?:\.\d+)?/);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-security-policy")).toContain("object-src 'none'");
  });

  it("rebuilds a cross-realm Request from public fields before SSR", async () => {
    deps.fetch.mockResolvedValue(new Response("ok", { headers: { "content-type": "text/html" } }));
    // h3/Vite may expose a Request-like object whose internal Undici state
    // cannot be cloned with `new Request(request)`. Its public request
    // contract is sufficient for the server entry.
    const crossRealmRequest = {
      url: "https://jogomanager.com/",
      method: "GET",
      headers: new Headers({ "x-manager-csp-nonce": "attacker" }),
      body: null,
    } as unknown as Request;

    const response = await server.fetch(crossRealmRequest, {}, {});
    const forwarded = deps.fetch.mock.calls.at(-1)![0] as Request;

    expect(response.status).toBe(200);
    expect(forwarded).toBeInstanceOf(Request);
    expect(forwarded.url).toBe("https://jogomanager.com/");
    expect(forwarded.headers.get("x-manager-csp-nonce")).not.toBe("attacker");
  });
  it("never caches private HTML, authorized responses, API errors or cookie-bearing responses", () => {
    for (const path of ["/dashboard", "/compras", "/auth", "/checkout/return"]) {
      expect(
        secureResponse(
          new Response("ok", {
            headers: { "content-type": "text/html", "cache-control": "public, max-age=3600" },
          }),
          new Request(`https://jogomanager.com${path}`),
        ).headers.get("cache-control"),
      ).toBe("no-store");
    }
    const error = secureResponse(
      Response.json({ error: true }, { status: 503 }),
      new Request("https://jogomanager.com/api/health"),
    );
    expect(error.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    const authorized = secureResponse(
      new Response("ok"),
      new Request("https://jogomanager.com/assets/public.js", {
        headers: { authorization: "Bearer fixture" },
      }),
    );
    expect(authorized.headers.get("cache-control")).toBe("no-store");
  });
  it("lets the edge keep public HTML for 5 minutes while browsers always revalidate", () => {
    const page = secureResponse(
      new Response("page", { headers: { "content-type": "text/html" } }),
      new Request("https://jogomanager.com/produtos"),
    );
    expect(page.headers.get("cache-control")).toBe(
      "public, max-age=0, s-maxage=300, stale-while-revalidate=86400",
    );
  });
  it("overrides framework revalidation on anonymous public HTML only", () => {
    const run = (cache: string, headers: HeadersInit = {}, method = "GET") =>
      secureResponse(
        new Response("page", { headers: { "content-type": "text/html", "cache-control": cache } }),
        new Request("https://jogomanager.com/", { headers, method }),
      ).headers.get("cache-control");
    expect(run("no-cache, must-revalidate, max-age=0")).toContain("s-maxage=300");
    expect(run("private, max-age=0")).toBe("private, max-age=0");
    expect(run("no-store")).toBe("no-store");
    expect(run("no-cache", { cookie: "session=fixture" })).toBe("no-store");
    expect(run("no-cache", {}, "POST")).toBe("no-store");
  });
  it("preserves static caching and public indexing and implements bodyless HEAD", async () => {
    const asset = secureResponse(
      new Response("asset"),
      new Request("https://jogomanager.com/assets/main-abc12345.js"),
    );
    expect(asset.headers.get("cache-control")).toContain("immutable");
    const page = secureResponse(
      new Response("page", { headers: { "content-type": "text/html" } }),
      new Request("http://localhost:3000/taticas-e-formacoes", { method: "HEAD" }),
    );
    expect(page.headers.get("x-robots-tag")).toBe("noindex, follow");
    expect(page.headers.get("strict-transport-security")).toBeNull();
    expect(await page.text()).toBe("");
  });
  it("consolidates retired URLs before SSR, preserving the safe method boundary", async () => {
    for (const [path, target] of [
      ["/gestao-financeira", "/dicas-de-gestao"],
      ["/soccer-manager-online/", "/jogo-de-manager-de-futebol"],
      ["/taticas-e-formacoes", "/melhores-formacoes"],
    ]) {
      const response = await server.fetch(
        new Request(`https://jogomanager.com${path}?utm_source=fixture`),
        {},
        {},
      );
      expect(response.status).toBe(301);
      expect(response.headers.get("location")).toBe(`${target}?utm_source=fixture`);
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    }
    expect(
      publicPageRedirect(
        new Request("https://jogomanager.com/taticas-e-formacoes", { method: "POST" }),
      ),
    ).toBeUndefined();
    expect(publicPageRedirect(new Request("https://jogomanager.com/constructor"))).toBeUndefined();
    expect(renderErrorPage()).not.toContain("onclick=");
  });
});
