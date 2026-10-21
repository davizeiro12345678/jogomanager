import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validate = (value: unknown): unknown => value;
    const builder = {
      inputValidator(next: (value: unknown) => unknown) {
        validate = next;
        return builder;
      },
      handler(handle: (args: { data: unknown }) => unknown) {
        return async (args: { data?: unknown } = {}) => handle({ data: validate(args.data) });
      },
    };
    return builder;
  },
}));

function requestUrl(input: RequestInfo | URL): URL {
  return new URL(input instanceof Request ? input.url : String(input));
}

function leaguePayload(id = 71, season = 2027) {
  const standings = Array.from({ length: 6 }, (_, i) => ({
    rank: i + 1,
    team: { id: i + 1, name: `Club ${i + 1}`, logo: `https://images.example/${i + 1}.png` },
    points: 20 - i,
    goalsDiff: 5 - i,
    form: "WDWD",
    description: null,
    all: { played: 4, win: 1, draw: 2, lose: 1, goals: { for: 4, against: i + 1 } },
    home: { played: 2, win: 1, draw: 1, lose: 0, goals: { for: 2, against: 1 } },
    away: { played: 2, win: 0, draw: 1, lose: 1, goals: { for: 2, against: 1 } },
  }));
  return [
    {
      league: {
        id,
        name: `League ${id}`,
        country: "Brazil",
        season,
        logo: "https://images.example/league.png",
        standings: [standings],
      },
      provider_internal: "never return raw provider fields",
    },
  ];
}

const request = vi.fn<typeof fetch>();
const leagueIds = [71, 72, 39, 140, 135, 78, 61, 94, 88, 128, 253, 262];
const emptyDigest = () =>
  leagueIds.map((league_id) => ({ league_id, payload: null, injury_count: 0 }));
let functions: typeof import("./real-football.functions");

beforeEach(async () => {
  vi.resetModules();
  request.mockReset().mockImplementation(async () => Response.json([]));
  vi.stubGlobal("fetch", request);
  vi.stubEnv("SUPABASE_URL", "https://football-fixture.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "sb_secret_server-fixture");
  functions = await import("./real-football.functions");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("public league projections", () => {
  it("serves 20 concurrent digest reads through one bounded RPC and caches the projection", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    request.mockImplementation(async (input, init) => {
      expect(requestUrl(input).pathname).toBe("/rest/v1/rpc/get_public_league_digest_source");
      expect(JSON.parse(String(init?.body))).toEqual({
        p_league_ids: [71, 72, 39, 140, 135, 78, 61, 94, 88, 128, 253, 262],
      });
      await gate;
      return Response.json([
        { league_id: 39, payload: leaguePayload(39), injury_count: 10 },
        { league_id: 71, payload: leaguePayload(71), injury_count: 123 },
        ...emptyDigest().filter((row) => row.league_id !== 39 && row.league_id !== 71),
      ]);
    });
    const readers = Array.from({ length: 20 }, () => functions.getLeagueDigests());
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    release();
    const [result] = await Promise.all(readers);
    expect(result?.map((row) => row.slug)).toEqual(["brasileirao-serie-a", "premier-league"]);
    expect(result?.[0]).toMatchObject({
      season: 2027,
      teams: 6,
      injuries: 123,
      goalsPerGame: 1.5,
      homeWinPct: 50,
      awayWinPct: 0,
      drawPct: 50,
      leader: "Club 1",
      leaderGap: 1,
      bestDefense: { team: "Club 1", against: 1, played: 4 },
    });
    expect(JSON.stringify(result)).not.toContain("provider_internal");
    expect(JSON.stringify(result)).not.toContain("standings");
    expect(await functions.getLeagueDigests()).toEqual(result);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("does not cache a failed digest RPC as missing public data", async () => {
    request.mockImplementation(async () => Response.json(emptyDigest()));
    request.mockResolvedValueOnce(Response.json({ message: "private error" }, { status: 503 }));
    await expect(functions.getLeagueDigests()).rejects.toThrow("indicadores");
    expect(await functions.getLeagueDigests()).toEqual([]);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it.each(["truncated", "duplicate", "unexpected"])(
    "rejects and retries a %s digest RPC instead of caching an incomplete projection",
    async (failure) => {
      const rows = emptyDigest();
      if (failure === "truncated") rows.pop();
      else rows[0]!.league_id = failure === "duplicate" ? 72 : 999;
      request.mockResolvedValueOnce(Response.json(rows));
      request.mockImplementation(async () => Response.json(emptyDigest()));
      await expect(functions.getLeagueDigests()).rejects.toThrow("indicadores");
      expect(await functions.getLeagueDigests()).toEqual([]);
      expect(request).toHaveBeenCalledTimes(2);
    },
  );

  it("reads scoring leaders for the season of the selected standings", async () => {
    request.mockImplementation(async (input) => {
      const url = requestUrl(input);
      const kind = url.searchParams.get("kind");
      if (kind === "eq.standings")
        return Response.json([
          { ref: "71:2027", payload: leaguePayload(), updated_at: "2027-05-01T00:00:00Z" },
        ]);
      if (kind === "eq.top_stats") {
        expect(url.searchParams.get("ref")).toBe("in.(scorers_71_2027,assists_71_2027)");
        return Response.json([
          {
            ref: "scorers_71_2027",
            payload: [
              {
                player: { name: "Forward" },
                statistics: [
                  { team: { name: "Club 1" }, games: { appearences: 4 }, goals: { total: 5 } },
                ],
              },
            ],
          },
        ]);
      }
      return Response.json([]);
    });
    const result = await functions.getLeagueTable({ data: { slug: "brasileirao-serie-a" } });
    expect(result?.season).toBe(2027);
    expect(result?.scorers[0]?.goals).toBe(5);
    expect(request).toHaveBeenCalledTimes(3);
    expect(await functions.getLeagueTable({ data: { slug: "brasileirao-serie-a" } })).toEqual(
      result,
    );
    expect(request).toHaveBeenCalledTimes(3);
  });

  it("refuses to retain an incomplete league projection after an auxiliary query error", async () => {
    let unavailable = true;
    request.mockImplementation(async (input) => {
      const kind = requestUrl(input).searchParams.get("kind");
      if (kind === "eq.standings")
        return Response.json([
          { ref: "71:2027", payload: leaguePayload(), updated_at: "2027-05-01T00:00:00Z" },
        ]);
      if (kind === "eq.injury" && unavailable)
        return Response.json({ message: "private error" }, { status: 400 });
      return Response.json([]);
    });
    await expect(
      functions.getLeagueTable({ data: { slug: "brasileirao-serie-a" } }),
    ).rejects.toThrow("dados completos");
    unavailable = false;
    expect(
      (await functions.getLeagueTable({ data: { slug: "brasileirao-serie-a" } }))?.season,
    ).toBe(2027);
    expect(request).toHaveBeenCalledTimes(6);
  });

  it("does not query unknown leagues or malformed club names", async () => {
    expect(await functions.getLeagueTable({ data: { slug: "unknown" } })).toBeNull();
    await expect(functions.getClubReal({ data: { name: " " } })).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  });
});
