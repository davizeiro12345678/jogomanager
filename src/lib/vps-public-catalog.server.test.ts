import { describe, expect, it, vi } from "vitest";
import { fetchVpsPublicCrests } from "./vps-public-catalog.server";

const origin = "https://catalog.jogomanager.com";

describe("VPS catalog canary", () => {
  it("is disabled by default and makes no network request", async () => {
    const fetcher = vi.fn();
    expect(await fetchVpsPublicCrests({ enabled: false, origin, fetchImpl: fetcher as typeof fetch }))
      .toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("never accepts arbitrary origins or insecure HTTP", async () => {
    const fetcher = vi.fn();
    for (const unsafe of [
      "http://catalog.jogomanager.com",
      "https://catalog.jogomanager.com.evil.example",
      "https://user@catalog.jogomanager.com",
      "https://catalog.jogomanager.com:444",
      "https://catalog.jogomanager.com/arbitrary",
      "http://127.0.0.1",
    ]) {
      expect(await fetchVpsPublicCrests({
        enabled: true, origin: unsafe, fetchImpl: fetcher as typeof fetch,
      })).toBeNull();
    }
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("reads validated anonymous pages without forwarding credentials", async () => {
    const mock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const parsed = new URL(String(url));
      expect(parsed.hostname).toBe("catalog.jogomanager.com");
      expect(parsed.pathname).toBe("/v1/public/clubs");
      expect(init?.credentials).toBe("omit");
      expect(init?.method).toBe("GET");
      expect(init?.redirect).toBe("error");
      expect(init?.cache).toBe("no-store");
      expect(new Headers(init?.headers).has("authorization")).toBe(false);
      expect(new Headers(init?.headers).has("cookie")).toBe(false);
      const rows = parsed.searchParams.get("page") === "0"
        ? [{ id: "club-1", crest_url: "https://example.com/crest.png" }]
        : [];
      return new Response(JSON.stringify(rows), {
        status: 200, headers: { "content-type": "application/json" },
      });
    });
    const rows = await fetchVpsPublicCrests({
      enabled: true, origin, fetchImpl: mock as typeof fetch,
    });
    expect(rows).toEqual([{ id: "club-1", crest_url: "https://example.com/crest.png" }]);
    expect(mock).toHaveBeenCalledTimes(6);
  });

  it("requires a complete result and uses direct Supabase fallback on failure", async () => {
    const empty = vi.fn(async () => new Response("[]", { status: 200 }));
    expect(await fetchVpsPublicCrests({
      enabled: true, origin, fetchImpl: empty as typeof fetch,
    })).toBeNull();
    const broken = vi.fn(async () => new Response("Unavailable", { status: 503 }));
    expect(await fetchVpsPublicCrests({
      enabled: true, origin, fetchImpl: broken as typeof fetch,
    })).toBeNull();
    const invalid = vi.fn(async () => new Response(JSON.stringify([{ id: "", crest_url: null }])));
    expect(await fetchVpsPublicCrests({
      enabled: true, origin, fetchImpl: invalid as typeof fetch,
    })).toBeNull();
  });

  it("does not return truncated data when the gateway exceeds the page cap", async () => {
    const alwaysFull = vi.fn(async (url: RequestInfo | URL) => {
      const page = Number(new URL(String(url)).searchParams.get("page"));
      return new Response(JSON.stringify(Array.from({ length: 100 }, (_, i) => ({
        id: `c-${page}-${i}`, crest_url: null,
      }))));
    });
    expect(await fetchVpsPublicCrests({
      enabled: true, origin, fetchImpl: alwaysFull as typeof fetch,
    })).toBeNull();
    expect(alwaysFull).toHaveBeenCalledTimes(72);
  });
});
