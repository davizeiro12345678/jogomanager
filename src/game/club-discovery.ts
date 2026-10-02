import type { Club, League } from "./types";

export type CareerChallenge = "all" | "contender" | "build" | "underdog";
export type ClubDiscovery = { club: Club; league: League; locked: boolean; reputation: number };

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
