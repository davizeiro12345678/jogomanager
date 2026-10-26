import { afterEach, beforeEach, expect, it, vi } from "vitest";

const origin = vi.hoisted(() => ({
  clubs: [] as Array<Record<string, string | null>>,
  kits: [] as Array<Record<string, string | null>>,
  failTable: "",
  calls: [] as Array<{ table: string; cursor: string; limit: number }>,
}));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const builder = { validator: () => builder, handler: (handler: unknown) => handler };
    return builder;
  },
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: (table: "clubs" | "kits") => {
      let cursor = "",
        limit = 1000;
      const query = {
        select: () => query,
        eq: () => query,
        not: () => query,
        order: () => query,
        limit: (value: number) => {
          limit = Math.min(value, 1000);
          return query;
        },
        gt: (_column: string, value: string) => {
          cursor = value;
          return query;
        },
        then: (resolve: (value: unknown) => unknown) => {
          origin.calls.push({ table, cursor, limit });
          return Promise.resolve(
            origin.failTable === table && cursor
              ? { data: null, error: new Error("page two unavailable") }
              : {
                  data: origin[table].filter((row) => row["id"]! > cursor).slice(0, limit),
                  error: null,
                },
          ).then(resolve);
        },
      };
      return query;
    },
  }),
}));
beforeEach(() => {
  vi.resetModules();
  origin.failTable = "";
  origin.calls = [];
  vi.stubEnv("SUPABASE_URL", "https://public-assets-fixture.supabase.co");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_fixture");
  vi.stubEnv("LOGO_DEV_API_KEY", "");
  origin.clubs = Array.from({ length: 1205 }, (_, i) => ({
    id: `club-${String(i).padStart(5, "0")}`,
    crest_url: `https://example.test/${i}.png`,
    website: null,
  }));
  origin.kits = Array.from({ length: 1205 }, (_, i) => ({
    id: `kit-${String(i).padStart(5, "0")}`,
    club_id: `club-${String(i).padStart(5, "0")}`,
    image_url: `https://example.test/kit-${i}.png`,
  }));
});
afterEach(() => vi.unstubAllEnvs());

it("loads every official asset past the Data API default row ceiling using stable cursors", async () => {
  const { getOfficialAssets } = await import("./football.functions");
  const assets = await getOfficialAssets();
  expect(Object.keys(assets.crests)).toHaveLength(1205);
  expect(Object.keys(assets.kits)).toHaveLength(1205);
  expect(assets.crests["club-01204"]).toBe("https://example.test/1204.png");
  expect(assets.kits["club-01204"]).toBe("https://example.test/kit-1204.png");
  expect(origin.calls.filter((c) => c.cursor)).toHaveLength(4);
  expect(origin.calls.every((c) => c.limit <= 1000)).toBe(true);
});

it.each(["clubs", "kits"])(
  "rejects a failed later %s page without caching partial assets",
  async (table) => {
    origin.failTable = table;
    const { getOfficialAssets } = await import("./football.functions");
    await expect(getOfficialAssets()).rejects.toThrow();
    origin.failTable = "";
    const complete = await getOfficialAssets();
    expect(Object.keys(complete.crests)).toHaveLength(1205);
    expect(Object.keys(complete.kits)).toHaveLength(1205);
    const calls = origin.calls.length;
    expect(await getOfficialAssets()).toEqual(complete);
    expect(origin.calls).toHaveLength(calls);
  },
);
