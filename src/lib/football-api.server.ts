/**
 * Server-only clients for the public football data APIs.
 *
 * Sources, in order of preference:
 *  - TheSportsDB     -> official crests, kit images, stadium data, founding year
 *  - football-data.org -> competitions, squads for the big European leagues + Brasileirão
 *  - API-Football    -> wide coverage fallback for squads
 *
 * All of them are optional: when a key is missing the importer simply skips
 * that source instead of failing.
 */

export interface RemoteTeam {
  source: string;
  externalId: string;
  name: string;
  crestUrl?: string | undefined;
  kitUrl?: string | undefined;
  stadium?: string | undefined;
  stadiumCapacity?: number | undefined;
  city?: string | undefined;
  country?: string | undefined;
  founded?: number | undefined;
  apiFootballId?: string | undefined;
}

export interface RemotePlayer {
  source: string;
  externalId: string;
  name: string;
  position: string;
  age?: number | undefined;
  shirtNumber?: number | undefined;
  nationality?: string | undefined;
  photoUrl?: string | undefined;
}

const UA = { "User-Agent": "football-manager-app/1.0" };

async function getJson<T>(url: string, headers: Record<string, string> = {}): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: { ...UA, ...headers } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* TheSportsDB                                                         */
/* ------------------------------------------------------------------ */

interface SdbTeam {
  idTeam?: string;
  idAPIfootball?: string;
  strTeam?: string;
  strTeamAlternate?: string;
  strBadge?: string;
  strTeamBadge?: string;
  strEquipment?: string;
  strTeamJersey?: string;
  strStadium?: string;
  intStadiumCapacity?: string;
  strLocation?: string;
  strCountry?: string;
  intFormedYear?: string;
}

function normalise(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function mapSdb(t: SdbTeam): RemoteTeam {
  return {
    source: "thesportsdb",
    externalId: String(t.idTeam ?? ""),
    name: t.strTeam ?? "",
    crestUrl: t.strBadge ?? t.strTeamBadge ?? undefined,
    kitUrl: t.strEquipment ?? t.strTeamJersey ?? undefined,
    stadium: t.strStadium ?? undefined,
    stadiumCapacity: t.intStadiumCapacity ? Number(t.intStadiumCapacity) || undefined : undefined,
    city: t.strLocation ?? undefined,
    country: t.strCountry ?? undefined,
    founded: t.intFormedYear ? Number(t.intFormedYear) || undefined : undefined,
    apiFootballId: t.idAPIfootball || undefined,
  };
}

/** Search a club on TheSportsDB by name, optionally constrained to a country. */
export async function sdbSearchTeam(name: string, country?: string): Promise<RemoteTeam | null> {
  const key = process.env["THESPORTSDB_API_KEY"] ?? "3";
  const url = `https://www.thesportsdb.com/api/v1/json/${key}/searchteams.php?t=${encodeURIComponent(name)}`;
  const json = await getJson<{ teams: SdbTeam[] | null }>(url);
  const teams = json?.teams;
  if (!teams || teams.length === 0) return null;

  const soccer = teams.filter((t) => !("strSport" in t) || (t as { strSport?: string }).strSport === "Soccer");
  const pool = soccer.length ? soccer : teams;
  const wanted = normalise(name);

  const byCountry = country
    ? pool.filter((t) => normalise(t.strCountry ?? "") === normalise(country))
    : [];
  const candidates = byCountry.length ? byCountry : pool;

  const exact = candidates.find(
    (t) => normalise(t.strTeam ?? "") === wanted || normalise(t.strTeamAlternate ?? "").includes(wanted),
  );
  return mapSdb(exact ?? candidates[0]!);
}

/* ------------------------------------------------------------------ */
/* football-data.org                                                   */
/* ------------------------------------------------------------------ */

interface FdSquadMember {
  id?: number;
  name?: string;
  position?: string;
  dateOfBirth?: string;
  nationality?: string | undefined;
}

export async function footballDataSquad(teamId: string): Promise<RemotePlayer[]> {
  const key = process.env["FOOTBALL_DATA_API_KEY"];
  if (!key) return [];
  const json = await getJson<{ squad?: FdSquadMember[] }>(
    `https://api.football-data.org/v4/teams/${teamId}`,
    { "X-Auth-Token": key },
  );
  const squad = json?.squad ?? [];
  return squad.map((p) => ({
    source: "football-data",
    externalId: String(p.id ?? ""),
    name: p.name ?? "",
    position: mapPosition(p.position),
    age: p.dateOfBirth ? ageFrom(p.dateOfBirth) : undefined,
    nationality: p.nationality ?? undefined,
  }));
}

/* ------------------------------------------------------------------ */
/* API-Football (API-Sports)                                           */
/* ------------------------------------------------------------------ */

interface AfPlayer {
  id?: number;
  name?: string;
  age?: number | undefined;
  number?: number;
  position?: string;
  photo?: string;
}

export async function apiFootballSquad(teamId: string): Promise<RemotePlayer[]> {
  const key = process.env["APIFOOTBALL_API_KEY"];
  if (!key) return [];
  const json = await getJson<{ response?: { players?: AfPlayer[] }[] }>(
    `https://v3.football.api-sports.io/players/squads?team=${encodeURIComponent(teamId)}`,
    { "x-apisports-key": key },
  );
  const players = json?.response?.[0]?.players ?? [];
  return players.map((p) => ({
    source: "api-football",
    externalId: String(p.id ?? ""),
    name: p.name ?? "",
    position: mapPosition(p.position),
    age: p.age,
    shirtNumber: p.number,
    photoUrl: p.photo,
  }));
}

/** Find the API-Football team id by name (needed before fetching a squad). */
export async function apiFootballTeamId(name: string, country?: string): Promise<string | null> {
  const key = process.env["APIFOOTBALL_API_KEY"];
  if (!key) return null;
  const json = await getJson<{ response?: { team?: { id?: number; name?: string; country?: string } }[] }>(
    `https://v3.football.api-sports.io/teams?search=${encodeURIComponent(name)}`,
    { "x-apisports-key": key },
  );
  const list = json?.response ?? [];
  if (!list.length) return null;
  const wanted = normalise(name);
  const hit =
    list.find(
      (r) =>
        normalise(r.team?.name ?? "") === wanted &&
        (!country || normalise(r.team?.country ?? "") === normalise(country)),
    ) ?? list[0];
  return hit?.team?.id ? String(hit.team.id) : null;
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

export function mapPosition(raw?: string): "GK" | "DF" | "MF" | "FW" {
  const p = (raw ?? "").toLowerCase();
  if (p.includes("goal") || p.includes("keeper") || p === "g") return "GK";
  if (p.includes("def") || p.includes("back") || p === "d") return "DF";
  if (p.includes("mid") || p === "m") return "MF";
  if (p.includes("att") || p.includes("forward") || p.includes("wing") || p === "f") return "FW";
  return "MF";
}

export function ageFrom(iso: string): number | undefined {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a -= 1;
  return a;
}

/* ------------------------------------------------------------------ */
/* TheSportsDB squads (free tier)                                      */
/* ------------------------------------------------------------------ */

interface SdbPlayer {
  idPlayer?: string;
  strPlayer?: string;
  strPosition?: string;
  strNumber?: string;
  strNationality?: string;
  dateBorn?: string;
  strCutout?: string;
  strThumb?: string;
}

/** Full squad for a TheSportsDB team id, including player photos. */
export async function sdbSquad(teamId: string): Promise<RemotePlayer[]> {
  const key = process.env["THESPORTSDB_API_KEY"] ?? "3";
  const json = await getJson<{ player: SdbPlayer[] | null }>(
    `https://www.thesportsdb.com/api/v1/json/${key}/lookup_all_players.php?id=${encodeURIComponent(teamId)}`,
  );
  const list = json?.player ?? [];
  return list
    .filter((p) => p.strPlayer)
    .map((p) => ({
      source: "thesportsdb",
      externalId: String(p.idPlayer ?? ""),
      name: p.strPlayer!,
      position: mapPosition(p.strPosition),
      age: p.dateBorn ? ageFrom(p.dateBorn) : undefined,
      shirtNumber: p.strNumber ? Number(p.strNumber) || undefined : undefined,
      nationality: p.strNationality ?? undefined,
      photoUrl: p.strCutout ?? p.strThumb ?? undefined,
    }));
}
