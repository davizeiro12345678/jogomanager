import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const deps = vi.hoisted(() => ({
  failedTable: "",
  writes: [] as Array<{ table: string; rows: unknown }>,
  rpc: vi.fn(),
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    rpc: deps.rpc,
    from: (table: string) => {
      let writing = false;
      const q: Record<string, unknown> = {};
      for (const method of ["select", "eq", "in", "like", "not", "order", "range", "limit"])
        q[method] = () => q;
      q["upsert"] = (rows: unknown) => {
        writing = true;
        deps.writes.push({ table, rows });
        return q;
      };
      q["then"] = (resolve: (v: unknown) => unknown) =>
        resolve({
          error:
            !writing && deps.failedTable === table
              ? { message: "fixture database unavailable" }
              : null,
          data: writing
            ? []
            : table === "official_teams"
              ? [{ source_id: "af:10", local_club_id: "preserved-club" }]
              : [],
        });
      return q;
    },
  },
}));
import { runApiFootballImport } from "./apifootball-import.server";
beforeEach(() => {
  vi.resetAllMocks();
  deps.failedTable = "";
  deps.writes = [];
  vi.stubEnv("APIFOOTBALL_API_KEY", "fixture-only");
  deps.rpc.mockImplementation(async (name: string) => ({
    error: null,
    data:
      name === "list_api_football_league_targets"
        ? [{ source_id: "af:1", current_season: "2026", local_competition_id: "league-fixture" }]
        : true,
  }));
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({
        response: [
          {
            team: {
              id: 10,
              name: "Clube fixture",
              country: "Brasil",
              code: "FIX",
              founded: 1900,
              logo: "",
            },
            venue: { city: "Cidade" },
          },
        ],
      }),
    ),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("API-Football existing identity lookup", () => {
  it.each(["clubs", "official_teams"])(
    "does not create identities or advance a failed %s lookup",
    async (table) => {
      deps.failedTable = table;
      const result = await runApiFootballImport({
        phase: "teams",
        offset: 0,
        limit: 1,
        budgetMs: 10000,
      });
      expect(result.ok).toBe(false);
      expect(result.nextOffset).toBe(0);
      expect(deps.writes).toEqual([]);
    },
  );
  it("preserves an existing source mapping when both lookups succeed", async () => {
    const result = await runApiFootballImport({
      phase: "teams",
      offset: 0,
      limit: 1,
      budgetMs: 10000,
    });
    expect(result.ok).toBe(true);
    expect(deps.writes.some((x) => x.table === "clubs")).toBe(false);
    expect(deps.writes.find((x) => x.table === "official_teams")?.rows).toEqual([
      expect.objectContaining({ source_id: "af:10", local_club_id: "preserved-club" }),
    ]);
  });
});
