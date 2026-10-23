import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getOfficialAssets, reportSilent } = vi.hoisted(() => ({
  getOfficialAssets: vi.fn(),
  reportSilent: vi.fn(),
}));
vi.mock("./football.functions", () => ({ getOfficialAssets }));
vi.mock("./silent-errors", () => ({ reportSilent }));

const data = { crests: { club: "https://images.example/crest.png" }, kits: {} };
let assets: typeof import("./officialAssets");
let stored: Map<string, string>;

beforeEach(async () => {
  vi.resetModules();
  getOfficialAssets.mockReset().mockResolvedValue(data);
  reportSilent.mockReset();
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
    expect(getOfficialAssets).not.toHaveBeenCalled();
  });

  it("invalidates the old potentially truncated catalog and writes the complete version", async () => {
    stored.set(
      "manager3d.official.v1",
      JSON.stringify({ at: Date.now(), data: { crests: {}, kits: {} } }),
    );
    await assets.loadOfficialAssets();
    expect(getOfficialAssets).toHaveBeenCalledTimes(1);
    expect(JSON.parse(stored.get("manager3d.official.v3")!).data).toEqual(data);
  });

  it("recovers from malformed cached data", async () => {
    stored.set("manager3d.official.v3", JSON.stringify({ at: Date.now(), data: null }));
    await assets.loadOfficialAssets();
    expect(getOfficialAssets).toHaveBeenCalledTimes(1);
    expect(assets.officialCrest("club")).toBe(data.crests.club);
  });

  it("refreshes the complete catalog when its freshness expires", async () => {
    stored.set("manager3d.official.v3", JSON.stringify({ at: Date.now() - 8 * 86_400_000, data }));
    await assets.loadOfficialAssets();
    expect(getOfficialAssets).toHaveBeenCalledTimes(1);
    expect(JSON.parse(stored.get("manager3d.official.v3")!).at).toBeGreaterThan(Date.now() - 1_000);
  });

  it("allows a later load to recover after an unavailable server response", async () => {
    getOfficialAssets.mockRejectedValueOnce(new Error("offline")).mockResolvedValue(data);
    await assets.loadOfficialAssets();
    expect(assets.officialCrest("club")).toBeUndefined();
    await assets.loadOfficialAssets();
    expect(assets.officialCrest("club")).toBe(data.crests.club);
    expect(getOfficialAssets).toHaveBeenCalledTimes(2);
  });
});
