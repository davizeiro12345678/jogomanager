// Merges clubs and competitions stored in the backend that the bundled catalogue
// does not ship, so every imported club can be chosen. Bundled entries win.
import { CLUBS, LEAGUES } from "@/game/data/leagues";
import type { Club, League } from "@/game/types";
import { catalogCountryNames } from "./catalog-country";
import { validCatalogIdentity, validCatalogLabel } from "./catalog-integrity";
import { CATALOG_EVENT } from "./catalog-events";
import { catalogImageUrl } from "./catalog-media";

// v1 could silently truncate competitions and clubs at the Data API row cap.
export { CATALOG_EVENT } from "./catalog-events";

const CACHE_KEY = "db-catalog-v3";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const PAGE = 1000;

type LeagueRow = [id: string, name: string, country: string, flag: string, logo?: string];
type ClubRow = [
  id: string,
  league: string,
  name: string,
  short: string,
  p: string,
  s: string,
  str: number,
  crest?: string,
  city?: string,
  country?: string,
  founded?: number | null,
];
type Cache = { at: number; leagues: LeagueRow[]; clubs: ClubRow[] };

const HEX = /^#[0-9a-f]{6}$/i;
// Persist the complete public projection, including metadata for bundled IDs,
// so a refreshed catalogue remains complete on the next offline visit.
let merged = false;
let refreshedAt = 0;
let refreshing: Promise<void> | null = null;

function apply(cache: Cache) {
  const countryName = catalogCountryNames([
    ...LEAGUES,
    ...cache.leagues.map(([, , country, flag]) => ({ country, flag })),
  ]);
  const byId = new Map(LEAGUES.map((l) => [l.id, l]));
  const added = new Set<string>();
  for (const [id, name, country, flag, logo] of cache.leagues) {
    if (!validCatalogIdentity(id) || !validCatalogLabel(name)) continue;
    const existing = byId.get(id);
    if (existing) existing.logoUrl = catalogImageUrl(logo);
    if (!byId.has(id)) {
      const league: League = {
        id,
        name,
        country: countryName(country, flag),
        flag: flag || "🏳️",
        clubs: [],
        catalogStatus: "sourced",
        logoUrl: catalogImageUrl(logo),
      };
      LEAGUES.push(league);
      added.add(id);
      byId.set(id, league);
    }
  }
  for (const [id, leagueId, name, short, p, s, str, crest, city, country, founded] of cache.clubs) {
    if (!validCatalogIdentity(id) || !validCatalogIdentity(leagueId) || !validCatalogLabel(name))
      continue;
    // Enrich identity without changing bundled strengths, IDs or memberships.
    const metadata = {
      crestUrl: catalogImageUrl(crest),
      city: city || undefined,
      country: country || undefined,
      founded:
        typeof founded === "number" && founded >= 1800 && founded <= 2100 ? founded : undefined,
    };
    if (CLUBS[id]) Object.assign(CLUBS[id]!, metadata);
    const league = byId.get(leagueId);
    if (!league) continue;
    if (CLUBS[id]) {
      const existing = CLUBS[id]!;
      if (existing.league === leagueId && !league.clubs.some((club) => club.id === id))
        league.clubs.push(existing);
      continue;
    }
    const club: Club = {
      id,
      name: name.trim(),
      short: short.trim() || name.trim().slice(0, 3).toUpperCase(),
      league: leagueId,
      primary: HEX.test(p) ? p : "#1f4fa0",
      secondary: HEX.test(s) ? s : "#ffffff",
      strength: Math.max(40, Math.min(90, Math.round(str || 55))),
      ...metadata,
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
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const candidate = value as Cache;
    if (
      !Number.isFinite(candidate.at) ||
      candidate.at < 0 ||
      candidate.at > Date.now() + 300000 ||
      !Array.isArray(candidate.leagues) ||
      candidate.leagues.length > 50000 ||
      !Array.isArray(candidate.clubs) ||
      candidate.clubs.length > 300000
    )
      return null;
    if (
      candidate.leagues.some(
        (row) =>
          !Array.isArray(row) ||
          (row.length !== 4 && row.length !== 5) ||
          row.some((x) => typeof x !== "string" || x.length > 1000),
      ) ||
      candidate.clubs.some(
        (row) =>
          !Array.isArray(row) ||
          (row.length !== 7 && row.length !== 11) ||
          row.slice(0, 6).some((x) => typeof x !== "string" || x.length > 1000) ||
          !Number.isFinite(row[6]) ||
          (row.length === 11 &&
            (row.slice(7, 10).some((x) => typeof x !== "string" || x.length > 1000) ||
              (row[10] !== null && !Number.isFinite(row[10])))),
      )
    )
      return null;
    if (
      new Set(candidate.leagues.map((row) => row[0])).size !== candidate.leagues.length ||
      new Set(candidate.clubs.map((row) => row[0])).size !== candidate.clubs.length
    )
      return null;
    return candidate;
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
  crest_url?: string | null;
  city?: string | null;
  country?: string | null;
  founded?: number | null;
};

async function fetchAll(): Promise<Cache> {
  // A fresh public cache needs neither auth SDK initialization nor another download.
  const { supabase } = await import("@/integrations/supabase/client");
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
        .select("id,name,country,flag,logo_url")
        .order("id")
        .limit(PAGE);
      return after ? query.gt("id", after) : query;
    }),
    pages<ClubSelect>((after) => {
      const query = supabase
        .from("clubs")
        .select(
          "id,competition_id,name,short_name,primary_color,secondary_color,strength,crest_url,city,country,founded",
        )
        .not("competition_id", "is", null)
        .order("id")
        .limit(PAGE);
      return after ? query.gt("id", after) : query;
    }),
  ]);
  const clubs: ClubRow[] = [];
  for (const c of fetchedClubs) {
    if (
      !validCatalogIdentity(c.id) ||
      !validCatalogIdentity(c.competition_id) ||
      !validCatalogLabel(c.name)
    )
      continue;
    clubs.push([
      c.id,
      c.competition_id,
      c.name,
      c.short_name,
      c.primary_color,
      c.secondary_color,
      c.strength,
      catalogImageUrl(c.crest_url) ?? "",
      c.city ?? "",
      c.country ?? "",
      c.founded ?? null,
    ]);
  }
  const leagues: LeagueRow[] = (comps ?? [])
    .filter((c) => validCatalogIdentity(c.id) && validCatalogLabel(c.name))
    .map((c) => [c.id, c.name, c.country, c.flag ?? "", catalogImageUrl(c.logo_url) ?? ""]);
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
