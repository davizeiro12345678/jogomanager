import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validate = (value: unknown) => value;
    const builder = {
      validator: (next: typeof validate) => {
        validate = next;
        return builder;
      },
      handler: (handle: (args: { data: unknown }) => unknown) => (args: { data: unknown }) =>
        handle({ data: validate(args.data) }),
    };
    return builder;
  },
}));
const request = vi.fn<typeof fetch>();
beforeEach(() => {
  vi.resetModules();
  request.mockReset();
  vi.stubGlobal("fetch", request);
  vi.stubEnv("SUPABASE_URL", "https://fixture.supabase.co");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_fixture");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("public club data integration", () => {
  it("connects provider athletes and canonical results without leaking private provider payloads", async () => {
    request.mockImplementation(async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/clubs"))
        return Response.json({
          id: "fla",
          name: "Flamengo",
          crest_url: "https://images.example/127.png",
          city: "Rio",
          country: "Brasil",
          founded: 1895,
          stadiums: null,
        });
      if (url.pathname.endsWith("/club_catalog_links"))
        return Response.json([{ source_club_id: "af127" }]);
      if (url.pathname.endsWith("/players")) {
        expect(url.searchParams.get("club_id")).toBe("in.(fla,af127)");
        expect(url.searchParams.get("source_kind")).toBe("eq.player");
        expect(url.searchParams.get("canonical_player_id")).toBe("is.null");
        return Response.json([
          {
            id: "player1",
            name: "Atleta",
            position: "FW",
            photo_url: "https://images.example/player.png",
            nationality: "Brazil",
          },
        ]);
      }
      if (url.pathname.endsWith("/official_teams"))
        return Response.json([{ source_id: "af:127", venue_source_id: "af:204" }]);
      if (url.pathname.endsWith("/official_venues")) {
        expect(url.searchParams.get("source_id")).toBe("in.(af:204)");
        return Response.json({
          name: "Maracanã",
          capacity: 78838,
          photo_url: "https://images.example/venue.png",
        });
      }
      if (url.pathname.endsWith("/official_events_catalog"))
        return Response.json([
          {
            source_id: "af:1",
            starts_at: "2026-09-01T12:00:00Z",
            home_team_name: "Flamengo",
            away_team_name: "Clube",
            home_score: 1,
            away_score: 0,
            status: "FT",
          },
        ]);
      throw new Error(`Unexpected projection ${url.pathname}`);
    });
    const { getClubDatabaseProfile } = await import("./club-database.functions");
    const data = await getClubDatabaseProfile({ data: { clubId: "fla" } });
    expect(data).toMatchObject({
      id: "fla",
      founded: 1895,
      players: [{ id: "player1", name: "Atleta" }],
      stadium: { name: "Maracanã", capacity: 78838, photo: "https://images.example/venue.png" },
    });
    expect(data?.matches).toHaveLength(1);
    expect(data).not.toHaveProperty("payload");
    expect(data?.players[0]).not.toHaveProperty("source_kind");
  });
});
