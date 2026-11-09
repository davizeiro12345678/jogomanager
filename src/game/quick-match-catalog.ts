import {
  DEFAULT_QUICK_MATCH_LEAGUE,
  QUICK_MATCH_COUNTRY_GROUPS,
  QUICK_MATCH_COUNTRY_ORDER_VARIANTS,
  QUICK_MATCH_LEAGUE_DIRECTORY,
  QUICK_MATCH_LOCALE_ORDER_VARIANT,
} from "./data/quick-match-catalog";
import type { QuickMatchLeagueSummary } from "./data/quick-match-catalog";
import type { Lang } from "@/i18n/locale-identifiers";

export { DEFAULT_QUICK_MATCH_LEAGUE, QUICK_MATCH_LEAGUE_DIRECTORY };
export type { QuickMatchLeagueSummary } from "./data/quick-match-catalog";

export type QuickMatchLeagueGroup = {
  country: string;
  leagues: readonly QuickMatchLeagueSummary[];
};

// Generation owns collation. These small projections retain one stable array
// per distinct ordering, including across languages with identical ordering.
const countryGroups: readonly QuickMatchLeagueGroup[] = QUICK_MATCH_COUNTRY_GROUPS.map(
  (indices) => {
    const leagues = indices.map((index) => QUICK_MATCH_LEAGUE_DIRECTORY[index]!);
    return { country: leagues[0]!.country, leagues };
  },
);
const countryOrders = QUICK_MATCH_COUNTRY_ORDER_VARIANTS.map((indices) =>
  indices.map((index) => countryGroups[index]!),
);
const localeOrders: Readonly<Partial<Record<Lang, number>>> = QUICK_MATCH_LOCALE_ORDER_VARIANT;

export function quickMatchLeagueGroups(lang: Lang): readonly QuickMatchLeagueGroup[] {
  return countryOrders[localeOrders[lang] ?? QUICK_MATCH_LOCALE_ORDER_VARIANT["pt-BR"]]!;
}

type FullCatalogModule = typeof import("./data/leagues");
let pendingCatalog: Promise<FullCatalogModule> | undefined;

/** Load the full league/club payload only after the user requests another league. */
export function preloadQuickMatchCatalog() {
  return (pendingCatalog ??= import("./data/leagues").catch((error: unknown) => {
    pendingCatalog = undefined;
    throw error;
  }));
}
