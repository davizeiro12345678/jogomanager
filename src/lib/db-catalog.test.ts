import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Club, League } from "@/game/types";

const catalog = vi.hoisted(() => ({
  CLUBS: {} as Record<string, Club>,
  LEAGUES: [] as League[],
}));
vi.mock("@/game/data/leagues", () => catalog);
vi.mock("@/integrations/supabase/client", async () => {
  const { createClient } = await import("@supabase/supabase-js");
  return {
    supabase: createClient("https://football-fixture.supabase.co", "sb_publishable_fixture", {
      global: { fetch: (input, init) => globalThis.fetch(input, init) },
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  };
});

const competitions = [
  { id: "league-1", name: "League 1", country: "Brazil", flag: "BR" },
  { id: "league-2", name: "League 2", country: "Brazil", flag: "BR" },
];
const clubs = Array.from({ length: 4 }, (_, i) => ({
  id: `club-${i}`,
  competition_id: i < 2 ? "league-1" : "league-2",
  name: `Club ${i}`,
  short_name: `C${i}`,
  primary_color: "#123456",
  secondary_color: "#ffffff",
  strength: 60,
}));

const request = vi.fn<typeof fetch>();
let stored: Map<string, string>;
let loadDbCatalog: typeof import("./db-catalog").loadDbCatalog;

function page(input: RequestInfo | URL): Response {
  const url = new URL(input instanceof Request ? input.url : String(input));
  const cursor = url.searchParams.get("id")?.replace(/^gt\./, "") ?? "";
  const rows = url.pathname.endsWith("/clubs") ? clubs : competitions;
  return Response.json(rows.filter((row) => row.id > cursor).slice(0, 1));
}

beforeEach(async () => {
  vi.resetModules();
  catalog.LEAGUES.length = 0;
  for (const key of Object.keys(catalog.CLUBS)) delete catalog.CLUBS[key];
  stored = new Map();
  request.mockReset().mockImplementation(async (input) => page(input));
  vi.stubGlobal("fetch", request);
  vi.stubGlobal("window", { dispatchEvent: vi.fn() });
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => stored.set(key, value),
  });
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  ({ loadDbCatalog } = await import("./db-catalog"));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("complete public club catalog", () => {
  it("enriches a bundled club without replacing its identity, strength or league membership", async () => {
    const existing: Club = {
      id: "club-0",
      league: "league-1",
      name: "Saved club",
      short: "SAV",
      primary: "#111111",
      secondary: "#eeeeee",
      strength: 77,
    };
    catalog.CLUBS[existing.id] = existing;
    const league: League = {
      id: "league-1",
      name: "Saved league",
      country: "Brazil",
      flag: "BR",
      clubs: [existing],
    };
    catalog.LEAGUES.push(league);
    request.mockImplementation(async (input) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      if (url.searchParams.has("id")) return Response.json([]);
      return Response.json(
        url.pathname.endsWith("/clubs")
          ? [
              {
                ...clubs[0],
                crest_url: "https://media.example/crest.png",
                city: "Rio",
                country: "Brazil",
                founded: 1895,
              },
            ]
          : [{ ...competitions[0], logo_url: "https://media.example/league.png" }],
      );
    });
    await loadDbCatalog();
    expect(catalog.CLUBS[existing.id]).toBe(existing);
    expect(existing).toMatchObject({
      name: "Saved club",
      strength: 77,
      crestUrl: "https://media.example/crest.png",
      city: "Rio",
      country: "Brazil",
      founded: 1895,
    });
    expect(league).toMatchObject({
      name: "Saved league",
      logoUrl: "https://media.example/league.png",
      clubs: [existing],
    });
    const cache = JSON.parse(stored.get("db-catalog-v3")!);
    expect(cache.clubs[0]).toHaveLength(11);
  });

  it("loads every competition and club despite a lower API cap, sharing concurrent refreshes", async () => {
    await Promise.all(Array.from({ length: 20 }, () => loadDbCatalog()));
    expect(catalog.LEAGUES.map((league) => league.id)).toEqual(["league-1", "league-2"]);
    expect(Object.keys(catalog.CLUBS)).toHaveLength(4);
    expect(catalog.LEAGUES.every((league) => league.clubs.length === 2)).toBe(true);
    expect(request).toHaveBeenCalledTimes(8);
    expect(JSON.parse(stored.get("db-catalog-v3")!).clubs).toHaveLength(4);
    await loadDbCatalog();
    expect(request).toHaveBeenCalledTimes(8);
  });

  it("does not apply or persist a partial catalog after a database error", async () => {
    request.mockImplementation(async () =>
      Response.json({ message: "query unavailable" }, { status: 400 }),
    );
    await loadDbCatalog();
    expect(catalog.LEAGUES).toEqual([]);
    expect(Object.keys(catalog.CLUBS)).toHaveLength(0);
    expect(stored.has("db-catalog-v3")).toBe(false);
    request.mockImplementation(async (input) => page(input));
    await loadDbCatalog();
    expect(Object.keys(catalog.CLUBS)).toHaveLength(4);
  });

  it("keeps the complete session cache when browser storage cannot be written", async () => {
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota exceeded");
      },
    });
    await loadDbCatalog();
    await loadDbCatalog();
    expect(Object.keys(catalog.CLUBS)).toHaveLength(4);
    expect(request).toHaveBeenCalledTimes(8);
  });

  it("retains imported clubs when a stale catalog refreshes and the next visit is offline", async () => {
    stored.set(
      "db-catalog-v3",
      JSON.stringify({
        at: Date.now() - 8 * 24 * 60 * 60 * 1_000,
        leagues: competitions.map((league) => [
          league.id,
          league.name,
          league.country,
          league.flag,
        ]),
        clubs: clubs.map((club) => [
          club.id,
          club.competition_id,
          club.name,
          club.short_name,
          club.primary_color,
          club.secondary_color,
          club.strength,
        ]),
      }),
    );
    await loadDbCatalog();
    const fresh = JSON.parse(stored.get("db-catalog-v3")!);
    expect(fresh.leagues).toHaveLength(2);
    expect(fresh.clubs).toHaveLength(4);
    expect(request).toHaveBeenCalledTimes(8);

    // A new visit starts from the bundled catalog; only storage survives.
    vi.resetModules();
    catalog.LEAGUES.length = 0;
    for (const key of Object.keys(catalog.CLUBS)) delete catalog.CLUBS[key];
    request.mockRejectedValue(new Error("offline"));
    ({ loadDbCatalog } = await import("./db-catalog"));
    await loadDbCatalog();
    expect(catalog.LEAGUES).toHaveLength(2);
    expect(Object.keys(catalog.CLUBS)).toHaveLength(4);
    expect(request).toHaveBeenCalledTimes(8);
  });

  it("discards malformed cached rows and rebuilds them without crashing club selection", async () => {
    stored.set("db-catalog-v3", JSON.stringify({ at: Date.now(), leagues: [null], clubs: [] }));
    await loadDbCatalog();
    expect(catalog.LEAGUES).toHaveLength(2);
    expect(Object.keys(catalog.CLUBS)).toHaveLength(4);
  });
});
