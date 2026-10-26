import { describe, expect, it, vi } from "vitest";

import { handleSportsDbSourceRequest } from "./sportsdb-source.server";

function authorizedFetch() {
  return vi.fn().mockResolvedValue(Response.json(true));
}

function statement(allResult: unknown[] = [], firstResult: unknown = null) {
  const value = {
    bind: vi.fn(() => value),
    all: vi.fn(async () => ({ results: allResult })),
    first: vi.fn(async () => firstResult),
  };
  return value;
}

function environment(prepare: (query: string) => ReturnType<typeof statement>) {
  return {
    SUPABASE_URL: "https://project.supabase.co",
    SPORTS_DB: { prepare },
    SPORTSDB_RAW: { get: vi.fn(async () => null) },
  };
}

describe("SportsDB Cloudflare source endpoint", () => {
  it("rejects a request before touching the D1 source when the scheduler token is invalid", async () => {
    const prepare = vi.fn(() => statement());
    const response = await handleSportsDbSourceRequest(
      new Request("https://jogomanager-web.workers.dev/api/public/sportsdb?status=1"),
      environment(prepare),
    );

    expect(response.status).toBe(401);
    expect(prepare).not.toHaveBeenCalled();
  });

  it("publishes D1 and archive status after Supabase authorizes the scheduler token", async () => {
    const fetcher = authorizedFetch();
    vi.stubGlobal("fetch", fetcher);
    const prepare = vi.fn((query: string) => {
      if (query.includes("GROUP BY entity_type"))
        return statement([{ entity_type: "team", records: "2", updated_at: "2026-10-06" }]);
      if (query.includes("FROM sportsdb_archives"))
        return statement([], { objects: "4", bytes: "128" });
      if (query.includes("sportsdb_archive_usage")) return statement([], { max_bytes: "1024" });
      if (query.includes("sportsdb_import_state"))
        return statement([
          { phase: "teams", complete: 1, last_error: null, updated_at: "2026-10-06" },
        ]);
      throw new Error(`Unexpected query: ${query}`);
    });

    const response = await handleSportsDbSourceRequest(
      new Request("https://jogomanager-web.workers.dev/api/public/sportsdb?status=1", {
        headers: { authorization: "Bearer scheduler-token" },
      }),
      environment(prepare),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      source: "TheSportsDB",
      counts: [{ entity_type: "team", records: 2 }],
      archive: { objects: 4, bytes: 128, storage: "Cloudflare R2", budgetBytes: 1024 },
    });
    expect(fetcher).toHaveBeenCalledWith(
      "https://project.supabase.co/functions/v1/sportsdb-bridge/authorize",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ authorization: "Bearer scheduler-token" }),
      }),
    );
  });

  it("paginates a canonical D1 entity and decodes its stored payload", async () => {
    const fetcher = authorizedFetch();
    vi.stubGlobal("fetch", fetcher);
    const prepare = vi.fn((query: string) => {
      if (query.includes("COUNT(*) AS total")) return statement([], { total: "1" });
      if (query.includes("payload_json"))
        return statement([
          {
            source_id: "123",
            parent_id: "9",
            season: "2025",
            updated_at: "2026-10-06",
            payload_json: '{"name":"Example FC","country":"BR"}',
          },
        ]);
      throw new Error(`Unexpected query: ${query}`);
    });

    const response = await handleSportsDbSourceRequest(
      new Request(
        "https://jogomanager-web.workers.dev/api/public/sportsdb?entity=team&limit=1&offset=0",
        { headers: { authorization: "Bearer scheduler-token" } },
      ),
      environment(prepare),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      entityType: "team",
      total: 1,
      rows: [
        {
          sourceId: "123",
          parentId: "9",
          season: "2025",
          updatedAt: "2026-10-06",
          data: { name: "Example FC", country: "BR" },
        },
      ],
    });
  });
});
