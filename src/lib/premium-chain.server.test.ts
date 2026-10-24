import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
type QueryCall = { table: string; operation?: string; value?: unknown; filters: unknown[][] };
const fixture = vi.hoisted(() => ({
  responses: [] as Array<{ table: string; data?: unknown; error?: { message: string } | null }>,
  calls: [] as QueryCall[],
  listTeams: vi.fn(),
  lookupTeam: vi.fn(),
  lookupVenue: vi.fn(),
  lookupPlayer: vi.fn(),
  teamEquipment: vi.fn(),
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      const call: QueryCall = { table, filters: [] };
      const query = {
        select: () => query,
        upsert: (value: unknown) => {
          call.operation = "upsert";
          call.value = value;
          return query;
        },
        update: (value: unknown) => {
          call.operation = "update";
          call.value = value;
          return query;
        },
        eq: (...args: unknown[]) => {
          call.filters.push(["eq", ...args]);
          return query;
        },
        in: (...args: unknown[]) => {
          call.filters.push(["in", ...args]);
          return query;
        },
        not: (...args: unknown[]) => {
          call.filters.push(["not", ...args]);
          return query;
        },
        or: (...args: unknown[]) => {
          call.filters.push(["or", ...args]);
          return query;
        },
        order: () => query,
        range: (...args: unknown[]) => {
          call.filters.push(["range", ...args]);
          return query;
        },
        single: () => query,
        then: (resolve: (value: unknown) => unknown) => {
          fixture.calls.push(call);
          const response = fixture.responses.shift();
          expect(response?.table).toBe(table);
          return Promise.resolve({
            data: response?.data ?? null,
            error: response?.error ?? null,
          }).then(resolve);
        },
      };
      return query;
    },
  },
}));
vi.mock("./thesportsdb-v2.server", async (original) => ({
  ...(await original<typeof import("./thesportsdb-v2.server")>()),
  sdbV2: fixture,
}));
import { syncPremiumChain } from "./premium-chain.server";

beforeEach(() => {
  fixture.responses.length = 0;
  fixture.calls.length = 0;
  for (const mock of [
    fixture.listTeams,
    fixture.lookupTeam,
    fixture.lookupVenue,
    fixture.lookupPlayer,
    fixture.teamEquipment,
  ])
    mock.mockReset();
  fixture.teamEquipment.mockResolvedValue([]);
});
afterEach(() => vi.restoreAllMocks());

describe("integrated premium import compatibility", () => {
  it("imports a bounded kits phase for already linked teams without falling through to events", async () => {
    fixture.responses.push(
      { table: "official_teams", data: [{ source_id: "team-1", local_club_id: "fla" }] },
      { table: "kits", data: null },
    );
    fixture.teamEquipment.mockResolvedValue([
      { strEquipment: "https://images.example.test/kit.png", strSeason: "2026", strType: "Away" },
      { strEquipment: "javascript:invalid", strSeason: "2026" },
    ]);
    const result = await syncPremiumChain({ phase: "kits", limit: 1, offset: 2, budgetMs: 5000 });
    expect(result).toMatchObject({ phase: "kits", processed: 1, imported: 1, nextOffset: 3 });
    expect(fixture.calls.map((call) => call.table)).toEqual(["official_teams", "kits"]);
    expect(fixture.calls[0]?.filters).toContainEqual(["range", 2, 2]);
    expect(fixture.calls[1]?.value).toMatchObject({ club_id: "fla", kind: "away", season: "2026" });
  });

  it("resumes a league from stored team identities without advancing an unfinished league", async () => {
    let now = 0;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    fixture.responses.push(
      { table: "official_leagues", data: [{ source_id: "league-1", local_competition_id: null }] },
      { table: "official_teams", data: [{ source_id: "done" }] },
      { table: "official_teams" },
    );
    fixture.listTeams.mockResolvedValue([
      { idTeam: "done", strTeam: "Completed" },
      { idTeam: "new", strTeam: "New" },
      { idTeam: "deferred", strTeam: "Deferred" },
    ]);
    fixture.lookupTeam.mockImplementation(async (_id: string) => {
      now = 5000;
      return null;
    });
    const first = await syncPremiumChain({ phase: "teams", limit: 1, offset: 0, budgetMs: 5000 });
    expect(first).toMatchObject({ processed: 0, imported: 1, nextOffset: 0 });
    expect(fixture.lookupTeam.mock.calls).toEqual([["new"]]);
    now = 0;
    fixture.lookupTeam.mockReset().mockResolvedValue(null);
    fixture.responses.push(
      { table: "official_leagues", data: [{ source_id: "league-1", local_competition_id: null }] },
      { table: "official_teams", data: [{ source_id: "done" }, { source_id: "new" }] },
      { table: "official_teams" },
    );
    const second = await syncPremiumChain({ phase: "teams", limit: 1, offset: 0, budgetMs: 5000 });
    expect(second).toMatchObject({ processed: 1, imported: 1, nextOffset: 1 });
    expect(fixture.lookupTeam.mock.calls).toEqual([["deferred"]]);
  });

  it("preserves venue source identity when two venues share a unique display name", async () => {
    fixture.responses.push(
      { table: "official_leagues", data: [{ source_id: "league-1", local_competition_id: null }] },
      { table: "official_teams", data: [] },
      { table: "official_teams" },
      { table: "stadiums", error: { message: "duplicate stadiums_name_key" } },
      { table: "stadiums", error: { message: "duplicate stadiums_name_key" } },
      { table: "stadiums", data: { id: "stadium-local-1" } },
    );
    fixture.listTeams.mockResolvedValue([
      { idTeam: "team-1", strTeam: "Clube", idVenue: "venue-1" },
    ]);
    fixture.lookupTeam.mockResolvedValue(null);
    fixture.lookupVenue.mockResolvedValue({ strVenue: "Estadio Municipal", strCity: "Centro" });
    await syncPremiumChain({ phase: "teams", limit: 1, offset: 0, budgetMs: 5000 });
    const venues = fixture.calls
      .filter((call) => call.table === "stadiums")
      .map((call) => call.value as Row);
    expect(venues.map((value) => value["name"])).toEqual([
      "Estadio Municipal",
      "Estadio Municipal (Centro)",
      "Estadio Municipal (venue-1)",
    ]);
    expect(venues.every((value) => value["source_id"] === "venue-1")).toBe(true);
  });

  it("retains alias lookup and timestamp guards for existing player identities", async () => {
    fixture.responses.push(
      { table: "players", data: [{ id: "player-local", source_id: "alias-1" }] },
      {
        table: "sportsdb_player_aliases",
        data: [{ alias_source_id: "alias-1", canonical_source_id: "canonical-1" }],
      },
      { table: "official_media" },
      { table: "players" },
    );
    fixture.lookupPlayer.mockResolvedValue({
      strThumb: "https://images.example.test/player.png",
      dateUpdated: "2026-10-20",
    });
    await syncPremiumChain({ phase: "players", limit: 1, offset: 0, budgetMs: 5000 });
    expect(fixture.lookupPlayer).toHaveBeenCalledWith("canonical-1");
    const update = fixture.calls.find(
      (call) => call.table === "players" && call.operation === "update",
    );
    expect(update?.filters).toContainEqual(["eq", "id", "player-local"]);
    expect(update?.filters).toContainEqual([
      "or",
      "source_updated_at.is.null,source_updated_at.lt.2026-10-20T00:00:00.000Z",
    ]);
  });
});
