import { afterEach, describe, expect, it, vi } from "vitest";
import { createCspNonce, secureResponse } from "./security-headers";
import { publicPageRedirect } from "./public-page-redirects";
import { renderErrorPage } from "./error-page";
const deps = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("@tanstack/react-start/server-entry", () => ({ default: { fetch: deps.fetch } }));
import server from "../server";
afterEach(() => vi.restoreAllMocks());

describe("outer response protection", () => {
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
      ["/jogo-de-manager-de-futebol", "/"],
      ["/soccer-manager-online/", "/"],
      ["/melhores-formacoes", "/taticas-e-formacoes"],
    ]) {
      const response = await server.fetch(
        new Request(`https://jogomanager.com${path}?utm_source=fixture`),
        {},
        {},
      );
      expect(response.status).toBe(301);
      expect(response.headers.get("location")).toBe(target);
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    }
    expect(
      publicPageRedirect(
        new Request("https://jogomanager.com/melhores-formacoes", { method: "POST" }),
      ),
    ).toBeUndefined();
    expect(publicPageRedirect(new Request("https://jogomanager.com/constructor"))).toBeUndefined();
    expect(renderErrorPage()).not.toContain("onclick=");
  });
});
