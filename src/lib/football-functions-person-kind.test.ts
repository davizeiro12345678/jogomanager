import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  pages: [] as Array<{ data: Array<Record<string, unknown>>; error: null }>,
  projections: [] as string[],
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
      const query = {
        select: (projection: string) => {
          if (table === "players") fixture.projections.push(projection);
          return query;
        },
        eq: () => query,
        is: () => query,
        in: () => query,
        order: () => query,
        limit: () => query,
        range: () => query,
        gt: () => query,
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve(
            (table === "players" ? fixture.pages.shift() : null) ?? { data: [], error: null },
          ).then(resolve),
      };
      return query;
    },
  }),
}));
vi.mock("@/integrations/supabase/client.server", async () => {
  const { createClient } = await import("@supabase/supabase-js");
  return { supabaseAdmin: createClient("https://role-fixture.supabase.co", "sb_secret_fixture") };
});
beforeEach(() => {
  vi.resetModules();
  fixture.pages.length = 0;
  fixture.projections.length = 0;
  vi.stubEnv("SUPABASE_URL", "https://role-fixture.supabase.co");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_fixture");
});
afterEach(() => vi.unstubAllEnvs());
describe("public football role admission", () => {
  it("reads only the public squad projection and excludes staff and retained aliases", async () => {
    const { getRealSquad } = await import("./football.functions");
    fixture.pages.push({
      data: [
        { id: "staff", source: "thesportsdb", source_kind: "staff", position: "MF" },
        {
          id: "retained-alias",
          source: "thesportsdb",
          source_kind: "player",
          position: "MF",
          canonical_player_id: "canonical-42",
        },
        { id: "legacy-player", data_source: "thesportsdb", position: "MF" },
      ],
      error: null,
    });
    const rows = await getRealSquad({ data: { clubId: "flu" } });
    expect(rows.map((row) => row.id)).toEqual(["legacy-player"]);
    expect(rows[0]?.data_source).toBe("thesportsdb");
    expect(fixture.projections).toHaveLength(2);
    for (const projection of fixture.projections) {
      expect(projection).toContain("source_kind, canonical_player_id");
      expect(projection).toContain("data_source:source");
      expect(projection).not.toBe("*");
    }
  });
  it("keeps the raw page cursor even when staff rows are filtered from the market", async () => {
    const { searchRealPlayers } = await import("./football.functions");
    fixture.pages.push({
      data: Array.from({ length: 25 }, (_, index) => ({
        id: `person-${index}`,
        position: "MF",
        source_kind: index === 1 ? "player" : "staff",
      })),
      error: null,
    });
    const result = await searchRealPlayers({ data: { page: 0 } });
    expect(result.rows.map((row) => row.id)).toEqual(["person-1"]);
    expect(result.hasMore).toBe(true);
    expect(fixture.projections).toEqual([
      "id, source, source_id, source_kind, canonical_player_id, birth_date, name, position, age, shirt_number, nationality, overall, photo_url, club_id",
    ]);
  });
});
