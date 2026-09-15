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
  stadiumPhoto?: string | undefined;
  stadium?: string | undefined;
  stadiumCapacity?: number | undefined;
  stadiumPhotoUrl?: string | undefined;
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
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { ...UA, ...headers } });
      if (res.ok) return (await res.json()) as T;
      // Free tiers throttle aggressively; back off and try again.
      if (res.status === 429 || res.status >= 500) {
        await new Promise((r) => setTimeout(r, 700 * (attempt + 1) + Math.random() * 400));
        continue;
      }
      return null;
    } catch {
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  return null;
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
  strStadiumThumb?: string;
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
    stadiumPhoto: t.strStadiumThumb ?? undefined,
    kitUrl: t.strEquipment ?? t.strTeamJersey ?? undefined,
    stadium: t.strStadium ?? undefined,
    stadiumCapacity: t.intStadiumCapacity ? Number(t.intStadiumCapacity) || undefined : undefined,
    stadiumPhotoUrl: t.strStadiumThumb ?? undefined,
    city: t.strLocation ?? undefined,
    country: t.strCountry ?? undefined,
    founded: t.intFormedYear ? Number(t.intFormedYear) || undefined : undefined,
    apiFootballId: t.idAPIfootball || undefined,
  };
}

/** Localised club names -> the name TheSportsDB indexes them under. */
const NAME_ALIASES: Record<string, string> = {
  bayerndemunique: "Bayern Munich",
  olympiquedemarselha: "Olympique de Marseille",
  parissaintgermain: "Paris SG",
  aekatenas: "AEK Athens",
  legiavarsovia: "Legia Warszawa",
  rapidviena: "Rapid Wien",
  bodoglimt: "Bodo/Glimt",
  saintetienne: "AS Saint-Etienne",
  unionsaintgilloise: "Royale Union Saint-Gilloise",
  interdemilao: "Inter Milan",
  acmilao: "AC Milan",
  bayernmunique: "Bayern Munich",
  colonia: "FC Koln",
  atleticodemadri: "Atletico Madrid",
  realmadri: "Real Madrid",
  sevilha: "Sevilla",
  corunha: "Deportivo La Coruna",
  lisboa: "Lisbon",
  praga: "Prague",
  moscou: "Moscow",
  copenhague: "FC Copenhagen",
  zurique: "FC Zurich",
  genebra: "Servette",
  atenas: "Athens",
};

/** Alternative queries to try when the primary club name finds nothing. */
function nameVariants(name: string): string[] {
  const out = new Set<string>();
  out.add(name);
  const alias = NAME_ALIASES[normalise(name)];
  if (alias) out.add(alias);

  const plain = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  out.add(plain);
  // "Olympique de Marselha" -> "Olympique Marselha"
  out.add(plain.replace(/\s+(de|do|da|of|del|di)\s+/gi, " "));
  // Drop trailing club suffixes that the API often omits.
  out.add(plain.replace(/\s+(FC|CF|SC|AC|BK|SK|FK|CD|AFC)$/i, "").trim());
  // Fall back to the distinctive first two words.
  const words = plain.split(/\s+/);
  if (words.length > 2) out.add(words.slice(0, 2).join(" "));
  return [...out].filter((s) => s.length > 2);
}

async function sdbQuery(key: string, query: string): Promise<SdbTeam[]> {
  const url = `https://www.thesportsdb.com/api/v1/json/${key}/searchteams.php?t=${encodeURIComponent(query)}`;
  const json = await getJson<{ teams: SdbTeam[] | null }>(url);
  return json?.teams ?? [];
}

/** Search a club on TheSportsDB by name, optionally constrained to a country. */
export async function sdbSearchTeam(name: string, country?: string): Promise<RemoteTeam | null> {
  const key = process.env["THESPORTSDB_API_KEY"] ?? "123";
  const wanted = normalise(name);
  let loose: SdbTeam | null = null;

  for (const query of nameVariants(name)) {
    const teams = await sdbQuery(key, query);
    if (!teams.length) continue;

    const soccer = teams.filter(
      (t) => !("strSport" in t) || (t as { strSport?: string }).strSport === "Soccer",
    );
    const pool = soccer.length ? soccer : teams;

    const byCountry = country
      ? pool.filter((t) => normalise(t.strCountry ?? "") === normalise(country))
      : [];
    const candidates = byCountry.length ? byCountry : pool;

    const exact = candidates.find(
      (t) =>
        normalise(t.strTeam ?? "") === wanted ||
        normalise(t.strTeam ?? "") === normalise(query) ||
        normalise(t.strTeamAlternate ?? "").includes(wanted),
    );
    if (exact) return mapSdb(exact);
    // Keep a same-country candidate as a fallback, but keep trying variants.
    if (!loose && byCountry.length) loose = candidates[0]!;
  }

  return loose ? mapSdb(loose) : null;
}

/**
 * Fetch every team of a league in a single request.
 * Far cheaper than one search per club on the rate-limited free tier.
 */
export async function sdbAllTeams(
  league: string,
): Promise<(RemoteTeam & { alternate?: string | undefined })[]> {
  const key = process.env["THESPORTSDB_API_KEY"] ?? "123";
  const json = await getJson<{ teams: (SdbTeam & { strTeamAlternate?: string })[] | null }>(
    `https://www.thesportsdb.com/api/v1/json/${key}/search_all_teams.php?l=${encodeURIComponent(league)}`,
  );
  return (json?.teams ?? []).map((t) => ({
    ...mapSdb(t),
    alternate: t.strTeamAlternate ?? undefined,
  }));
}

interface SdbEquipment {
  strEquipment?: string;
  strSeason?: string;
  strType?: string;
}

export interface RemoteKit {
  imageUrl: string;
  season: string;
  kind: "home" | "away" | "third" | "goalkeeper";
}

/** Uniformes oficiais disponíveis para o clube, incluindo visitante e terceiro. */
export async function sdbTeamKits(teamId: string): Promise<RemoteKit[]> {
  const key = process.env["THESPORTSDB_API_KEY"] ?? "123";
  const json = await getJson<{ equipment?: SdbEquipment[] | null }>(
    `https://www.thesportsdb.com/api/v1/json/${key}/lookupequipment.php?id=${encodeURIComponent(teamId)}`,
  );
  return (json?.equipment ?? []).flatMap((item) => {
    if (!item.strEquipment) return [];
    const rawType = (item.strType ?? "home").toLowerCase();
    const kind: RemoteKit["kind"] = rawType.includes("away")
      ? "away"
      : rawType.includes("third")
        ? "third"
        : rawType.includes("goal")
          ? "goalkeeper"
          : "home";
    return [{ imageUrl: item.strEquipment, season: item.strSeason ?? "2025-2026", kind }];
  });
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
  const json = await getJson<{
    response?: { team?: { id?: number; name?: string; country?: string } }[];
  }>(`https://v3.football.api-sports.io/teams?search=${encodeURIComponent(name)}`, {
    "x-apisports-key": key,
  });
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
  const key = process.env["THESPORTSDB_API_KEY"] ?? "123";
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

export async function sdbSearchLeague(name: string): Promise<string | null> {
  const key = process.env["THESPORTSDB_API_KEY"] ?? "123";
  const url = `https://www.thesportsdb.com/api/v1/json/${key}/searchleagues.php?l=${encodeURIComponent(name)}`;
  const json = await getJson<{ countrys: { strBadge?: string; strLogo?: string }[] | null }>(url);
  const hit = json?.countrys?.[0];
  return hit?.strBadge ?? hit?.strLogo ?? null;
}
