// Merges clubs and competitions stored in the backend that the bundled catalogue
// does not ship, so every imported club can be chosen. Bundled entries win.
import { supabase } from "@/integrations/supabase/client";
import { CLUBS, LEAGUES } from "@/game/data/leagues";
import type { Club, League } from "@/game/types";

const CACHE_KEY = "db-catalog-v1";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PAGE = 1000;
export const CATALOG_EVENT = "db-catalog-updated";

type LeagueRow = [id: string, name: string, country: string, flag: string];
type ClubRow = [id: string, league: string, name: string, short: string, p: string, s: string, str: number];
type Cache = { at: number; leagues: LeagueRow[]; clubs: ClubRow[] };

const HEX = /^#[0-9a-f]{6}$/i;
let merged = false;
let refreshing: Promise<void> | null = null;

function apply(cache: Cache) {
  const byId = new Map(LEAGUES.map((l) => [l.id, l]));
  for (const [id, name, country, flag] of cache.leagues) {
    if (!byId.has(id)) {
      const league: League = { id, name, country, flag: flag || "🏳️", clubs: [], catalogStatus: "sourced" };
      LEAGUES.push(league);
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
  for (let i = LEAGUES.length - 1; i >= 0; i--) if (LEAGUES[i]!.clubs.length < 2) LEAGUES.splice(i, 1);
  merged = true;
}

function readCache(): Cache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Cache) : null;
  } catch {
    return null;
  }
}

async function fetchAll(): Promise<Cache> {
  const { data: comps, error } = await supabase.from("competitions").select("id,name,country,flag");
  if (error) throw error;
  const { count, error: countError } = await supabase
    .from("clubs")
    .select("id", { count: "exact", head: true });
  if (countError) throw countError;
  const pages = Math.ceil((count ?? 0) / PAGE);
  const results = await Promise.all(
    Array.from({ length: pages }, (_, i) =>
      supabase
        .from("clubs")
        .select("id,competition_id,name,short_name,primary_color,secondary_color,strength")
        .order("id")
        .range(i * PAGE, i * PAGE + PAGE - 1),
    ),
  );
  const clubs: ClubRow[] = [];
  for (const r of results) {
    if (r.error) throw r.error;
    for (const c of r.data) {
      if (!c.competition_id || CLUBS[c.id]) continue;
      clubs.push([c.id, c.competition_id, c.name, c.short_name, c.primary_color, c.secondary_color, c.strength]);
    }
  }
  const known = new Set(LEAGUES.map((l) => l.id));
  const leagues: LeagueRow[] = (comps ?? [])
    .filter((c) => !known.has(c.id))
    .map((c) => [c.id, c.name, c.country, c.flag ?? ""]);
  return { at: Date.now(), leagues, clubs };
}

/** Applies the cached catalogue at once and refreshes it in the background. */
export function loadDbCatalog(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  const cache = readCache();
  if (cache && !merged) apply(cache);
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
