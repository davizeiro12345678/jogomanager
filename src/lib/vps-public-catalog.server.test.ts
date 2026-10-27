import { describe, expect, it, vi } from "vitest";
import { fetchVpsPublicCrests } from "./vps-public-catalog.server";

const origin = "https://catalog.jogomanager.com";

describe("VPS catalog canary", () => {
  it("stays disabled by default", async () => {
    const mock = vi.fn();
    const result = await fetchVpsPublicCrests({
      enabled: false,
      origin,
      fetchImpl: mock as typeof fetch,
    });
    expect(result).toBeNull();
    expect(mock).not.toHaveBeenCalled();
  });

  it("blocks insecure or arbitrary upstream origins", async () => {
    const mock = vi.fn();
    const unsafe = [
      "http://catalog.jogomanager.com",
      "https://catalog.jogomanager.com.evil.example",
      "https://user@catalog.jogomanager.com",
      "https://catalog.jogomanager.com:444",
      "https://catalog.jogomanager.com/arbitrary",
      "http://127.0.0.1",
    ];
    for (const originValue of unsafe) {
      const result = await fetchVpsPublicCrests({
        enabled: true,
        origin: originValue,
        fetchImpl: mock as typeof fetch,
      });
      expect(result).toBeNull();
    }
    expect(mock).not.toHaveBeenCalled();
  });

  it("only fetches anonymous public catalog projections", async () => {
    const mock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      expect(url.hostname).toBe("catalog.jogomanager.com");
      expect(url.pathname).toBe("/v1/public/clubs");
      expect(init?.credentials).toBe("omit");
      expect(init?.redirect).toBe("error");
      expect(init?.method).toBe("GET");
      expect(init?.cache).toBe("no-store");
      expect(new Headers(init?.headers).has("authorization")).toBe(false);
      expect(new Headers(init?.headers).has("cookie")).toBe(false);

      const rows =
        url.searchParams.get("page") === "0"
          ? [{ id: "club-1", crest_url: "https://example.com/crest.png" }]
          : [];
      return new Response(JSON.stringify(rows), { status: 200 });
    });
    const result = await fetchVpsPublicCrests({
      enabled: true,
      origin,
      fetchImpl: mock as typeof fetch,
    });
    expect(result).toEqual([{ id: "club-1", crest_url: "https://example.com/crest.png" }]);
    expect(mock).toHaveBeenCalledTimes(6);
  });

  it("falls back on empty, failed, or invalid responses", async () => {
    const tests = [
      new Response("[]", { status: 200 }),
      new Response("unavailable", { status: 503 }),
      new Response(JSON.stringify([{ id: "", crest_url: null }])),
    ];
    for (const response of tests) {
      const mock = vi.fn(async () => response.clone());
      const result = await fetchVpsPublicCrests({
        enabled: true,
        origin,
        fetchImpl: mock as typeof fetch,
      });
      expect(result).toBeNull();
    }
  });

  it("retrieves the whole 38,854-club public projection without truncation", async () => {
    const calls: number[] = [];
    const mock = vi.fn(async (input: RequestInfo | URL) => {
      const page = Number(new URL(String(input)).searchParams.get("page"));
      calls.push(page);
      const remaining = Math.max(0, 38_854 - page * 1_000);
      const count = Math.min(1_000, remaining);
      const rows = Array.from({ length: count }, (_, i) => ({
        id: `club-${page}-${i}`,
        crest_url: `https://example.com/${page}/${i}.png`,
      }));
      return new Response(JSON.stringify(rows), { status: 200 });
    });
    const result = await fetchVpsPublicCrests({
      enabled: true,
      origin,
      fetchImpl: mock as typeof fetch,
    });
    expect(result).toHaveLength(38_854);
    expect(new Set(result?.map((item) => item.id)).size).toBe(38_854);
    expect(calls).toHaveLength(42);
  });

  it("rejects a truncated catalog beyond its page cap", async () => {
    const mock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const page = Number(url.searchParams.get("page"));
      const rows = Array.from({ length: 1_000 }, (_, index) => ({
        id: `club-${page}-${index}`,
        crest_url: null,
      }));
      return new Response(JSON.stringify(rows), { status: 200 });
    });
    const result = await fetchVpsPublicCrests({
      enabled: true,
      origin,
      fetchImpl: mock as typeof fetch,
    });
    expect(result).toBeNull();
    expect(mock).toHaveBeenCalledTimes(48);
  });
});
