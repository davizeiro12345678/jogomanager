// Merges clubs and competitions stored in the backend that the bundled catalogue
// does not ship, so every imported club can be chosen. Bundled entries win.
import { supabase } from "@/integrations/supabase/client";
import { CLUBS, LEAGUES } from "@/game/data/leagues";
import type { Club, League } from "@/game/types";

// v1 could silently truncate competitions and clubs at the Data API row cap.
const CACHE_KEY = "db-catalog-v2";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PAGE = 1000;
export const CATALOG_EVENT = "db-catalog-updated";

type LeagueRow = [id: string, name: string, country: string, flag: string];
type ClubRow = [
  id: string,
  league: string,
  name: string,
  short: string,
  p: string,
  s: string,
  str: number,
];
type Cache = { at: number; leagues: LeagueRow[]; clubs: ClubRow[] };

const HEX = /^#[0-9a-f]{6}$/i;
// `apply` adds imported records to these globals. Capture the bundled IDs once
// so a refresh never mistakes previously cached imports for bundled content
// and drops them from the catalog persisted for the next offline visit.
const bundledClubIds = new Set(Object.keys(CLUBS));
const bundledLeagueIds = new Set(LEAGUES.map((league) => league.id));
let merged = false;
let refreshedAt = 0;
let refreshing: Promise<void> | null = null;

function apply(cache: Cache) {
  const byId = new Map(LEAGUES.map((l) => [l.id, l]));
  const added = new Set<string>();
  for (const [id, name, country, flag] of cache.leagues) {
    if (!byId.has(id)) {
      const league: League = {
        id,
        name,
        country,
        flag: flag || "🏳️",
        clubs: [],
        catalogStatus: "sourced",
      };
      LEAGUES.push(league);
      added.add(id);
      byId.set(id, league);
    }
  }
  for (const [id, leagueId, name, short, p, s, str] of cache.clubs) {
    if (CLUBS[id]) continue;
    const league = byId.get(leagueId);
    if (!league) continue;
    const club: Club = {
      id,
      name,
      short: short || name.slice(0, 3).toUpperCase(),
      league: leagueId,
      primary: HEX.test(p) ? p : "#1f4fa0",
      secondary: HEX.test(s) ? s : "#ffffff",
      strength: Math.max(40, Math.min(90, Math.round(str || 55))),
    };
    CLUBS[id] = club;
    league.clubs.push(club);
  }
  // Leagues without any playable club would render empty lists.
  for (let i = LEAGUES.length - 1; i >= 0; i--)
    if (added.has(LEAGUES[i]!.id) && LEAGUES[i]!.clubs.length < 2) LEAGUES.splice(i, 1);
  merged = true;
  refreshedAt = cache.at;
}

function readCache(): Cache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw) as Cache;
    return Number.isFinite(cache.at) &&
      Array.isArray(cache.leagues) &&
      cache.leagues.every(
        (row) =>
          Array.isArray(row) && row.length === 4 && row.every((value) => typeof value === "string"),
      ) &&
      Array.isArray(cache.clubs) &&
      cache.clubs.every(
        (row) =>
          Array.isArray(row) &&
          row.length === 7 &&
          row.slice(0, 6).every((value) => typeof value === "string") &&
          Number.isFinite(row[6]),
      )
      ? cache
      : null;
  } catch {
    return null;
  }
}

type ClubSelect = {
  id: string;
  competition_id: string | null;
  name: string;
  short_name: string;
  primary_color: string;
  secondary_color: string;
  strength: number;
};

async function fetchAll(): Promise<Cache> {
  // Only an empty page proves exhaustion: an operator may configure a row cap
  // below PAGE. Independent competition/club keysets walk their primary keys.
  async function pages<T extends { id: string }>(
    read: (after: string | undefined) => PromiseLike<{ data: T[] | null; error: unknown }>,
  ): Promise<T[]> {
    const rows: T[] = [];
    const cursors = new Set<string>();
    let after: string | undefined;
    for (let page = 0; page < 2_048; page++) {
      const result = await read(after);
      if (result.error || !result.data) throw new Error("Catálogo indisponível.");
      if (result.data.length === 0) return rows;
      const next = result.data.at(-1)!.id;
      if (!next || cursors.has(next) || rows.length + result.data.length > 100_000)
        throw new Error("Catálogo excedeu o limite seguro de paginação.");
      rows.push(...result.data);
      cursors.add(next);
      after = next;
    }
    throw new Error("Catálogo excedeu o limite seguro de paginação.");
  }
  const [comps, fetchedClubs] = await Promise.all([
    pages((after) => {
      const query = supabase
        .from("competitions")
        .select("id,name,country,flag")
        .order("id")
        .limit(PAGE);
      return after ? query.gt("id", after) : query;
    }),
    pages<ClubSelect>((after) => {
      const query = supabase
        .from("clubs")
        .select("id,competition_id,name,short_name,primary_color,secondary_color,strength")
        .not("competition_id", "is", null)
        .order("id")
        .limit(PAGE);
      return after ? query.gt("id", after) : query;
    }),
  ]);
  const clubs: ClubRow[] = [];
  for (const c of fetchedClubs) {
    if (!c.competition_id || bundledClubIds.has(c.id)) continue;
    clubs.push([
      c.id,
      c.competition_id,
      c.name,
      c.short_name,
      c.primary_color,
      c.secondary_color,
      c.strength,
    ]);
  }
  const leagues: LeagueRow[] = (comps ?? [])
    .filter((c) => !bundledLeagueIds.has(c.id))
    .map((c) => [c.id, c.name, c.country, c.flag ?? ""]);
  return { at: Date.now(), leagues, clubs };
}

/** Applies the cached catalogue at once and refreshes it in the background. */
export function loadDbCatalog(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  const cache = readCache();
  if (cache && !merged) apply(cache);
  if (merged && Date.now() - refreshedAt < CACHE_TTL_MS) return Promise.resolve();
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return Promise.resolve();
  refreshing ??= fetchAll()
    .then((fresh) => {
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(fresh));
      } catch {
        // Storage full: the catalogue still works for this visit.
      }
      apply(fresh);
      window.dispatchEvent(new Event(CATALOG_EVENT));
    })
    .catch((error) => console.warn("Catálogo extra indisponível", error))
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}
