import {
  DEFAULT_QUICK_MATCH_LEAGUE,
  QUICK_MATCH_LEAGUE_DIRECTORY,
} from "./data/quick-match-catalog";

export { DEFAULT_QUICK_MATCH_LEAGUE, QUICK_MATCH_LEAGUE_DIRECTORY };
export type { QuickMatchLeagueSummary } from "./data/quick-match-catalog";

type FullCatalogModule = typeof import("./data/leagues");
let pendingCatalog: Promise<FullCatalogModule> | undefined;

/** Load the full league/club payload only after the user requests another league. */
export function preloadQuickMatchCatalog() {
  return (pendingCatalog ??= import("./data/leagues").catch((error: unknown) => {
    pendingCatalog = undefined;
    throw error;
  }));
}
