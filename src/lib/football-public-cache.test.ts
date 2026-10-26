import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  responses: [] as Array<{
    table: string;
    data: Array<Record<string, unknown>> | null;
    error: unknown;
  }>,
  calls: [] as Array<{ table: string; projection?: string; clubId?: string }>,
}));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const builder = { validator: () => builder, handler: (handler: unknown) => handler };
    return builder;
  },
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: (table: string) => {
      const call: { table: string; projection?: string; clubId?: string } = { table };
      const query = {
        select: (projection: string) => {
          call.projection = projection;
          return query;
        },
        eq: (column: string, value: string) => {
          if (column === "club_id") call.clubId = value;
          return query;
        },
        in: (column: string, values: string[]) => {
          if (column === "club_id" && values[0] !== undefined) call.clubId = values[0];
          return query;
        },
        is: () => query,
        not: () => query,
        order: () => query,
        limit: () => query,
        gt: () => query,
        then: (resolve: (value: unknown) => unknown) => {
          fixture.calls.push(call);
          const index = fixture.responses.findIndex((response) => response.table === table);
          const response =
            index < 0 ? { data: [], error: null } : fixture.responses.splice(index, 1)[0];
          return Promise.resolve(response).then(resolve);
        },
      };
      return query;
    },
  }),
}));
beforeEach(() => {
  vi.resetModules();
  fixture.responses.length = 0;
  fixture.calls.length = 0;
  vi.stubEnv("SUPABASE_URL", "https://public-cache-fixture.supabase.co");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_fixture");
  vi.stubEnv("LOGO_DEV_API_KEY", "");
});
afterEach(() => vi.unstubAllEnvs());

describe("bounded public football projections", () => {
  it("coalesces simultaneous asset lookups and returns independent cached snapshots", async () => {
    fixture.responses.push(
      {
        table: "clubs",
        data: [{ id: "fla", crest_url: "https://images.example/crest.png" }],
        error: null,
      },
      {
        table: "kits",
        data: [{ id: "kit-fla", club_id: "fla", image_url: "https://images.example/kit.png" }],
        error: null,
      },
    );
    const { getOfficialAssets } = await import("./football.functions");
    const [first, second, third] = await Promise.all([
      getOfficialAssets(),
      getOfficialAssets(),
      getOfficialAssets(),
    ]);
    // Independent public projections run concurrently: their completion/order
    // is not a contract, but both should fetch and then terminate pagination.
    expect(fixture.calls.map((call) => call.table).sort()).toEqual([
      "clubs",
      "clubs",
      "kits",
      "kits",
    ]);
    expect(second.kits["fla"]).toBe("https://images.example/kit.png");
    first.crests["fla"] = "changed by caller";
    third.kits["fla"] = "changed by caller";
    const next = await getOfficialAssets();
    expect(next.crests["fla"]).toBe("https://images.example/crest.png");
    expect(next.kits["fla"]).toBe("https://images.example/kit.png");
    expect(fixture.calls).toHaveLength(4);
  });

  it("does not cache an asset lookup that failed halfway", async () => {
    fixture.responses.push(
      {
        table: "clubs",
        data: [{ id: "fla", crest_url: "https://images.example/crest.png" }],
        error: null,
      },
      { table: "kits", data: null, error: { message: "provider-private-error" } },
    );
    const { getOfficialAssets } = await import("./football.functions");
    await expect(getOfficialAssets()).rejects.toThrow("dados completos");
    fixture.responses.push(
      {
        table: "clubs",
        data: [{ id: "fla", crest_url: "https://images.example/crest.png" }],
        error: null,
      },
      {
        table: "kits",
        data: [
          { id: "kit-fla", club_id: "fla", image_url: "https://images.example/recovered.png" },
        ],
        error: null,
      },
    );
    const callsBeforeRetry = fixture.calls.length;
    expect((await getOfficialAssets()).kits["fla"]).toBe("https://images.example/recovered.png");
    // Promise.all may reject before the other independent projection finishes
    // its final empty page. The important guarantee is that both projections
    // are fetched again and no partial result is retained.
    const retryCalls = fixture.calls.slice(callsBeforeRetry).map((call) => call.table);
    expect(retryCalls).toContain("clubs");
    expect(retryCalls).toContain("kits");
  });

  it("keeps public squad cache keys separate and preserves source identity", async () => {
    fixture.responses.push({
      table: "players",
      data: [{ id: "one", data_source: "thesportsdb", position: "MF" }],
      error: null,
    });
    const { getRealSquad } = await import("./football.functions");
    const [first, duplicate] = await Promise.all([
      getRealSquad({ data: { clubId: "fla" } }),
      getRealSquad({ data: { clubId: "fla" } }),
    ]);
    first[0]!.name = "caller mutation";
    expect(duplicate[0]?.id).toBe("one");
    expect(duplicate[0]?.data_source).toBe("thesportsdb");
    fixture.responses.push({
      table: "players",
      data: [{ id: "two", data_source: "api-football", position: "DF" }],
      error: null,
    });
    const other = await getRealSquad({ data: { clubId: "pal" } });
    expect(other[0]?.id).toBe("two");
    const playerCalls = fixture.calls.filter((call) => call.table === "players");
    expect(playerCalls.map((call) => call.clubId)).toEqual(["fla", "fla", "pal", "pal"]);
    expect(fixture.calls.filter((call) => call.table === "club_catalog_links")).toHaveLength(2);
    expect(fixture.calls.filter((call) => call.table === "player_identity_aliases")).toHaveLength(
      2,
    );
    for (const call of playerCalls) {
      expect(call.projection).toContain("data_source:source");
      expect(call.projection).toContain("source_kind, canonical_player_id");
      expect(call.projection).not.toBe("*");
    }
  });

  it("retries a failed paginated squad instead of retaining a partial roster", async () => {
    fixture.responses.push(
      {
        table: "players",
        data: Array.from({ length: 50 }, (_, i) => ({ id: `p${i}`, position: "MF" })),
        error: null,
      },
      { table: "players", data: null, error: { message: "provider-private-error" } },
      { table: "players", data: [{ id: "complete", position: "FW" }], error: null },
    );
    const { getRealSquad } = await import("./football.functions");
    await expect(getRealSquad({ data: { clubId: "fla" } })).rejects.toThrow(
      "Não foi possível carregar os dados completos de futebol.",
    );
    expect((await getRealSquad({ data: { clubId: "fla" } })).map((row) => row.id)).toEqual([
      "complete",
    ]);
    expect(fixture.calls.filter((call) => call.table === "players")).toHaveLength(4);
    expect(fixture.calls.filter((call) => call.table === "club_catalog_links")).toHaveLength(1);
    expect(fixture.calls.filter((call) => call.table === "player_identity_aliases")).toHaveLength(
      1,
    );
  });
});
