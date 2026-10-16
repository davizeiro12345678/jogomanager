import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runApiFootballImport } from "./apifootball-import.server";

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
      vi.fn(async () => payload([{ team: { id: 33 }, players: [player, player] }])),
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
});
