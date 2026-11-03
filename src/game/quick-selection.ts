import type { League } from "./types";

export interface QuickSelection {
  leagues: Pick<League, "id" | "name" | "country">[];
  league: League;
}

let pending: Promise<typeof import("./data/leagues")> | undefined;

/** One canonical catalogue; only load all clubs for navigation or selection intent. */
export function loadQuickCatalogue() {
  return (pending ??= import("./data/leagues").catch((error: unknown) => {
    pending = undefined;
    throw error;
  }));
}

/** SSR sends the selector index and the visible league, not the entire world.
 * Client-side navigation uses the same lazy module and remains offline-capable
 * whenever the existing application catalogue has already been cached. */
export async function loadQuickSelection(): Promise<QuickSelection> {
  const { LEAGUES } = await loadQuickCatalogue();
  return {
    leagues: LEAGUES.map(({ id, name, country }) => ({ id, name, country })),
    league: LEAGUES[0]!,
  };
}
