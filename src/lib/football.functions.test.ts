import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validate = (value: unknown): unknown => value;
    const builder = {
      validator(next: (value: unknown) => unknown) {
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

function ok(data: unknown): Response {
  return Response.json(data);
}

const request = vi.fn<typeof fetch>();
let functions: typeof import("./football.functions");

beforeEach(async () => {
  vi.resetModules();
  request.mockReset().mockImplementation(async () => ok([]));
  vi.stubGlobal("fetch", request);
  vi.stubEnv("SUPABASE_URL", "https://football-fixture.supabase.co");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_public-fixture");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "sb_secret_server-fixture");
  vi.stubEnv("LOGO_DEV_API_KEY", "");
  functions = await import("./football.functions");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("public football queries", () => {
  it("walks every club and kit page when the API cap is below the requested limit", async () => {
    const clubs = Array.from({ length: 7 }, (_, i) => ({
      id: `club-${i}`,
      crest_url: `https://images.example/crest-${i}.png`,
      website: null,
    }));
    const kits = Array.from({ length: 5 }, (_, i) => ({
      id: `kit-${i}`,
      club_id: `club-${i}`,
      image_url: `https://images.example/kit-${i}.png`,
    }));
    request.mockImplementation(async (input) => {
      const url = requestUrl(input);
      const cursor = url.searchParams.get("id")?.replace(/^gt\./, "") ?? "";
      const rows = url.pathname.endsWith("/clubs") ? clubs : kits;
      expect(url.searchParams.get("order")).toBe("id.asc");
      return ok(rows.filter((row) => row.id > cursor).slice(0, 2));
    });

    const result = await functions.getOfficialAssets();
    expect(Object.keys(result.crests)).toHaveLength(7);
    expect(Object.keys(result.kits)).toHaveLength(5);
    expect(result.crests["club-6"]).toBe("https://images.example/crest-6.png");
    expect(result.kits["club-4"]).toBe("https://images.example/kit-4.png");
    const coldRequests = request.mock.calls.length;
    expect(coldRequests).toBe(9);
    expect(await functions.getOfficialAssets()).toEqual(result);
    expect(request).toHaveBeenCalledTimes(coldRequests);
  });

  it("starts the independent club and kit reads together and coalesces concurrent callers", async () => {
    const tables = new Set<string>();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    request.mockImplementation(async (input) => {
      tables.add(requestUrl(input).pathname.split("/").at(-1)!);
      await gate;
      return ok([]);
    });
    const callers = Array.from({ length: 20 }, () => functions.getOfficialAssets());
    await vi.waitFor(() => expect(tables).toEqual(new Set(["clubs", "kits"])));
    expect(request).toHaveBeenCalledTimes(2);
    release();
    expect(await Promise.all(callers)).toEqual(Array(20).fill({ crests: {}, kits: {} }));
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("does not cache a partial asset catalog when a later page fails", async () => {
    let failPage = true;
    request.mockImplementation(async (input) => {
      const url = requestUrl(input);
      if (url.pathname.endsWith("/kits")) return ok([]);
      if (!url.searchParams.has("id"))
        return ok([{ id: "first", crest_url: "https://images.example/first.png", website: null }]);
      if (failPage) return Response.json({ message: "private database detail" }, { status: 400 });
      return ok([]);
    });
    await expect(functions.getOfficialAssets()).rejects.toThrow("dados completos");
    failPage = false;
    const result = await functions.getOfficialAssets();
    expect(result.crests).toEqual({ first: "https://images.example/first.png" });
    expect(
      request.mock.calls.filter(([input]) => requestUrl(input).pathname.endsWith("/clubs")),
    ).toHaveLength(4);
  });

  it("preserves a complete squad across small API pages and caches its success", async () => {
    const rows = [
      { id: "a", name: "A" },
      { id: "b", name: "B" },
      { id: "c", name: "C" },
    ];
    request.mockImplementation(async (input) => {
      const url = requestUrl(input);
      expect(url.searchParams.get("club_id")).toBe("eq.club");
      const cursor = url.searchParams.get("id")?.replace(/^gt\./, "") ?? "";
      return ok(rows.filter((row) => row.id > cursor).slice(0, 1));
    });
    expect(await functions.getRealSquad({ data: { clubId: " club " } })).toEqual(rows);
    expect(await functions.getRealSquad({ data: { clubId: "club" } })).toEqual(rows);
    expect(request).toHaveBeenCalledTimes(4);
  });

  it("rejects a stalled cursor instead of looping or retaining incomplete players", async () => {
    request.mockImplementation(async () => ok([{ id: "stalled" }]));
    await expect(functions.getRealSquad({ data: { clubId: "club" } })).rejects.toThrow("paginação");
    expect(request).toHaveBeenCalledTimes(2);
    request.mockImplementation(async () => ok([]));
    expect(await functions.getRealSquad({ data: { clubId: "club" } })).toEqual([]);
    expect(request).toHaveBeenCalledTimes(3);
  });

  it.each([
    { page: -1 },
    { page: 1.5 },
    { page: Infinity },
    { page: 10_001 },
    { q: "x".repeat(81) },
    { pos: "invalid" },
    { minAge: 30, maxAge: 18 },
    { minOvr: 100, maxOvr: 30 },
    { clubId: " " },
  ])("rejects malformed market input before making a database request: %j", async (data) => {
    const search = functions.searchRealPlayers as unknown as (args: {
      data: unknown;
    }) => Promise<unknown>;
    await expect(search({ data })).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  });

  it("uses literal text for name searches, preserves zero filters and caches identical searches", async () => {
    request.mockImplementation(async (input) => {
      const url = requestUrl(input);
      expect(url.searchParams.get("name")).toBe("ilike.%50\\%\\_%");
      expect(url.searchParams.getAll("age")).toEqual(["gte.0", "lte.120"]);
      expect(url.searchParams.getAll("overall")).toEqual(["gte.0", "lte.100"]);
      expect(url.searchParams.get("order")).toBe("overall.desc,id.asc");
      expect(url.searchParams.get("source_kind")).toBe("eq.player");
      expect(url.searchParams.get("canonical_player_id")).toBe("is.null");
      return ok([]);
    });
    const data = { q: " 50%_ ", minAge: 0, maxAge: 120, minOvr: 0, maxOvr: 100 };
    expect(await functions.searchRealPlayers({ data })).toEqual({
      rows: [],
      page: 0,
      hasMore: false,
    });
    expect(await functions.searchRealPlayers({ data: { ...data, q: "50%_" } })).toEqual({
      rows: [],
      page: 0,
      hasMore: false,
    });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it.each([{}, { pos: "FW" }, { q: "Ronald" }])(
    "keeps the exact public row boundary in every server-side market search: %j",
    async (data) => {
      const records = [
        { id: "public", source_kind: "player", canonical_player_id: null, name: "Ronald" },
        { id: "private-kind", source_kind: "staff", canonical_player_id: null, name: "Ronald" },
        { id: "duplicate", source_kind: "player", canonical_player_id: "public", name: "Ronald" },
      ];
      request.mockImplementation(async (input) => {
        const url = requestUrl(input);
        expect(url.searchParams.get("source_kind")).toBe("eq.player");
        expect(url.searchParams.get("canonical_player_id")).toBe("is.null");
        expect(url.searchParams.get("select")).toBe(
          "id,source,source_id,birth_date,name,position,age,shirt_number,nationality,overall,photo_url,club_id",
        );
        const visible = records.filter(
          (row) => row.source_kind === "player" && row.canonical_player_id === null,
        );
        const offset = Number(url.searchParams.get("offset") ?? 0);
        return ok(visible.slice(offset).map((row) => ({ id: row.id, name: row.name })));
      });
      const result = await functions.searchRealPlayers({ data });
      expect(result.rows.map((row) => row.id)).toEqual(["public"]);
      expect(result.rows[0]).not.toHaveProperty("source_kind");
      expect(result.rows[0]).not.toHaveProperty("canonical_player_id");
    },
  );

  it("fills the page and its lookahead even when the Data API returns fewer than 25 rows", async () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({ id: `player-${i}`, name: `Player ${i}` }));
    request.mockImplementation(async (input) => {
      const url = requestUrl(input);
      const offset = Number(url.searchParams.get("offset") ?? 0);
      const limit = Math.min(10, Number(url.searchParams.get("limit") ?? 25));
      return ok(rows.slice(offset, offset + limit));
    });
    const first = await functions.searchRealPlayers({ data: {} });
    expect(first.rows).toHaveLength(24);
    expect(first.hasMore).toBe(true);
    expect(request).toHaveBeenCalledTimes(3);
    const last = await functions.searchRealPlayers({ data: { page: 1 } });
    expect(last.rows).toHaveLength(6);
    expect(last.hasMore).toBe(false);
    expect(request).toHaveBeenCalledTimes(5);
  });

  it("retries a failed market read and never converts its error into an empty cached page", async () => {
    request.mockResolvedValueOnce(
      Response.json({ message: "database query failed" }, { status: 400 }),
    );
    await expect(functions.searchRealPlayers({ data: {} })).rejects.toThrow("mercado");
    expect(await functions.searchRealPlayers({ data: {} })).toEqual({
      rows: [],
      page: 0,
      hasMore: false,
    });
    expect(request).toHaveBeenCalledTimes(2);
  });
});
