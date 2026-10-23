import { SHIPPED_LEAGUES } from "@/game/data/leagues";

type CatalogLeague = { id: string; clubs: readonly { id: string; name: string }[] };

/** Memberships may repeat an identity; equal names alone never identify a club. */
export function catalogFacts(leagues: readonly CatalogLeague[]) {
  const clubs = leagues.flatMap((league) =>
    league.clubs.filter((club) => {
      const name = club.name.trim().toLocaleLowerCase("pt-BR");
      return club.id.trim().length > 0 && name.length > 0 && name !== "clube";
    }),
  );
  return {
    competitions: new Set(leagues.map((league) => league.id)).size,
    playableClubs: new Set(clubs.map((club) => club.id)).size,
    memberships: clubs.length,
  };
}

export const SHIPPED_CATALOG = Object.freeze(catalogFacts(SHIPPED_LEAGUES));
export const PLAYABLE_CLUB_COUNT = SHIPPED_CATALOG.playableClubs;
