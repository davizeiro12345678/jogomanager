import { describe, expect, it, vi } from "vitest";
import { createPublicReadCache } from "./public-read-cache.server";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

describe("bounded public data cache", () => {
  it("coalesces a concurrent burst into one upstream request", async () => {
    const cache = createPublicReadCache<number>({ ttlMs: 1_000, maxEntries: 2 });
    const upstream = deferred<number>();
    const load = vi.fn(() => upstream.promise);
    const requests = Array.from({ length: 20 }, () => cache.get("league:71", load));
    await Promise.resolve();

    expect(load).toHaveBeenCalledTimes(1);
    expect(cache.size).toBe(1);
    upstream.resolve(42);
    expect(await Promise.all(requests)).toEqual(Array(20).fill(42));
    expect(await cache.get("league:71", load)).toBe(42);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("starts freshness when the request completes and reloads at expiry", async () => {
    let now = 0;
    const cache = createPublicReadCache<number>({
      ttlMs: 1_000,
      maxEntries: 2,
      now: () => now,
    });
    const upstream = deferred<number>();
    const load = vi.fn(() => upstream.promise);
    const first = cache.get("league:71", load);
    now = 5_000;
    upstream.resolve(1);
    await first;
    now = 5_999;
    expect(await cache.get("league:71", load)).toBe(1);
    expect(load).toHaveBeenCalledTimes(1);

    now = 6_000;
    const refresh = vi.fn(async () => 2);
    expect(await cache.get("league:71", refresh)).toBe(2);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("evicts the least recently used entry while keeping its capacity fixed", async () => {
    const cache = createPublicReadCache<string>({ ttlMs: 60_000, maxEntries: 2 });
    const loads = {
      a: vi.fn(async () => "a"),
      b: vi.fn(async () => "b"),
      c: vi.fn(async () => "c"),
    };
    await cache.get("a", loads.a);
    await cache.get("b", loads.b);
    await cache.get("a", loads.a);
    await cache.get("c", loads.c);
    expect(cache.size).toBe(2);
    await cache.get("a", loads.a);
    expect(loads.a).toHaveBeenCalledTimes(1);
    await cache.get("b", loads.b);
    expect(loads.b).toHaveBeenCalledTimes(2);
    expect(cache.size).toBe(2);
  });

  it("does not let an evicted pending request replace a newer value", async () => {
    const cache = createPublicReadCache<number>({ ttlMs: 60_000, maxEntries: 1 });
    const old = deferred<number>();
    const oldRequest = cache.get("a", () => old.promise);
    await cache.get("b", async () => 2);
    await cache.get("a", async () => 3);
    old.resolve(1);
    expect(await oldRequest).toBe(1);
    expect(await cache.get("a", async () => 4)).toBe(3);
    expect(cache.size).toBe(1);
  });

  it("never stores failures and allows a successful retry", async () => {
    const cache = createPublicReadCache<number>({ ttlMs: 60_000, maxEntries: 2 });
    const load = vi.fn<() => Promise<number>>();
    load.mockRejectedValueOnce(new Error("unavailable")).mockResolvedValue(7);

    await expect(cache.get("league:71", load)).rejects.toThrow("unavailable");
    expect(cache.size).toBe(0);
    expect(await cache.get("league:71", load)).toBe(7);
    expect(await cache.get("league:71", load)).toBe(7);
    expect(load).toHaveBeenCalledTimes(2);
  });

import { describe, expect, it, vi } from "vitest";
import { createPublicReadCache } from "./public-read-cache.server";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

describe("bounded public data cache", () => {
  it("coalesces a concurrent burst into one upstream request", async () => {
    const cache = createPublicReadCache<number>({ ttlMs: 1_000, maxEntries: 2 });
    const upstream = deferred<number>();
    const load = vi.fn(() => upstream.promise);
    const requests = Array.from({ length: 20 }, () => cache.get("league:71", load));
    await Promise.resolve();

    expect(load).toHaveBeenCalledTimes(1);
    expect(cache.size).toBe(1);
    upstream.resolve(42);
    expect(await Promise.all(requests)).toEqual(Array(20).fill(42));
    expect(await cache.get("league:71", load)).toBe(42);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("starts freshness when the request completes and reloads at expiry", async () => {
    let now = 0;
    const cache = createPublicReadCache<number>({
      ttlMs: 1_000,
      maxEntries: 2,
      now: () => now,
    });
    const upstream = deferred<number>();
    const load = vi.fn(() => upstream.promise);
    const first = cache.get("league:71", load);
    now = 5_000;
    upstream.resolve(1);
    await first;
    now = 5_999;
    expect(await cache.get("league:71", load)).toBe(1);
    expect(load).toHaveBeenCalledTimes(1);

    now = 6_000;
    const refresh = vi.fn(async () => 2);
    expect(await cache.get("league:71", refresh)).toBe(2);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("evicts the least recently used entry while keeping its capacity fixed", async () => {
    const cache = createPublicReadCache<string>({ ttlMs: 60_000, maxEntries: 2 });
    const loads = {
      a: vi.fn(async () => "a"),
      b: vi.fn(async () => "b"),
      c: vi.fn(async () => "c"),
    };
    await cache.get("a", loads.a);
    await cache.get("b", loads.b);
    await cache.get("a", loads.a);
    await cache.get("c", loads.c);
    expect(cache.size).toBe(2);
    await cache.get("a", loads.a);
    expect(loads.a).toHaveBeenCalledTimes(1);
    await cache.get("b", loads.b);
    expect(loads.b).toHaveBeenCalledTimes(2);
    expect(cache.size).toBe(2);
  });

  it("does not let an evicted pending request replace a newer value", async () => {
    const cache = createPublicReadCache<number>({ ttlMs: 60_000, maxEntries: 1 });
    const old = deferred<number>();
    const oldRequest = cache.get("a", () => old.promise);
    await cache.get("b", async () => 2);
    await cache.get("a", async () => 3);
    old.resolve(1);
    expect(await oldRequest).toBe(1);
    expect(await cache.get("a", async () => 4)).toBe(3);
    expect(cache.size).toBe(1);
  });

  it("never stores failures and allows a successful retry", async () => {
    const cache = createPublicReadCache<number>({ ttlMs: 60_000, maxEntries: 2 });
    const load = vi.fn<() => Promise<number>>();
    load.mockRejectedValueOnce(new Error("unavailable")).mockResolvedValue(7);

    await expect(cache.get("league:71", load)).rejects.toThrow("unavailable");
    expect(cache.size).toBe(0);
    expect(await cache.get("league:71", load)).toBe(7);
    expect(await cache.get("league:71", load)).toBe(7);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("allows retry after a pending load stalls without letting its late result poison the cache", async () => {
    let now = 0;
    const cache = createPublicReadCache<number>({
      ttlMs: 1_000,
      maxEntries: 2,
      maxPendingMs: 100,
      now: () => now,
    });
    const stalled = deferred<number>();
    const first = cache.get("league:71", () => stalled.promise);
    now = 99;
    expect(cache.get("league:71", async () => 2)).toBe(first);
    now = 100;
    const retry = cache.get("league:71", async () => 2);
    expect(retry).not.toBe(first);
    expect(await retry).toBe(2);
    stalled.resolve(1);
    expect(await first).toBe(1);
    expect(await cache.get("league:71", async () => 3)).toBe(2);
    expect(cache.size).toBe(1);
  });

  it.each([0, -1, NaN, Infinity])("rejects invalid pending load lifetime %s", (maxPendingMs) => {
    expect(() => createPublicReadCache({ ttlMs: 1_000, maxEntries: 2, maxPendingMs })).toThrow(
      /capacity or freshness/,
    );
  });

import { describe, expect, it, vi } from "vitest";
import { createPublicReadCache } from "./public-read-cache.server";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

describe("bounded public data cache", () => {
  it("coalesces a concurrent burst into one upstream request", async () => {
    const cache = createPublicReadCache<number>({ ttlMs: 1_000, maxEntries: 2 });
    const upstream = deferred<number>();
    const load = vi.fn(() => upstream.promise);
    const requests = Array.from({ length: 20 }, () => cache.get("league:71", load));
    await Promise.resolve();

    expect(load).toHaveBeenCalledTimes(1);
    expect(cache.size).toBe(1);
    upstream.resolve(42);
    expect(await Promise.all(requests)).toEqual(Array(20).fill(42));
    expect(await cache.get("league:71", load)).toBe(42);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("starts freshness when the request completes and reloads at expiry", async () => {
    let now = 0;
    const cache = createPublicReadCache<number>({
      ttlMs: 1_000,
      maxEntries: 2,
      now: () => now,
    });
    const upstream = deferred<number>();
    const load = vi.fn(() => upstream.promise);
    const first = cache.get("league:71", load);
    now = 5_000;
    upstream.resolve(1);
    await first;
    now = 5_999;
    expect(await cache.get("league:71", load)).toBe(1);
    expect(load).toHaveBeenCalledTimes(1);

    now = 6_000;
    const refresh = vi.fn(async () => 2);
    expect(await cache.get("league:71", refresh)).toBe(2);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("evicts the least recently used entry while keeping its capacity fixed", async () => {
    const cache = createPublicReadCache<string>({ ttlMs: 60_000, maxEntries: 2 });
    const loads = {
      a: vi.fn(async () => "a"),
      b: vi.fn(async () => "b"),
      c: vi.fn(async () => "c"),
    };
    await cache.get("a", loads.a);
    await cache.get("b", loads.b);
    await cache.get("a", loads.a);
    await cache.get("c", loads.c);
    expect(cache.size).toBe(2);
    await cache.get("a", loads.a);
    expect(loads.a).toHaveBeenCalledTimes(1);
    await cache.get("b", loads.b);
    expect(loads.b).toHaveBeenCalledTimes(2);
    expect(cache.size).toBe(2);
  });

  it("does not let an evicted pending request replace a newer value", async () => {
    const cache = createPublicReadCache<number>({ ttlMs: 60_000, maxEntries: 1 });
    const old = deferred<number>();
    const oldRequest = cache.get("a", () => old.promise);
    await cache.get("b", async () => 2);
    await cache.get("a", async () => 3);
    old.resolve(1);
    expect(await oldRequest).toBe(1);
    expect(await cache.get("a", async () => 4)).toBe(3);
    expect(cache.size).toBe(1);
  });

  it("never stores failures and allows a successful retry", async () => {
    const cache = createPublicReadCache<number>({ ttlMs: 60_000, maxEntries: 2 });
    const load = vi.fn<() => Promise<number>>();
    load.mockRejectedValueOnce(new Error("unavailable")).mockResolvedValue(7);

    await expect(cache.get("league:71", load)).rejects.toThrow("unavailable");
    expect(cache.size).toBe(0);
    expect(await cache.get("league:71", load)).toBe(7);
    expect(await cache.get("league:71", load)).toBe(7);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("shares the error from one failed concurrent load and then retries", async () => {
    const cache = createPublicReadCache<number>({ ttlMs: 60_000, maxEntries: 2 });
    const upstream = deferred<number>();
    const load = vi.fn(() => upstream.promise);
    const results = Promise.allSettled([
      cache.get("league:71", load),
      cache.get("league:71", load),
    ]);
    await Promise.resolve();
    upstream.reject(new Error("temporary database error"));
    expect((await results).every((result) => result.status === "rejected")).toBe(true);
    expect(load).toHaveBeenCalledTimes(1);
    expect(cache.size).toBe(0);
    expect(await cache.get("league:71", async () => 9)).toBe(9);
  });

  it("also cleans up synchronous loader failures", async () => {
    const cache = createPublicReadCache<number>({ ttlMs: 60_000, maxEntries: 2 });
    await expect(
      cache.get("league:71", () => {
        throw new Error("configuration unavailable");
      }),
    ).rejects.toThrow("configuration unavailable");
    expect(cache.size).toBe(0);
    expect(await cache.get("league:71", async () => 3)).toBe(3);
  });

  it("caches a successful empty result without confusing it with a failure", async () => {
    const cache = createPublicReadCache<null>({ ttlMs: 60_000, maxEntries: 2 });
    const load = vi.fn(async () => null);
    expect(await cache.get("missing:club", load)).toBeNull();
    expect(await cache.get("missing:club", load)).toBeNull();
    expect(load).toHaveBeenCalledTimes(1);
  });
import { describe, expect, it, vi } from "vitest";
import { createPublicReadCache } from "./public-read-cache.server";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

describe("bounded public data cache", () => {
  it("coalesces a concurrent burst into one upstream request", async () => {
    const cache = createPublicReadCache<number>({ ttlMs: 1_000, maxEntries: 2 });
    const upstream = deferred<number>();
    const load = vi.fn(() => upstream.promise);
    const requests = Array.from({ length: 20 }, () => cache.get("league:71", load));
    await Promise.resolve();

    expect(load).toHaveBeenCalledTimes(1);
    expect(cache.size).toBe(1);
    upstream.resolve(42);
    expect(await Promise.all(requests)).toEqual(Array(20).fill(42));
    expect(await cache.get("league:71", load)).toBe(42);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("starts freshness when the request completes and reloads at expiry", async () => {
    let now = 0;
    const cache = createPublicReadCache<number>({
      ttlMs: 1_000,
      maxEntries: 2,
      now: () => now,
    });
    const upstream = deferred<number>();
    const load = vi.fn(() => upstream.promise);
    const first = cache.get("league:71", load);
    now = 5_000;
    upstream.resolve(1);
    await first;
    now = 5_999;
    expect(await cache.get("league:71", load)).toBe(1);
    expect(load).toHaveBeenCalledTimes(1);

    now = 6_000;
    const refresh = vi.fn(async () => 2);
    expect(await cache.get("league:71", refresh)).toBe(2);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("evicts the least recently used entry while keeping its capacity fixed", async () => {
    const cache = createPublicReadCache<string>({ ttlMs: 60_000, maxEntries: 2 });
    const loads = {
      a: vi.fn(async () => "a"),
      b: vi.fn(async () => "b"),
      c: vi.fn(async () => "c"),
    };
    await cache.get("a", loads.a);
    await cache.get("b", loads.b);
    await cache.get("a", loads.a);
    await cache.get("c", loads.c);
    expect(cache.size).toBe(2);
    await cache.get("a", loads.a);
    expect(loads.a).toHaveBeenCalledTimes(1);
    await cache.get("b", loads.b);
    expect(loads.b).toHaveBeenCalledTimes(2);
    expect(cache.size).toBe(2);
  });

  it("does not let an evicted pending request replace a newer value", async () => {
    const cache = createPublicReadCache<number>({ ttlMs: 60_000, maxEntries: 1 });
    const old = deferred<number>();
    const oldRequest = cache.get("a", () => old.promise);
    await cache.get("b", async () => 2);
    await cache.get("a", async () => 3);
    old.resolve(1);
    expect(await oldRequest).toBe(1);
    expect(await cache.get("a", async () => 4)).toBe(3);
    expect(cache.size).toBe(1);
  });

  it("never stores failures and allows a successful retry", async () => {
    const cache = createPublicReadCache<number>({ ttlMs: 60_000, maxEntries: 2 });
    const load = vi.fn<() => Promise<number>>();
    load.mockRejectedValueOnce(new Error("unavailable")).mockResolvedValue(7);

    await expect(cache.get("league:71", load)).rejects.toThrow("unavailable");
    expect(cache.size).toBe(0);
    expect(await cache.get("league:71", load)).toBe(7);
    expect(await cache.get("league:71", load)).toBe(7);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("shares the error from one failed concurrent load and then retries", async () => {
    const cache = createPublicReadCache<number>({ ttlMs: 60_000, maxEntries: 2 });
    const upstream = deferred<number>();
    const load = vi.fn(() => upstream.promise);
    const results = Promise.allSettled([
      cache.get("league:71", load),
      cache.get("league:71", load),
    ]);
    await Promise.resolve();
    upstream.reject(new Error("temporary database error"));
    expect((await results).every((result) => result.status === "rejected")).toBe(true);
    expect(load).toHaveBeenCalledTimes(1);
    expect(cache.size).toBe(0);
    expect(await cache.get("league:71", async () => 9)).toBe(9);
  });

  it("also cleans up synchronous loader failures", async () => {
    const cache = createPublicReadCache<number>({ ttlMs: 60_000, maxEntries: 2 });
    await expect(
      cache.get("league:71", () => {
        throw new Error("configuration unavailable");
      }),
    ).rejects.toThrow("configuration unavailable");
    expect(cache.size).toBe(0);
    expect(await cache.get("league:71", async () => 3)).toBe(3);
  });

  it("caches a successful empty result without confusing it with a failure", async () => {
    const cache = createPublicReadCache<null>({ ttlMs: 60_000, maxEntries: 2 });
    const load = vi.fn(async () => null);
    expect(await cache.get("missing:club", load)).toBeNull();
    expect(await cache.get("missing:club", load)).toBeNull();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("releases a hung request and shares its deadline with concurrent readers", async () => {
    vi.useFakeTimers();
    try {
      const cache = createPublicReadCache<number>({
        ttlMs: 1_000,
        maxEntries: 2,
        loadTimeoutMs: 50,
      });
      const upstream = deferred<number>();
      const load = vi.fn(() => upstream.promise);
      const first = cache.get("a", load);
      const second = cache.get("a", load);
      const failures = Promise.allSettled([first, second]);
      await vi.advanceTimersByTimeAsync(50);
      const results = await failures;
      expect(results.every((result) => result.status === "rejected")).toBe(true);
      expect(load).toHaveBeenCalledTimes(1);
      expect(cache.size).toBe(0);
      expect(await cache.get("a", async () => 3)).toBe(3);
      upstream.resolve(1);
      await Promise.resolve();
      expect(await cache.get("a", async () => 4)).toBe(3);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it.each([0, -1, NaN, Infinity, 2_147_483_648])(
    "rejects an invalid load deadline %s",
    (loadTimeoutMs) => {
      expect(() => createPublicReadCache({ ttlMs: 100, maxEntries: 1, loadTimeoutMs })).toThrow();
    },
  );

  it("bounds upstream concurrency even when pending keys are evicted", async () => {
    const cache = createPublicReadCache<number>({
      ttlMs: 1_000,
      maxEntries: 1,
      maxConcurrentLoads: 2,
    });
    const first = deferred<number>();
    const second = deferred<number>();
    const a = cache.get("a", () => first.promise);
    const b = cache.get("b", () => second.promise);
    const third = vi.fn(async () => 3);
    await expect(cache.get("c", third)).rejects.toThrow(/capacity/);
    expect(third).not.toHaveBeenCalled();
    // Already in-flight same-key callers still share the existing request.
    const shared = cache.get("b", third);
    first.resolve(1);
    await a;
    expect(await cache.get("c", third)).toBe(3);
    second.resolve(2);
    expect(await b).toBe(2);
    expect(await shared).toBe(2);
  });

  it("does not release physical capacity for a timed-out, uncancelled upstream", async () => {
    vi.useFakeTimers();
    try {
      const cache = createPublicReadCache<number>({
        ttlMs: 1_000,
        maxEntries: 1,
        maxConcurrentLoads: 1,
        loadTimeoutMs: 5,
      });
      const upstream = deferred<number>();
      const failures = Promise.allSettled([cache.get("a", () => upstream.promise)]);
      await vi.advanceTimersByTimeAsync(5);
      await failures;
      await expect(cache.get("b", async () => 2)).rejects.toThrow(/capacity/);
      upstream.resolve(1);
      await vi.advanceTimersByTimeAsync(0);
      expect(await cache.get("b", async () => 2)).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });
import { describe, expect, it, vi } from "vitest";
import { createPublicReadCache } from "./public-read-cache.server";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

describe("bounded public data cache", () => {
  it("coalesces a concurrent burst into one upstream request", async () => {
    const cache = createPublicReadCache<number>({ ttlMs: 1_000, maxEntries: 2 });
    const upstream = deferred<number>();
    const load = vi.fn(() => upstream.promise);
    const requests = Array.from({ length: 20 }, () => cache.get("league:71", load));
    await Promise.resolve();

    expect(load).toHaveBeenCalledTimes(1);
    expect(cache.size).toBe(1);
    upstream.resolve(42);
    expect(await Promise.all(requests)).toEqual(Array(20).fill(42));
    expect(await cache.get("league:71", load)).toBe(42);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("starts freshness when the request completes and reloads at expiry", async () => {
    let now = 0;
    const cache = createPublicReadCache<number>({
      ttlMs: 1_000,
      maxEntries: 2,
      now: () => now,
    });
    const upstream = deferred<number>();
    const load = vi.fn(() => upstream.promise);
    const first = cache.get("league:71", load);
    now = 5_000;
    upstream.resolve(1);
    await first;
    now = 5_999;
    expect(await cache.get("league:71", load)).toBe(1);
    expect(load).toHaveBeenCalledTimes(1);

    now = 6_000;
    const refresh = vi.fn(async () => 2);
    expect(await cache.get("league:71", refresh)).toBe(2);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("evicts the least recently used entry while keeping its capacity fixed", async () => {
    const cache = createPublicReadCache<string>({ ttlMs: 60_000, maxEntries: 2 });
    const loads = {
      a: vi.fn(async () => "a"),
      b: vi.fn(async () => "b"),
      c: vi.fn(async () => "c"),
    };
    await cache.get("a", loads.a);
    await cache.get("b", loads.b);
    await cache.get("a", loads.a);
    await cache.get("c", loads.c);
    expect(cache.size).toBe(2);
    await cache.get("a", loads.a);
    expect(loads.a).toHaveBeenCalledTimes(1);
    await cache.get("b", loads.b);
    expect(loads.b).toHaveBeenCalledTimes(2);
    expect(cache.size).toBe(2);
  });

  it("does not let an evicted pending request replace a newer value", async () => {
    const cache = createPublicReadCache<number>({ ttlMs: 60_000, maxEntries: 1 });
    const old = deferred<number>();
    const oldRequest = cache.get("a", () => old.promise);
    await cache.get("b", async () => 2);
    await cache.get("a", async () => 3);
    old.resolve(1);
    expect(await oldRequest).toBe(1);
    expect(await cache.get("a", async () => 4)).toBe(3);
    expect(cache.size).toBe(1);
  });

  it("never stores failures and allows a successful retry", async () => {
    const cache = createPublicReadCache<number>({ ttlMs: 60_000, maxEntries: 2 });
    const load = vi.fn<() => Promise<number>>();
    load.mockRejectedValueOnce(new Error("unavailable")).mockResolvedValue(7);

    await expect(cache.get("league:71", load)).rejects.toThrow("unavailable");
    expect(cache.size).toBe(0);
    expect(await cache.get("league:71", load)).toBe(7);
    expect(await cache.get("league:71", load)).toBe(7);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("shares the error from one failed concurrent load and then retries", async () => {
    const cache = createPublicReadCache<number>({ ttlMs: 60_000, maxEntries: 2 });
    const upstream = deferred<number>();
    const load = vi.fn(() => upstream.promise);
    const results = Promise.allSettled([
      cache.get("league:71", load),
      cache.get("league:71", load),
    ]);
    await Promise.resolve();
    upstream.reject(new Error("temporary database error"));
    expect((await results).every((result) => result.status === "rejected")).toBe(true);
    expect(load).toHaveBeenCalledTimes(1);
    expect(cache.size).toBe(0);
    expect(await cache.get("league:71", async () => 9)).toBe(9);
  });

  it("also cleans up synchronous loader failures", async () => {
    const cache = createPublicReadCache<number>({ ttlMs: 60_000, maxEntries: 2 });
    await expect(
      cache.get("league:71", () => {
        throw new Error("configuration unavailable");
      }),
    ).rejects.toThrow("configuration unavailable");
    expect(cache.size).toBe(0);
    expect(await cache.get("league:71", async () => 3)).toBe(3);
  });

  it("caches a successful empty result without confusing it with a failure", async () => {
    const cache = createPublicReadCache<null>({ ttlMs: 60_000, maxEntries: 2 });
    const load = vi.fn(async () => null);
    expect(await cache.get("missing:club", load)).toBeNull();
    expect(await cache.get("missing:club", load)).toBeNull();
    expect(load).toHaveBeenCalledTimes(1);
  });
});
