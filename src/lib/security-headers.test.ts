import { afterEach, describe, expect, it, vi } from "vitest";
import { createCspNonce, secureResponse } from "./security-headers";
import { publicPageRedirect } from "./public-page-redirects";
import { renderErrorPage } from "./error-page";
const deps = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("@tanstack/react-start/server-entry", () => ({ default: { fetch: deps.fetch } }));
import server from "../server";
afterEach(() => vi.restoreAllMocks());

describe("outer response protection", () => {
  it("discovers home's bold action weight without duplicating font hints", () => {
    const request = new Request("https://jogomanager.com/");
    const once = secureResponse(
      new Response("home", { headers: { "content-type": "text/html" } }),
      request,
    );
    const link = secureResponse(once, request).headers.get("link")!;
    expect(link.match(/as=font/g)).toHaveLength(3);
    expect(link).toContain("5aU19_a8oxmIfNJdERySjQ.woff2");
  });
  it("preloads the server's exact public CSS asset once without replacing other hints", () => {
    const request = new Request("https://jogomanager.com/");
    const html = new Response("<html></html>", {
      headers: { "content-type": "text/html", link: "</assets/client.js>; rel=modulepreload" },
    });
    const once = secureResponse(html, request, undefined, "/assets/public-styles-12345678.css");
    const twice = secureResponse(once, request, undefined, "/assets/public-styles-12345678.css");
    const link = twice.headers.get("link")!;
    expect(link.match(/public-styles-12345678/g)).toHaveLength(1);
    expect(link).toContain("</assets/public-styles-12345678.css>; rel=preload; as=style");
    expect(link).toContain("</assets/client.js>; rel=modulepreload");
    expect(
      secureResponse(
        new Response("{}", { headers: { "content-type": "application/json" } }),
        request,
        undefined,
        "/assets/public.css",
      ).headers.get("link"),
    ).toBeNull();
  });

  it("preloads article fonts once while preserving framework Link headers", () => {
    const request = new Request("https://jogomanager.com/guias");
    const response = secureResponse(
      new Response("article", {
        headers: {
          "content-type": "text/html; charset=utf-8",
          link: "</assets/client.js>; rel=modulepreload; as=script",
        },
      }),
      request,
    );
    const link = response.headers.get("link")!;
    expect(link).toContain("</assets/client.js>; rel=modulepreload; as=script");
    expect(link).toContain(
      '</fonts/match3d/5aU69_a8oxmIdGl4BA.woff2>; rel=preload; as=font; type="font/woff2"; crossorigin',
    );
    expect(link.match(/as=font/g)).toHaveLength(2);
    expect(link.match(/crossorigin/g)).toHaveLength(2);
    expect(secureResponse(response, request).headers.get("link")).toBe(link);
  });
  it("does not preload public CSS or fonts for private pages, assets or unsuccessful responses", () => {
    for (const [path, type, status] of [
      ["/dashboard", "text/html", 200],
      ["/guias", "application/json", 200],
      ["/guias", "text/html", 500],
      ["/guias", "text/html", 301],
    ] as const) {
      const response = secureResponse(
        new Response("body", { status, headers: { "content-type": type } }),
        new Request(`https://jogomanager.com${path}`),
        undefined,
        "/assets/public.css",
      );
      expect(response.headers.get("link")).toBeNull();
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
    expect(page.headers.get("x-robots-tag")).toBeNull();
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
