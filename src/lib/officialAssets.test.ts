import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fetchAssets, reportSilent, get, set } = vi.hoisted(() => ({
  fetchAssets: vi.fn(),
  reportSilent: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
}));
vi.mock("./silent-errors", () => ({ reportSilent }));
vi.mock("idb-keyval", () => ({ get, set }));

const data = { crests: { club: "https://images.example/crest.png" }, kits: {} };
let assets: typeof import("./officialAssets");
let stored: Map<string, string>;

beforeEach(async () => {
  vi.resetModules();
  fetchAssets.mockReset().mockImplementation(async () => Response.json(data));
  vi.stubGlobal("fetch", fetchAssets);
  reportSilent.mockReset();
  get.mockReset().mockResolvedValue(undefined);
  set.mockReset().mockResolvedValue(undefined);
  stored = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => stored.set(key, value),
  });
  assets = await import("./officialAssets");
});

afterEach(() => vi.unstubAllGlobals());

describe("official asset browser cache", () => {
  it("serves a fresh complete catalog without making a redundant server request", async () => {
    stored.set("manager3d.official.v3", JSON.stringify({ at: Date.now(), data }));
    await assets.loadOfficialAssets();
    await assets.loadOfficialAssets();
    expect(assets.officialCrest("club")).toBe(data.crests.club);
    expect(fetchAssets).not.toHaveBeenCalled();
  });

  it("invalidates the old potentially truncated catalog and writes the complete version", async () => {
    stored.set(
      "manager3d.official.v1",
      JSON.stringify({ at: Date.now(), data: { crests: {}, kits: {} } }),
    );
    await assets.loadOfficialAssets();
    expect(fetchAssets).toHaveBeenCalledExactlyOnceWith("/api/public/football-assets", {
      credentials: "omit",
    });
    expect(set).toHaveBeenCalledWith("manager3d.official.v3", {
      at: expect.any(Number),
      data,
    });
  });

  it("recovers from malformed cached data", async () => {
    stored.set("manager3d.official.v3", JSON.stringify({ at: Date.now(), data: null }));
    await assets.loadOfficialAssets();
    expect(fetchAssets).toHaveBeenCalledTimes(1);
    expect(assets.officialCrest("club")).toBe(data.crests.club);
  });

  it("refreshes the complete catalog when its freshness expires", async () => {
    stored.set("manager3d.official.v3", JSON.stringify({ at: Date.now() - 8 * 86_400_000, data }));
    await assets.loadOfficialAssets();
    expect(fetchAssets).toHaveBeenCalledTimes(1);
    const [key, written] = set.mock.calls[0]!;
    expect(key).toBe("manager3d.official.v3");
    expect(written.at).toBeGreaterThan(Date.now() - 1_000);
    expect(written.data).toEqual(data);
  });

  it("allows a later load to recover after an unavailable server response", async () => {
    fetchAssets.mockResolvedValueOnce(new Response(null, { status: 503 }));
    await assets.loadOfficialAssets();
    expect(assets.officialCrest("club")).toBeUndefined();
    await assets.loadOfficialAssets();
    expect(assets.officialCrest("club")).toBe(data.crests.club);
    expect(fetchAssets).toHaveBeenCalledTimes(2);
  });

  it("publishes downloaded crests without a synchronous catalogue write or waiting for persistence", async () => {
    set.mockImplementation(() => new Promise(() => {}));
    const listener = vi.fn();
    assets.subscribeOfficial(listener);
    await assets.loadOfficialAssets();
    expect(assets.officialCrest("club")).toBe(data.crests.club);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(stored.has("manager3d.official.v3")).toBe(false);
    expect(set).toHaveBeenCalledWith("manager3d.official.v3", {
      at: expect.any(Number),
      data,
    });
  });

  it("restores the complete asynchronous catalogue offline with one shared read", async () => {
    let finishRead!: (value: unknown) => void;
    get.mockImplementation(() => new Promise((resolve) => (finishRead = resolve)));
    const first = assets.loadOfficialAssets();
    const second = assets.loadOfficialAssets();
    expect(first).toBe(second);
    // Catalogue I/O now lives behind a real asynchronous module boundary.
    await vi.waitFor(() => expect(get).toHaveBeenCalledTimes(1));
    finishRead({ at: Date.now(), data });
    await first;
    expect(assets.officialCrest("club")).toBe(data.crests.club);
    expect(fetchAssets).not.toHaveBeenCalled();
  });

  it("can still read the existing offline catalogue when IndexedDB is unavailable", async () => {
    get.mockRejectedValue(new Error("storage denied"));
    stored.set("manager3d.official.v3", JSON.stringify({ at: Date.now(), data }));
    await assets.loadOfficialAssets();
    expect(assets.officialCrest("club")).toBe(data.crests.club);
    expect(fetchAssets).not.toHaveBeenCalled();
  });

  it("retains downloaded crests in memory if asynchronous persistence fails", async () => {
    set.mockRejectedValue(new Error("quota"));
    await assets.loadOfficialAssets();
    await Promise.resolve();
    expect(assets.officialCrest("club")).toBe(data.crests.club);
    expect(reportSilent).toHaveBeenCalledWith(
      "assets.cache",
      expect.any(Error),
      expect.objectContaining({ phase: "write", classification: "ignorable" }),
    );
  });

  it.each([
    { at: Date.now() - 8 * 86_400_000, data },
    { at: Date.now() + 8 * 86_400_000, data },
    { at: Date.now(), data: { crests: { club: 12 }, kits: {} } },
  ])("refreshes expired or malformed asynchronous catalogue data (%j)", async (cached) => {
    get.mockResolvedValue(cached);
    await assets.loadOfficialAssets();
    expect(fetchAssets).toHaveBeenCalledTimes(1);
    expect(assets.officialCrest("club")).toBe(data.crests.club);
    expect(set).toHaveBeenCalledWith("manager3d.official.v3", {
      at: expect.any(Number),
      data,
    });
  });

  it("does not open storage or request the catalogue merely by importing crest readers", () => {
    expect(assets.officialCrest("club")).toBeUndefined();
    expect(assets.officialKit("club")).toBeUndefined();
    expect(get).not.toHaveBeenCalled();
    expect(fetchAssets).not.toHaveBeenCalled();
  });

  it("keeps optional catalogue I/O idle and shares it with an eager load", async () => {
    let idle!: () => void;
    const requestIdleCallback = vi.fn((callback: () => void) => {
      idle = callback;
      return 7;
    });
    const cancelIdleCallback = vi.fn();
    vi.stubGlobal("window", { requestIdleCallback, cancelIdleCallback });
    const changed = vi.fn();
    assets.subscribeOfficial(changed);
    const cancel = assets.deferOfficialAssets();
    expect(requestIdleCallback).toHaveBeenCalledWith(expect.any(Function), { timeout: 2500 });
    expect(get).not.toHaveBeenCalled();
    expect(fetchAssets).not.toHaveBeenCalled();
    idle();
    await assets.loadOfficialAssets();
    expect(get).toHaveBeenCalledTimes(1);
    expect(fetchAssets).toHaveBeenCalledTimes(1);
    expect(changed).toHaveBeenCalledTimes(1);
    expect(assets.officialCrest("club")).toBe(data.crests.club);
    cancel();
    expect(cancelIdleCallback).toHaveBeenCalledWith(7);
  });

  it("cancels a pending picker load and uses a bounded timer on browsers without idle callbacks", () => {
    const clearTimeout = vi.fn();
    const setTimeout = vi.fn(() => 12);
    vi.stubGlobal("window", { setTimeout, clearTimeout });
    const cancel = assets.deferOfficialAssets();
    expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 1500);
    cancel();
    expect(clearTimeout).toHaveBeenCalledWith(12);
    expect(get).not.toHaveBeenCalled();
    expect(fetchAssets).not.toHaveBeenCalled();
  });
});
