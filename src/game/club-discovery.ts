import type { Club, League } from "./types";

export type CareerChallenge = "all" | "contender" | "build" | "underdog";
export type ClubDiscovery = { club: Club; league: League; locked: boolean; reputation: number };

const NON_LEAGUE_COUNTRIES = new Set([
  "africa",
  "asia",
  "caribbean",
  "central america",
  "continental",
  "europe",
  "global",
  "international",
  "north america",
  "oceania",
  "south america",
  "world",
  "worldwide",
]);
const CUP_FORMATS = new Set([
  "cup",
  "copa",
  "coppa",
  "coupe",
  "kupa",
  "pohar",
  "pokal",
  "puchar",
  "shield",
  "taca",
  "trophy",
]);
const INTERNATIONAL_FORMATS = new Set([
  "champions",
  "continental",
  "conference",
  "friendly",
  "intercontinental",
  "libertadores",
  "olympic",
  "recopa",
  "sudamericana",
  "uefa",
]);

/** Keep cup, international and age-group competitions out of career league choices. */
export function isCareerCompetition(league: League): boolean {
  if (NON_LEAGUE_COUNTRIES.has(searchKey(league.country))) return false;
  const words = searchKey(league.name)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  if (words.some((word) => CUP_FORMATS.has(word) || INTERNATIONAL_FORMATS.has(word))) return false;
  if (words.some((word) => /^u(?:1[5-9]|2[0-3])$/.test(word))) return false;
  if (words.join(" ").includes("under 21") || words.join(" ").includes("under 20")) return false;
  return true;
}

export function careerLeagues(leagues: readonly League[]): League[] {
  return leagues.filter((league) => isCareerCompetition(league) && league.clubs.length >= 6);
}

/** Searchable, bounded options for league selectors backed by large imported catalogs. */
export function careerLeagueOptions(
  leagues: readonly League[],
  query = "",
  selectedId?: string,
  limit = 40,
  preserveSelected = true,
): League[] {
  const normalizedQuery = searchKey(query);
  const eligible = careerLeagues(leagues);
  const matches = eligible.filter(
    (league) =>
      !normalizedQuery || searchKey(`${league.name} ${league.country}`).includes(normalizedQuery),
  );
  const maximum = Math.max(1, limit);
  const result = matches.slice(0, maximum);
  const selected = preserveSelected
    ? eligible.find((league) => league.id === selectedId)
    : undefined;
  if (selected && !result.some((league) => league.id === selected.id)) {
    if (result.length === maximum) result[result.length - 1] = selected;
    else result.push(selected);
  }
  return result;
}

export function searchKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

export function requiredReputation(strength: number): number {
  return Math.max(1, Math.min(5, Math.ceil((strength - 66) / 6)));
}

/** Search the whole catalogue when a query is present. League browsing stays
 * scoped when it is empty, and an explicit league filter can narrow a search. */
export function discoverClubs(
  leagues: readonly League[],
  input: {
    query: string;
    leagueId: string;
    reputation: number;
    challenge?: CareerChallenge;
    availableOnly?: boolean;
    scopeSearch?: boolean;
  },
): ClubDiscovery[] {
  const query = searchKey(input.query);
  const tokens = query.split(/\s+/).filter(Boolean);
  const seen = new Set<string>();
  const result: ClubDiscovery[] = [];
  for (const league of leagues) {
    if (!isCareerCompetition(league)) continue;
    if ((!query || input.scopeSearch) && league.id !== input.leagueId) continue;
    const leagueKey = searchKey(`${league.name} ${league.country}`);
    for (const club of league.clubs) {
      if (seen.has(club.id)) continue;
      const key = `${searchKey(`${club.name} ${club.short}`)} ${leagueKey}`;
      if (tokens.some((token) => !key.includes(token))) continue;
      const challenge = input.challenge ?? "all";
      if (challenge === "contender" && club.strength < 82) continue;
      if (challenge === "build" && (club.strength < 72 || club.strength >= 82)) continue;
      if (challenge === "underdog" && club.strength >= 72) continue;
      const reputation = requiredReputation(club.strength);
      const locked = reputation > input.reputation;
      if (input.availableOnly && locked) continue;
      seen.add(club.id);
      result.push({ club, league, locked, reputation });
    }
  }
  return result.sort(
    (a, b) =>
      Number(a.locked) - Number(b.locked) ||
      b.club.strength - a.club.strength ||
      a.club.name.localeCompare(b.club.name, "pt-BR"),
  );
}
