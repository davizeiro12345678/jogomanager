import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runApiFootballImport } from "./apifootball-import.server";
import { FIXTURE_ENDPOINTS, LEADER_ENDPOINTS } from "./apifootball-phases";

const db = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: db,
}));

function payload(response: unknown[], paging?: { current: number; total: number }) {
  return new Response(JSON.stringify({ response, errors: [], paging }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("API-Football high-yield importer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env["APIFOOTBALL_API_KEY"] = "test-key-not-a-real-credential";
    db.rpc.mockImplementation(async (name: string) => {
      if (name === "reserve_api_football_quota") return { data: true, error: null };
      if (name === "list_api_football_team_targets")
        return {
          data: [{ source_id: "af:33", league_source_id: "af:39", local_club_id: "club-33" }],
          error: null,
        };
      if (name === "list_api_football_league_targets")
        return {
          data: [{ source_id: "af:39", current_season: "2026", coverage: {} }],
          error: null,
        };
      return { data: [], error: null };
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env["APIFOOTBALL_API_KEY"];
  });

  it("skips an empty squad without aborting or repeating the target", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => payload([])),
    );
    const result = await runApiFootballImport({
      phase: "squads",
      offset: 0,
      limit: 1,
      budgetMs: 50_000,
    });
    expect(result).toMatchObject({
      ok: true,
      processed: 1,
      skipped: 1,
      created: 0,
      nextOffset: 1,
    });
    expect(db.from).not.toHaveBeenCalled();
  });

  it("classifies team mappings as football so the link trigger cannot discard them", async () => {
    const mappings: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        payload([
          {
            team: {
              id: 33,
              name: "Test Club",
              country: "Brazil",
              code: "TST",
              founded: 1900,
              logo: "https://images.example/team.png",
            },
            venue: {
              id: 204,
              name: "Venue",
              city: "City",
              capacity: 78838,
              image: "https://images.example/venue.png",
            },
          },
        ]),
      ),
    );
    db.from.mockImplementation((table: string) => {
      const query = {
        select: () => query,
        eq: () => query,
        limit: async () => ({ data: [{ id: "af33", name: "Test Club" }], error: null }),
        in: async () => ({ data: [{ source_id: "af:33", local_club_id: "af33" }], error: null }),
        upsert: async (rows: unknown[]) => {
          mappings.push(...rows);
          return { error: null };
        },
      };
      if (table === "clubs" || table === "official_teams") return query;
      throw new Error(`Unexpected table ${table}`);
    });
    expect(
      await runApiFootballImport({ phase: "teams", offset: 0, limit: 2, budgetMs: 50000 }),
    ).toMatchObject({ ok: true, processed: 1, nextOffset: null });
    expect(mappings).toEqual([
      expect.objectContaining({ source_id: "af:33", sport: "Soccer", local_club_id: "af33" }),
    ]);
    expect(db.rpc).toHaveBeenCalledWith("enrich_football_venues", {
      p_venues: [
        expect.objectContaining({ id: "204", team_id: "33", country: "Brazil", capacity: 78838 }),
      ],
    });
  });

  it("deduplicates repeated fixture IDs before the conflict-safe event write", async () => {
    const fixture = {
      fixture: { id: 300, date: "2026-10-20T18:00:00Z", status: { short: "NS" }, venue: null },
      teams: { home: { id: 33, name: "Home" }, away: { id: 34, name: "Away" } },
      goals: null,
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => payload([fixture, fixture])),
    );
    const upsert = vi.fn(async () => ({ error: null }));
    db.from.mockReturnValue({ upsert });
    const result = await runApiFootballImport({
      phase: "fixtures",
      offset: 0,
      limit: 2,
      budgetMs: 50000,
    });
    expect(result).toMatchObject({ ok: true, processed: 1, created: 1, nextOffset: null });
    expect(upsert).toHaveBeenCalledWith(
      [expect.objectContaining({ source_id: "af:300", venue_source_id: null, home_score: null })],
      { onConflict: "source_id" },
    );
  });

  it("writes a deduplicated squad in one conflict-safe upsert", async () => {
    const player = {
      id: 42,
      name: "Test Player",
      age: 23,
      number: 7,
      position: "Attacker",
      photo: "https://example.test/42.png",
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        payload([
          { team: { id: 33 }, players: [player, player, { ...player, id: 43, position: "Coach" }] },
        ]),
      ),
    );
    const upsert = vi.fn((_rows: unknown[], _options: Record<string, unknown>) => ({
      select: async () => ({
        data: [{ id: "created" }],
        error: null,
      }),
    }));
    db.from.mockImplementation((table: string) => {
      if (table === "players") return { upsert };
      throw new Error(`Unexpected table ${table}`);
    });

    const result = await runApiFootballImport({
      phase: "squads",
      offset: 0,
      limit: 1,
      budgetMs: 50_000,
    });
    expect(result).toMatchObject({
      ok: true,
      processed: 1,
      skipped: 0,
      created: 1,
      nextOffset: 1,
    });
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert.mock.calls[0]?.[0]).toHaveLength(1);
    expect(upsert.mock.calls[0]?.[1]).toMatchObject({
      onConflict: "source,source_id",
      ignoreDuplicates: true,
    });
  });

  function rawStore(targetTable?: string, targets: unknown[] = []) {
    const writes: { kind: string; ref: string; payload: unknown }[] = [];
    const filters: unknown[][] = [];
    const query = {
      select: () => query,
      eq: (...args: unknown[]) => {
        filters.push(args);
        return query;
      },
      is: (...args: unknown[]) => {
        filters.push(args);
        return query;
      },
      not: () => query,
      like: () => query,
      in: () => query,
      order: () => query,
      range: async () => ({ data: targets, error: null }),
    };
    db.from.mockImplementation((table: string) => {
      if (table === "api_football_data")
        return {
          upsert: async (rows: typeof writes, options: unknown) => {
            expect(options).toEqual({ onConflict: "kind,ref" });
            writes.push(...rows);
            return { error: null };
          },
        };
      if (table === targetTable) return query;
      throw new Error(`Unexpected table ${table}`);
    });
    return { writes, filters };
  }

  it("resumes player profiles by provider page and deduplicates stable identities", async () => {
    const { writes } = rawStore();
    const request = vi.fn(async (_input: RequestInfo | URL) =>
      payload(
        [
          { player: { id: 7 } },
          { player: { id: 7 } },
          { player: { id: 8 } },
          { player: { id: 0 } },
        ],
        { current: 3, total: 4 },
      ),
    );
    vi.stubGlobal("fetch", request);
    const result = await runApiFootballImport({
      phase: "playerprofiles",
      offset: 2,
      limit: 10,
      budgetMs: 50000,
    });
    expect(result).toMatchObject({ ok: true, processed: 1, created: 2, nextOffset: 3 });
    expect(String(request.mock.calls[0]?.[0])).toContain("/players/profiles?page=3");
    expect(writes.map((row) => [row.kind, row.ref])).toEqual([
      ["player_profile", "7"],
      ["player_profile", "8"],
    ]);
    expect(db.rpc).toHaveBeenCalledWith("enrich_existing_football_profiles", {
      p_profiles: [
        { source_id: "7", birth_date: null, photo_url: null, nationality: null },
        { source_id: "8", birth_date: null, photo_url: null, nationality: null },
      ],
    });
  });

  it.each(Object.entries(FIXTURE_ENDPOINTS))(
    "imports %s once per stable fixture",
    async (phase, endpoint) => {
      const { writes } = rawStore("official_events", [{ source_id: "af:1024" }]);
      const request = vi.fn(async (_input: RequestInfo | URL) =>
        payload([{ events: "whole ordered response" }]),
      );
      vi.stubGlobal("fetch", request);
      const result = await runApiFootballImport({
        phase: phase as keyof typeof FIXTURE_ENDPOINTS,
        offset: 0,
        limit: 2,
        budgetMs: 50000,
      });
      expect(result).toMatchObject({ ok: true, processed: 1, created: 1, nextOffset: null });
      expect(String(request.mock.calls[0]?.[0])).toContain(`${endpoint}?fixture=1024`);
      expect(writes[0]?.ref).toBe("1024");
      expect(writes[0]?.payload).toEqual([{ events: "whole ordered response" }]);
    },
  );

  it.each(Object.entries(LEADER_ENDPOINTS))(
    "imports %s by player, competition and season",
    async (phase, endpoint) => {
      const { writes } = rawStore();
      const request = vi.fn(async (_input: RequestInfo | URL) =>
        payload([{ player: { id: 42 } }, { player: { id: 42 } }]),
      );
      vi.stubGlobal("fetch", request);
      const result = await runApiFootballImport({
        phase: phase as keyof typeof LEADER_ENDPOINTS,
        offset: 0,
        limit: 2,
        budgetMs: 50000,
      });
      expect(result).toMatchObject({ ok: true, processed: 1, created: 1, nextOffset: null });
      expect(String(request.mock.calls[0]?.[0])).toContain(`${endpoint}?league=39&season=2026`);
      expect(writes[0]).toMatchObject({ kind: phase, ref: "42:39:2026" });
    },
  );

  it.each(["playerseasons", "trophies", "sidelined"] as const)(
    "keeps %s in a player namespace, excludes staff and retains aliased provider IDs",
    async (phase) => {
      const { writes, filters } = rawStore("players", [{ source_id: "42" }]);
      const request = vi.fn(async () => payload([{ season: 2026 }, { season: 2025 }]));
      vi.stubGlobal("fetch", request);
      const result = await runApiFootballImport({ phase, offset: 0, limit: 2, budgetMs: 50000 });
      expect(result).toMatchObject({ ok: true, processed: 1, created: 1, nextOffset: null });
      expect(filters).toContainEqual(["source_kind", "player"]);
      expect(filters).not.toContainEqual(["canonical_player_id", null]);
      expect(writes[0]?.ref).toBe("player:42");
      expect(writes[0]?.payload).toEqual([{ season: 2026 }, { season: 2025 }]);
    },
  );

  it("preserves team-based transfer identities consumed by the club page", async () => {
    const { writes } = rawStore();
    const request = vi.fn(async (_input: RequestInfo | URL) =>
      payload([{ player: { id: 42 }, transfers: [] }]),
    );
    vi.stubGlobal("fetch", request);
    expect(
      await runApiFootballImport({ phase: "transfers", offset: 0, limit: 2, budgetMs: 50000 }),
    ).toMatchObject({ ok: true, nextOffset: null });
    expect(String(request.mock.calls[0]?.[0])).toContain("/transfers?team=33");
    expect(writes[0]).toMatchObject({ kind: "transfer", ref: "33" });
  });

  it("preserves the checkpoint after a failed write so retries cannot lose a player", async () => {
    rawStore("players", [{ source_id: "42" }]);
    db.from.mockImplementation((table: string) =>
      table === "api_football_data"
        ? { upsert: async () => ({ error: { message: "write failed" } }) }
        : {
            select() {
              return this;
            },
            eq() {
              return this;
            },
            is() {
              return this;
            },
            not() {
              return this;
            },
            order() {
              return this;
            },
            range: async () => ({ data: [{ source_id: "42" }], error: null }),
          },
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => payload([{ season: 2026 }])),
    );
    expect(
      await runApiFootballImport({ phase: "playerseasons", offset: 10, limit: 1, budgetMs: 50000 }),
    ).toMatchObject({ ok: false, processed: 0, nextOffset: 10 });
  });

  it("blocks provider access when the shared quota denies a reservation", async () => {
    db.rpc.mockResolvedValue({ data: false, error: null });
    const request = vi.fn();
    vi.stubGlobal("fetch", request);
    expect(
      await runApiFootballImport({ phase: "playerprofiles", offset: 0, limit: 1, budgetMs: 50000 }),
    ).toMatchObject({ ok: false, nextOffset: 0 });
    expect(request).not.toHaveBeenCalled();
  });

  it.each([NaN, Infinity, 0, -1, 1.5])(
    "rejects invalid batch size %s before spending quota",
    async (limit) => {
      expect(
        await runApiFootballImport({ phase: "playerprofiles", offset: 0, limit, budgetMs: 50000 }),
      ).toMatchObject({ ok: false, nextOffset: 0 });
      expect(db.rpc).not.toHaveBeenCalled();
    },
  );
});
