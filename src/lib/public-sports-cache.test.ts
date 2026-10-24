import { expect, it } from "vitest";
import { createPublicSportsCache, PublicSportsCacheBusyError } from "./public-sports-cache.server";

it("bounds origin work during high-cardinality misses and resumes after the flight settles", async () => {
  const cache = createPublicSportsCache({ maxEntries: 1 });
  let release!: (value: { points: number }) => void;
  let admitted = 0,
    bypassed = 0;
  const pending = cache.get("admitted", () => {
    admitted++;
    return new Promise<{ points: number }>((resolve) => {
      release = resolve;
    });
  });
  const coalesced = cache.get<{ points: number }>("admitted", async () => {
    throw new Error("must coalesce");
  });
  await Promise.resolve();
  await expect(
    cache.get("overflow", async () => {
      bypassed++;
      return { points: 3 };
    }),
  ).rejects.toBeInstanceOf(PublicSportsCacheBusyError);
  expect(admitted).toBe(1);
  expect(bypassed).toBe(0);
  expect(cache.stats().inFlight).toBe(1);
  expect(cache.metrics()).toMatchObject({ overloads: 1, coalesced: 1, failures: 0 });
  release({ points: 42 });
  const [first, second] = await Promise.all([pending, coalesced]);
  first.points = 0;
  expect(second.points).toBe(42);
  expect(cache.stats().inFlight).toBe(0);
  expect(
    await cache.get("overflow", async () => {
      bypassed++;
      return { points: 3 };
    }),
  ).toEqual({ points: 3 });
  expect(bypassed).toBe(1);
});

it("returns an independent allowed stale snapshot under saturation without starting the origin", async () => {
  let time = 0,
    originCalls = 0;
  const cache = createPublicSportsCache({
    maxEntries: 1,
    ttlMs: 10,
    errorStaleMs: 100,
    now: () => time,
  });
  await cache.get("stale", async () => ({ nested: { points: 42 } }));
  time = 11;
  let release!: (value: null) => void;
  const pending = cache.get(
    "occupied",
    () =>
      new Promise<null>((resolve) => {
        release = resolve;
      }),
  );
  await Promise.resolve();
  const refresh = async () => {
    originCalls++;
    throw new Error("origin must not start");
  };
  const first = (await cache.get("stale", refresh)) as { nested: { points: number } };
  first.nested.points = 0;
  expect(await cache.get("stale", refresh)).toEqual({ nested: { points: 42 } });
  expect(originCalls).toBe(0);
  expect(cache.metrics()).toMatchObject({ overloads: 2, staleFallbacks: 2, failures: 0 });
  time = 110;
  await expect(cache.get("stale", refresh)).rejects.toBeInstanceOf(PublicSportsCacheBusyError);
  expect(cache.metrics()).toMatchObject({ overloads: 3, staleFallbacks: 2 });
  release(null);
  await pending;
  expect(cache.stats().inFlight).toBe(0);
  await expect(
    cache.get("stale", async () => {
      throw new Error("offline");
    }),
  ).rejects.toThrow("offline");
  expect(cache.metrics().failures).toBe(1);
  expect(cache.stats().inFlight).toBe(0);
});

it("serves a bounded public fallback during an outage and backs off repeated origin failures", async () => {
  let time = 0,
    calls = 0;
  const cache = createPublicSportsCache({ ttlMs: 100, errorStaleMs: 3_000, now: () => time });
  await cache.get("league", async () => ({ name: "Bundesliga" }));
  const offline = async () => {
    calls++;
    throw new Error("offline");
  };
  time = 110;
  expect(await cache.get("league", offline)).toEqual({ name: "Bundesliga" });
  time = 120;
  expect(await cache.get("league", offline)).toEqual({ name: "Bundesliga" });
  expect(calls).toBe(1);
  time = 2_111;
  expect(await cache.get("league", async () => ({ name: "Updated" }))).toEqual({ name: "Updated" });
  expect(cache.stats().entries).toBe(1);
  time = 5_212;
  await expect(cache.get("league", offline)).rejects.toThrow("offline");
});
it("does not resurrect a public record after a successful missing response", async () => {
  let time = 0;
  const cache = createPublicSportsCache({ ttlMs: 10, errorStaleMs: 100, now: () => time });
  await cache.get("club", async () => ({ name: "Before" }));
  time = 11;
  expect(await cache.get("club", async () => null)).toBeNull();
  expect(cache.stats().bytes).toBe(0);
  await expect(
    cache.get("club", async () => {
      throw new Error("offline");
    }),
  ).rejects.toThrow();
});

it("coalesces concurrent reads and expires from successful completion", async () => {
  let time = 0,
    calls = 0;
  const cache = createPublicSportsCache({ ttlMs: 30, now: () => time });
  const loader = async () => {
    calls++;
    return { points: 42 };
  };
  const values = await Promise.all(
    Array.from({ length: 20 }, () => cache.get("league:71", loader)),
  );
  expect(calls).toBe(1);
  values[0]!.points = 0;
  expect(values[1]!.points).toBe(42);
  time = 29;
  expect((await cache.get("league:71", loader)).points).toBe(42);
  expect(calls).toBe(1);
  time = 30;
  await cache.get("league:71", loader);
  expect(calls).toBe(2);
});

it("keeps public projections warm for the default 60-second TTL", async () => {
  let time = 0,
    calls = 0;
  const cache = createPublicSportsCache({ now: () => time });
  const loader = async () => ++calls;

  await cache.get("league:71", loader);
  time = 59_999;
  expect(await cache.get("league:71", loader)).toBe(1);
  expect(calls).toBe(1);
  time = 60_000;
  expect(await cache.get("league:71", loader)).toBe(2);
  expect(calls).toBe(2);
});

it("retries failures and missing records without caching them", async () => {
  const cache = createPublicSportsCache();
  await expect(
    cache.get("club:x", async () => {
      throw new Error("offline");
    }),
  ).rejects.toThrow("offline");
  expect(cache.stats()).toEqual({ entries: 0, bytes: 0, inFlight: 0 });
  await cache.get("club:x", async () => null);
  expect(cache.stats().entries).toBe(0);
  expect(await cache.get("club:x", async () => "online")).toBe("online");
});

it("bounds memory, evicts least recently used records and skips oversized values", async () => {
  const cache = createPublicSportsCache({ maxEntries: 2, maxBytes: 32 });
  await cache.get("a", async () => "one");
  await cache.get("b", async () => "two");
  await cache.get("a", async () => "wrong");
  await cache.get("c", async () => "three");
  expect(await cache.get("b", async () => "new")).toBe("new");
  await cache.get("big", async () => "x".repeat(64));
  expect(cache.stats().entries).toBeLessThanOrEqual(2);
  expect(cache.stats().bytes).toBeLessThanOrEqual(32);
});
