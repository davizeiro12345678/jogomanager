import { expect, it, vi } from "vitest";

import {
  DEFAULT_QUICK_MATCH_LEAGUE,
  QUICK_MATCH_COUNTRY_ORDER_VARIANTS,
  QUICK_MATCH_LEAGUE_DIRECTORY,
} from "./data/quick-match-catalog";
import { LEAGUES } from "./data/leagues";
import { preloadQuickMatchCatalog, quickMatchLeagueGroups } from "./quick-match-catalog";
import { RUNTIME_APPROVED_LOCALES } from "@/i18n/locale-runtime-manifest";
import type { QuickMatchLeagueSummary } from "./data/quick-match-catalog";

it("keeps the lightweight league directory and default roster aligned with the full catalog", () => {
  expect(QUICK_MATCH_LEAGUE_DIRECTORY).toEqual(
    LEAGUES.map(({ id, name, country }) => ({ id, name, country })),
  );
  expect(DEFAULT_QUICK_MATCH_LEAGUE).toEqual(LEAGUES[0]);
  expect(DEFAULT_QUICK_MATCH_LEAGUE.clubs.length).toBeGreaterThanOrEqual(2);
});

it.each(RUNTIME_APPROVED_LOCALES)(
  "preserves the exact country and league ordering formerly computed in the %s render",
  (lang) => {
    const grouped = QUICK_MATCH_LEAGUE_DIRECTORY.reduce<Record<string, QuickMatchLeagueSummary[]>>(
      (groups, entry) => {
        (groups[entry.country] ??= []).push(entry);
        return groups;
      },
      {},
    );
    const compare = new Intl.Collator(lang).compare;
    const expected = Object.entries(grouped)
      .sort(([a], [b]) => (a === "Brasil" ? -1 : b === "Brasil" ? 1 : compare(a, b)))
      .map(([country, leagues]) => ({ country, leagues }));
    const actual = quickMatchLeagueGroups(lang);
    expect(actual).toEqual(expected);
    expect(actual.flatMap(({ leagues }) => leagues)).toHaveLength(
      QUICK_MATCH_LEAGUE_DIRECTORY.length,
    );
  },
);

it("shares the same option-group references across identical locale order variants", () => {
  const uniqueOrders = new Map<string, ReturnType<typeof quickMatchLeagueGroups>>();
  for (const lang of RUNTIME_APPROVED_LOCALES) {
    const groups = quickMatchLeagueGroups(lang);
    const key = groups.map(({ country }) => country).join("\0");
    const previous = uniqueOrders.get(key);
    if (previous) expect(groups).toBe(previous);
    else uniqueOrders.set(key, groups);
  }
  expect(uniqueOrders.size).toBe(QUICK_MATCH_COUNTRY_ORDER_VARIANTS.length);
});

it("needs no runtime ICU collation and uses the existing default order for an unpublished locale", () => {
  const collator = vi.spyOn(Intl, "Collator").mockImplementation(() => {
    throw new Error("Runtime collation must not be needed for selection.");
  });
  try {
    for (const lang of RUNTIME_APPROVED_LOCALES)
      expect(quickMatchLeagueGroups(lang).length).toBeGreaterThan(0);
    expect(quickMatchLeagueGroups("eo")).toBe(quickMatchLeagueGroups("pt-BR"));
    expect(collator).not.toHaveBeenCalled();
  } finally {
    collator.mockRestore();
  }
});

it("shares the lazy full-catalog import and resolves the same league data", async () => {
  const first = preloadQuickMatchCatalog();
  const second = preloadQuickMatchCatalog();

  expect(second).toBe(first);
  const catalog = await first;
  expect(catalog.LEAGUES).toBe(LEAGUES);
  expect(catalog.getLeague("bra")).toEqual(DEFAULT_QUICK_MATCH_LEAGUE);
});
