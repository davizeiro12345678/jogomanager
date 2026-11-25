import { describe, expect, it } from "vitest";
import { createWorkerPublicCache } from "./worker-public-cache.server";

describe("request-isolated Worker public cache", () => {
  it("does not share an unresolved request or let a late result replace a fresh catalog", async () => {
    const cache = createWorkerPublicCache<number>({
      ttlMs: 100,
      staleIfErrorMs: 500,
      maxEntries: 1,
    });
    let finish!: (value: number) => void;
    const first = cache.get(
      "assets",
      () =>
        new Promise<number>((resolve) => {
          finish = resolve;
        }),
    );
    const second = await cache.get("assets", async () => 2);
    expect(second).toBe(2);
    finish(1);
    expect(await first).toBe(2);
    expect(await cache.get("assets", async () => 3)).toBe(2);
  });

  it("keeps only completed data and bounds stale recovery", async () => {
    let now = 0;
    const cache = createWorkerPublicCache<number>({
      ttlMs: 100,
      staleIfErrorMs: 500,
      maxEntries: 1,
      now: () => now,
    });
    const fail = async (): Promise<number> => {
      throw new Error("upstream");
    };
    await expect(cache.get("cold", fail)).rejects.toThrow("upstream");
    expect(await cache.get("assets", async () => 4)).toBe(4);
    now = 101;
    expect(await cache.get("assets", fail)).toBe(4);
    now = 601;
    await expect(cache.get("assets", fail)).rejects.toThrow("upstream");
  });

  it("bounds completed entries and does not retain failed loads", async () => {
    const cache = createWorkerPublicCache<number>({ ttlMs: 100, staleIfErrorMs: 0, maxEntries: 1 });
    await cache.get("a", async () => 1);
    await cache.get("b", async () => 2);
    expect(await cache.get("a", async () => 3)).toBe(3);
  });
});
