import { describe, expect, it } from "vitest";

import { Route as SitemapRoute } from "../routes/sitemap[.]xml";
import { PUBLIC_PAGE_REDIRECTS } from "./public-page-redirects";
import { PUBLIC_SEARCH_PAGES, responseIndexingPolicy } from "./public-indexing";
import { PUBLIC_PAGE_INVENTORY } from "./public-page-inventory";
import { canonical, SITE_URL } from "./seo";

const HTML = "text/html; charset=utf-8";

describe("central public indexing policy", () => {
  it("leaves only the explicit public pages free of an X-Robots-Tag", () => {
    expect(new Set(PUBLIC_SEARCH_PAGES)).toHaveLength(PUBLIC_SEARCH_PAGES.length);
    for (const path of PUBLIC_SEARCH_PAGES) {
      expect(responseIndexingPolicy(path, HTML)).toBeNull();
    }
  });

  it("keeps the real sitemap response aligned with the public inventory", async () => {
    const handlers = SitemapRoute.options.server?.handlers;
    if (!handlers || typeof handlers === "function" || !handlers.GET) {
      throw new Error("Sitemap GET handler is missing.");
    }
    const response = await handlers.GET({
      request: new Request("https://preview.example/sitemap.xml"),
    } as never);
    expect(response).toBeInstanceOf(Response);
    if (!(response instanceof Response)) throw new Error("Sitemap did not return a Response.");
    const xml = await response.text();
    const sitemapPaths = [...xml.matchAll(/<loc>https:\/\/jogomanager\.com([^<]*)<\/loc>/g)].map(
      (match) => match[1]!,
    );
    expect(sitemapPaths).toEqual(PUBLIC_PAGE_INVENTORY.map(({ path }) => path));
    expect(sitemapPaths).toHaveLength(34);
    for (const path of sitemapPaths) {
      expect(responseIndexingPolicy(path, HTML), `${path} is listed in sitemap`).toBeNull();
    }
  });

  it("keeps canonical paths slash-free while accepting a trailing-slash request", () => {
    for (const { path } of PUBLIC_PAGE_INVENTORY) {
      expect(path === "/" || !path.endsWith("/")).toBe(true);
      expect(canonical(path)[0]?.href).toBe(`${SITE_URL}${path}`);
      const slashVariant = path === "/" ? path : `${path}/`;
      expect(responseIndexingPolicy(slashVariant, HTML), `${slashVariant} is canonical`).toBeNull();
    }
  });

  it("keeps retired aliases, previews and private surfaces out of the indexable set", () => {
    for (const source of Object.keys(PUBLIC_PAGE_REDIRECTS)) {
      expect(PUBLIC_SEARCH_PAGES).not.toContain(source);
      expect(responseIndexingPolicy(source, HTML)).toMatch(/^noindex,/);
      expect(responseIndexingPolicy(`${source}/`, HTML)).toMatch(/^noindex,/);
    }
    for (const path of [
      "/api/health",
      "/_serverFn/private",
      "/lovable/email/auth/preview",
      "/auth",
      "/cadastro",
      "/checkout/return",
      "/compras",
      "/editor",
      "/carreira",
    ]) {
      expect(responseIndexingPolicy(path, HTML), `${path} must stay private`).toMatch(/^noindex,/);
    }
  });

  it("sets noindex for personal career, creation, purchase, match, social and editor screens", () => {
    for (const path of [
      "/carreira",
      "/new",
      "/jogador",
      "/jogador/novo",
      "/jogador/painel",
      "/clube/novo",
      "/loja",
      "/compras",
      "/checkout/return",
      "/match",
      "/pre-jogo",
      "/partida-rapida",
      "/chat",
      "/multiplayer",
      "/editor",
      "/visual",
    ]) {
      expect(responseIndexingPolicy(path, HTML)).toMatch(/^noindex,/);
    }
  });
});
