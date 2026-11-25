import { describe, expect, it, vi } from "vitest";
import { serveOfficialAssets } from "./official-assets-response.server";
const request = new Request("https://staging.example/api/public/football-assets?arbitrary=1");
const catalog = { crests: { club: "https://images.example/crest.png" }, kits: {} };
function edgeCache() {
  const entries = new Map<string, Response>();
  return {
    match: vi.fn(async (key: Request) => entries.get(key.url)?.clone()),
    put: vi.fn(async (key: Request, response: Response) => {
      entries.set(key.url, response.clone());
    }),
  };
}
describe("public asset HTTP resilience", () => {
  it("reuses completed public catalog across cold request handlers", async () => {
    const cache = edgeCache();
    const load = vi.fn(async () => catalog);
    expect(await (await serveOfficialAssets(request, load, cache)).json()).toEqual(catalog);
    const next = new Request("https://staging.example/api/public/football-assets?arbitrary=2");
    expect(await (await serveOfficialAssets(next, load, cache)).json()).toEqual(catalog);
    expect(load).toHaveBeenCalledTimes(1);
    expect(cache.put).toHaveBeenCalledTimes(1);
  });
  it("keeps staging and production caches distinct", async () => {
    const cache = edgeCache();
    const load = vi.fn(async () => catalog);
    await serveOfficialAssets(request, load, cache);
    await serveOfficialAssets(
      new Request("https://production.example/api/public/football-assets"),
      load,
      cache,
    );
    expect(load).toHaveBeenCalledTimes(2);
  });
  it("does not cache an empty catalog or conceal an upstream failure", async () => {
    const cache = edgeCache();
    const empty = async () => ({ crests: {}, kits: {} });
    expect((await serveOfficialAssets(request, empty, cache)).status).toBe(200);
    expect(cache.put).not.toHaveBeenCalled();
    const response = await serveOfficialAssets(
      request,
      async () => {
        throw new Error("secret detail");
      },
      cache,
    );
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("retry-after")).toBe("30");
    expect(await response.text()).not.toContain("secret detail");
    expect(cache.put).not.toHaveBeenCalled();
  });
  it("continues when the optional edge cache fails", async () => {
    const cache = edgeCache();
    cache.match.mockRejectedValueOnce(new Error("cache unavailable"));
    cache.put.mockRejectedValueOnce(new Error("cache unavailable"));
    expect(await (await serveOfficialAssets(request, async () => catalog, cache)).json()).toEqual(
      catalog,
    );
  });
});
