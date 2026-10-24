import { SHIPPED_LEAGUES } from "@/game/data/leagues";

type CatalogLeague = { id: string; clubs: readonly { id: string; name: string }[] };

/** Memberships may repeat an identity; equal names alone never identify a club. */
export function catalogFacts(leagues: readonly CatalogLeague[]) {
  const competitions = new Set<string>();
  const clubs = new Set<string>();
  let memberships = 0;
  for (const league of leagues) {
    competitions.add(league.id);
    for (const club of league.clubs) {
      const name = club.name.trim();
      // Only the five-letter sentinel needs case folding. Running ICU locale
      // conversion for every real club on every selection render was wasteful.
      if (!club.id.trim() || !name || (name.length === 5 && name.toLowerCase() === "clube"))
        continue;
      clubs.add(club.id);
      memberships++;
    }
  }
  return { competitions: competitions.size, playableClubs: clubs.size, memberships };
}

export const SHIPPED_CATALOG = Object.freeze(catalogFacts(SHIPPED_LEAGUES));
export const PLAYABLE_CLUB_COUNT = SHIPPED_CATALOG.playableClubs;
