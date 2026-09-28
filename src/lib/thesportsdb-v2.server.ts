/**
 * Cliente TheSportsDB v2 (Premium). A chave vai no cabeçalho X-API-KEY e é
 * lida só no servidor — nunca aparece em URL nem em log.
 */
const BASE = "https://www.thesportsdb.com/api/v2/json";

type Json = Record<string, unknown>;

async function v2(path: string): Promise<Json | null> {
  const key = process.env["THESPORTSDB_API_KEY"];
  if (!key) return null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${BASE}/${path}`, {
        headers: { "X-API-KEY": key, accept: "application/json" },
        signal: AbortSignal.timeout(12_000),
      });
      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        continue;
      }
      if (!res.ok) return null;
      return (await res.json()) as Json;
    } catch {
      if (attempt === 2) return null;
    }
  }
  return null;
}

/** A v2 devolve a lista na primeira chave do objeto (list, lookup, schedule…). */
function firstArray(json: Json | null): Json[] {
  if (!json) return [];
  for (const v of Object.values(json)) if (Array.isArray(v)) return v as Json[];
  return [];
}

const id = (v: string | number) => encodeURIComponent(String(v));

export const sdbV2 = {
  allLeagues: async () => firstArray(await v2("all/leagues")),
  listTeams: async (idLeague: string) => firstArray(await v2(`list/teams/${id(idLeague)}`)),
  listPlayers: async (idTeam: string) => firstArray(await v2(`list/players/${id(idTeam)}`)),
  listSeasons: async (idLeague: string) => firstArray(await v2(`list/seasons/${id(idLeague)}`)),
  lookupPlayer: async (p: string) => firstArray(await v2(`lookup/player/${id(p)}`))[0] ?? null,
  lookupTeam: async (t: string) => firstArray(await v2(`lookup/team/${id(t)}`))[0] ?? null,
  lookupLeague: async (l: string) => firstArray(await v2(`lookup/league/${id(l)}`))[0] ?? null,
  lookupEvent: async (e: string) => firstArray(await v2(`lookup/event/${id(e)}`))[0] ?? null,
  lookupVenue: async (v: string) => firstArray(await v2(`lookup/venue/${id(v)}`))[0] ?? null,
  schedule: async (l: string, season: string) =>
    firstArray(await v2(`schedule/league/${id(l)}/${id(season)}`)),
  playerStats: async (p: string) => firstArray(await v2(`lookup/player_stats/${id(p)}`)),
  playerTeams: async (p: string) => firstArray(await v2(`lookup/player_teams/${id(p)}`)),
  playerContracts: async (p: string) => firstArray(await v2(`lookup/player_contracts/${id(p)}`)),
  playerHonours: async (p: string) => firstArray(await v2(`lookup/player_honours/${id(p)}`)),
  teamEquipment: async (t: string) => firstArray(await v2(`lookup/team_equipment/${id(t)}`)),
  eventLineup: async (e: string) => firstArray(await v2(`lookup/event_lineup/${id(e)}`)),
  eventStats: async (e: string) => firstArray(await v2(`lookup/event_stats/${id(e)}`)),
  eventTimeline: async (e: string) => firstArray(await v2(`lookup/event_timeline/${id(e)}`)),
};

export const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() && v !== "null" ? v.trim() : null;
export const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number.parseFloat(v) : NaN;
  return Number.isFinite(n) ? n : null;
};
