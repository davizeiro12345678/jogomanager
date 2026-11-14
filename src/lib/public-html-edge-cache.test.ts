import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createAnonymousEdgeHtmlCache,
  isEligibleAnonymousHtmlRequest,
  isStorablePublicHtml,
} from "./public-html-edge-cache";
import { secureResponse } from "./security-headers";

const version = "a".repeat(40);
const html =
  '<!doctype html><meta property="csp-nonce" content="old" nonce="old"/><script nonce="old">window.ready=1;</script>';

class TestHtmlRewriter {
  private handlers: Array<{
    selector: string;
    element: (element: { setAttribute: (name: string, value: string) => void }) => void;
  }> = [];
  on(
    selector: string,
    handlers: {
      element: (element: { setAttribute: (name: string, value: string) => void }) => void;
    },
  ) {
    this.handlers.push({ selector, element: handlers.element });
    return this;
  }
  transform(response: Response) {
    const handlers = this.handlers;
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          let content = await response.text();
          for (const entry of handlers) {
            if (entry.selector === "[nonce]") {
              content = content.replace(/nonce="[^"]*"/g, () => {
                let value = "old";
                entry.element({ setAttribute: (_name, v) => (value = v) });
                return `nonce="${value}"`;
              });
            }
            if (entry.selector === 'meta[property="csp-nonce"]') {
              content = content.replace(
                /(<meta\s+property="csp-nonce"\s+content=")[^"]*(")/,
                (_whole, before: string, after: string) => {
                  let value = "old";
                  entry.element({ setAttribute: (_name, v) => (value = v) });
                  return before + value + after;
                },
              );
            }
          }
          controller.enqueue(new TextEncoder().encode(content));
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });
    return new Response(stream, { headers: response.headers, status: response.status });
  }
}
const request = (path = "/", init: RequestInit = {}) =>
  new Request(`https://jogomanager.com${path}`, init);

afterEach(() => vi.unstubAllGlobals());

describe("anonymous SSR edge cache safety", () => {
  it("accepts only explicit public GET pages without state or query parameters", () => {
    for (const path of [
      "/",
      "/guias",
      "/guia-de-scouting",
      "/melhores-formacoes",
      "/jogo-de-manager-de-futebol",
      "/jogar-offline",
      "/analise-de-partida-de-futebol",
      "/comparativo-jogos-manager",
      "/glossario-do-futebol",
      "/mercado-de-transferencias",
      "/planejamento-de-elenco",
      "/regras",
    ])
      expect(isEligibleAnonymousHtmlRequest(request(path))).toBe(true);
    for (const path of [
      "/auth",
      "/dashboard",
      "/api/health",
      "/produtos",
      "/tabelas",
      "/multiplayer",
      "/checkout",
      "/?utm_source=ads",
    ])
      expect(isEligibleAnonymousHtmlRequest(request(path))).toBe(false);
    for (const headers of [
      { cookie: "session=secret" },
      { cookie: "__cf_bm=bot; session=secret" },
      { authorization: "Bearer token" },
      { range: "bytes=0-9" },
      { "cache-control": "no-cache" },
    ])
      expect(isEligibleAnonymousHtmlRequest(request("/", { headers }))).toBe(false);
    expect(
      isEligibleAnonymousHtmlRequest(request("/", { headers: { cookie: "__cf_bm=bot" } })),
    ).toBe(true);
    expect(isEligibleAnonymousHtmlRequest(request("/", { method: "POST" }))).toBe(false);
  });

  it("refuses errors, private headers, dynamic cookies and non-HTML bodies", () => {
    const page = (status: number, headers: HeadersInit) =>
      new Response(status === 204 ? null : html, { status, headers });
    expect(
      isStorablePublicHtml(
        page(200, { "content-type": "text/html", "cache-control": "public, s-maxage=300" }),
      ),
    ).toBe(true);
    expect(
      isStorablePublicHtml(page(500, { "content-type": "text/html", "cache-control": "public" })),
    ).toBe(false);
    expect(
      isStorablePublicHtml(page(200, { "content-type": "text/html", "cache-control": "no-store" })),
    ).toBe(false);
    expect(
      isStorablePublicHtml(
        page(200, {
          "content-type": "text/html",
          "set-cookie": "session=private",
          "cache-control": "public",
        }),
      ),
    ).toBe(false);
    expect(
      isStorablePublicHtml(
        page(200, { "content-type": "application/json", "cache-control": "public" }),
      ),
    ).toBe(false);
    expect(
      isStorablePublicHtml(
        page(200, { "content-type": "text/html", "cache-control": "public", vary: "Cookie" }),
      ),
    ).toBe(false);
  });

  it("keeps the cache opt-in and fails closed without the Cloudflare runtime", () => {
    expect(createAnonymousEdgeHtmlCache(request(), {}, {}, version)).toBeNull();
    expect(
      createAnonymousEdgeHtmlCache(request(), { PUBLIC_HTML_EDGE_CACHE_ENABLED: "1" }, {}, version),
    ).toBeNull();
    expect(
      createAnonymousEdgeHtmlCache(
        request("/auth"),
        { PUBLIC_HTML_EDGE_CACHE_ENABLED: "1" },
        { waitUntil: () => {} },
        version,
      ),
    ).toBeNull();
  });

  it("rewrites every cached nonce for each hit, without invoking SSR", async () => {
    const values = new Map<string, Response>();
    const cache = {
      match: vi.fn(async (key: Request) => values.get(key.url)?.clone()),
      put: vi.fn(async (key: Request, response: Response) => {
        const content = await response.text();
        values.set(key.url, new Response(content, { headers: response.headers }));
      }),
    };
    vi.stubGlobal("caches", { default: cache });
    vi.stubGlobal("HTMLRewriter", TestHtmlRewriter);
    const fills: Promise<unknown>[] = [];
    const context = { waitUntil: (promise: Promise<unknown>) => fills.push(promise) };
    const enabled = { PUBLIC_HTML_EDGE_CACHE_ENABLED: "1" };
    const edge = createAnonymousEdgeHtmlCache(request(), enabled, context, version)!;
    const source = secureResponse(
      new Response(html, { headers: { "content-type": "text/html" } }),
      request(),
      "first",
    );
    expect(await edge.read("second")).toBeNull();
    edge.store(source);
    await Promise.all(fills);
    const cached = (await edge.read("second"))!;
    const serving = secureResponse(cached, request(), "second");
    const body = await serving.text();
    expect(body).toContain('nonce="second"');
    expect(body).toContain('property="csp-nonce" content="second"');
    expect(body).not.toContain('content="old"');
    expect(serving.headers.get("content-security-policy-report-only")).toContain("'nonce-second'");
    expect(serving.headers.get("cache-control")).toContain("max-age=0");
    expect(serving.headers.get("cloudflare-cdn-cache-control")).toBe("no-store");
    expect(serving.headers.get("cdn-cache-control")).toBe("no-store");
    const internal = [...values.values()][0]!;
    expect(internal.headers.get("cache-control")).toContain("max-age=180");
    expect(internal.headers.has("cdn-cache-control")).toBe(false);
    expect(internal.headers.has("cloudflare-cdn-cache-control")).toBe(false);
    expect(cache.match).toHaveBeenCalledTimes(2);
    expect(cache.put).toHaveBeenCalledTimes(1);
  });

  it("enforces the byte limit on streamed SSR even when Content-Length is absent", async () => {
    const cache = {
      match: vi.fn(async () => undefined),
      put: vi.fn(async (_key: Request, response: Response) => {
        await response.arrayBuffer();
      }),
    };
    vi.stubGlobal("caches", { default: cache });
    vi.stubGlobal("HTMLRewriter", TestHtmlRewriter);
    const pending: Promise<unknown>[] = [];
    const edge = createAnonymousEdgeHtmlCache(
      request(),
      { PUBLIC_HTML_EDGE_CACHE_ENABLED: "1" },
      { waitUntil: (promise: Promise<unknown>) => pending.push(promise) },
      version,
    )!;

    const big = new ArrayBuffer(256 * 1024 + 1);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(big, 0, 131072));
        controller.enqueue(new Uint8Array(big, 131072));
        controller.close();
      },
    });
    const oversized = secureResponse(
      new Response(stream, { headers: { "content-type": "text/html" } }),
      request(),
      "nonce",
    );
    expect(isStorablePublicHtml(oversized)).toBe(true);
    edge.store(oversized);
    await Promise.all(pending);
    expect(cache.put).not.toHaveBeenCalled();
    // The visitor still receives the complete original streamed response.
    expect((await oversized.arrayBuffer()).byteLength).toBe(big.byteLength);

    const underLimit = secureResponse(
      new Response(new ArrayBuffer(8192), { headers: { "content-type": "text/html" } }),
      request(),
      "nonce",
    );
    edge.store(underLimit);
    await Promise.all(pending);
    expect(cache.put).toHaveBeenCalledTimes(1);
    expect((await underLimit.arrayBuffer()).byteLength).toBe(8192);
  });
});
