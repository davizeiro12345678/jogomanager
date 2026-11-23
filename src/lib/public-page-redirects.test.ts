import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { Page as CreatorPage } from "../pages/criador";
import { ContatoPage } from "../pages/contato";
import { PUBLIC_PAGE_INVENTORY } from "./public-page-inventory";
import { PUBLIC_PAGE_REDIRECTS, publicPageRedirect } from "./public-page-redirects";

const ssrFetch = vi.hoisted(() => vi.fn(() => new Response("SSR")));
vi.mock("@tanstack/react-start/server-entry", () => ({ default: { fetch: ssrFetch } }));

describe("retired public pages", () => {
  it("redirects www login to the canonical auth origin before SSR or OAuth", async () => {
    const server = (await import("../server")).default;
    ssrFetch.mockClear();
    for (const method of ["GET", "HEAD"]) {
      const response = await server.fetch(
        new Request("https://www.jogomanager.com/auth?next=%2Fclub", { method }),
        {},
        {},
      );
      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toBe(
        "https://jogomanager.com/auth?next=%2Fclub",
      );
      expect(response.headers.get("cache-control")).toContain("no-store");
      expect(ssrFetch).not.toHaveBeenCalled();
    }
    for (const url of [
      "https://jogomanager.com/auth",
      "https://www.jogomanager.com.evil.test/auth",
      "https://www.jogomanager.com/api/stripe/webhook",
    ]) {
      expect(publicPageRedirect(new Request(url))).toBeUndefined();
    }
    expect(
      publicPageRedirect(
        new Request("https://www.jogomanager.com/auth", { method: "POST" }),
      ),
    ).toBeUndefined();
  });

  it("returns redirects before invoking the SSR handler", async () => {
    const server = (await import("../server")).default;
    for (const method of ["GET", "HEAD"]) {
      const response = await server.fetch(
        new Request("https://example.com/gestao-financeira", { method }),
        {},
        {},
      );
      expect(response.status).toBe(301);
      expect(ssrFetch).not.toHaveBeenCalled();
    }
    expect(
      (await server.fetch(new Request("https://example.com/dicas-de-gestao"), {}, {})).status,
    ).toBe(200);
    expect(ssrFetch).toHaveBeenCalledOnce();
  });
  for (const [source, target] of Object.entries(PUBLIC_PAGE_REDIRECTS)) {
    it(`redirects GET and HEAD ${source} directly to ${target}`, async () => {
      for (const method of ["GET", "HEAD"]) {
        const response = publicPageRedirect(
          new Request(`https://preview.example${source}/?utm_source=old-link`, { method }),
        );
        expect(response?.status).toBe(301);
        expect(response?.headers.get("location")).toBe(`${target}?utm_source=old-link`);
        expect(await response?.text()).toBe("");
      }
      expect(publicPageRedirect(new Request(`https://preview.example${target}`))).toBeUndefined();
      expect(
        publicPageRedirect(new Request(`https://preview.example${source}/child`)),
      ).toBeUndefined();
      for (const method of ["POST", "PUT", "PATCH", "DELETE", "OPTIONS"]) {
        expect(
          publicPageRedirect(new Request(`https://preview.example${source}`, { method })),
        ).toBeUndefined();
      }
    });
  }

  it("redirects the retired /modo-carreira URL to the canonical career guide without redirecting POST", () => {
    const url = "https://jogomanager.com/modo-carreira?from=bookmark";
    const result = publicPageRedirect(new Request(url));
    expect(result?.status).toBe(301);
    expect(result?.headers.get("location")).toBe("/jogo-de-manager-de-futebol?from=bookmark");
    expect(publicPageRedirect(new Request(url, { method: "POST" }))).toBeUndefined();
  });

  it("keeps canonical discovery resources free of retired URLs", () => {
    const navigation = readFileSync(new URL("./public-pages.ts", import.meta.url), "utf8");
    const llms = readFileSync(new URL("../../public/llms.txt", import.meta.url), "utf8");
    const indexedPaths = PUBLIC_PAGE_INVENTORY.map(({ path }) => path);
    expect(new Set(indexedPaths).size).toBe(indexedPaths.length);
    for (const [source, target] of Object.entries(PUBLIC_PAGE_REDIRECTS)) {
      expect(indexedPaths).not.toContain(source);
      expect(indexedPaths).toContain(target);
      expect(navigation).not.toContain(`to: "${source}"`);
      expect(llms).not.toContain(`https://jogomanager.com${source}`);
    }
    for (const match of llms.matchAll(/\]\(https:\/\/jogomanager\.com([^)]*)\)/g)) {
      expect(indexedPaths).toContain(match[1]);
    }
  });

  it("keeps the official contacts consistent", async () => {
    const contacts = ["davizeiro10.jogos@gmail.com", "davithomazini779@gmail.com"];
    // Verify rendered links: these pages share identity constants, so their
    // source does not need to duplicate the literal contact addresses.
    for (const page of [ContatoPage, CreatorPage] as ComponentType[]) {
      const router = createRouter({
        routeTree: createRootRoute({ component: () => createElement(page) }),
        history: createMemoryHistory({ initialEntries: ["/"] }),
        isServer: true,
      });
      await router.load();
      const html = renderToStaticMarkup(createElement(RouterProvider, { router }));
      for (const email of contacts) expect(html).toContain(`href="mailto:${email}"`);
    }
    const community = readFileSync(new URL("../content/community.ts", import.meta.url), "utf8");
    expect(community).toContain('DISCORD_INVITE = "https://discord.gg/6az4ssQQck"');
    const llms = readFileSync(new URL("../../public/llms.txt", import.meta.url), "utf8");
    for (const email of contacts) expect(llms).toContain(email);
    expect(llms).toContain("https://discord.gg/6az4ssQQck");
  });
});
