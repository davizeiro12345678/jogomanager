import { expect, it, vi } from "vitest";

import {
  QUICK_MATCH_COUNTRY_ORDER_VARIANTS,
  QUICK_MATCH_LEAGUE_DIRECTORY,
} from "./data/quick-match-catalog";
import { LEAGUES } from "./data/leagues";
import {
  DEFAULT_QUICK_MATCH_LEAGUE,
  preloadQuickMatchCatalog,
  quickMatchLeagueGroups,
} from "./quick-match-catalog";
import { RUNTIME_APPROVED_LOCALES } from "@/i18n/locale-runtime-manifest";
import type { QuickMatchLeagueSummary } from "./data/quick-match-catalog";
import { randomQuickMatchPair, selectableQuickMatchClubs } from "./quick-match-selection";

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

const club = (id: string, name: string): import("./types").Club => ({
  id,
  name,
  short: name.slice(0, 3).toUpperCase(),
  league: "bra",
  primary: "#123456",
  secondary: "#ffffff",
  strength: 70,
});

it("excludes unresolved and generic club fallbacks from quick-match selection", () => {
  const flamengo = club("fla", "Flamengo");
  const palmeiras = club("pal", "Palmeiras");
  const generic = club("generic", "Clube");
  const canonical = {
    fla: flamengo,
    pal: palmeiras,
    generic,
  };
  const selected = selectableQuickMatchClubs(
    [flamengo, generic, club("missing", "Clube Atlético"), palmeiras, flamengo],
    canonical,
  );
  expect(selected).toEqual([flamengo, palmeiras]);
});

it("rejects generic fallback labels independent of accents and case", () => {
  const labels = ["CLUBE", "Clube convidado", "Unknown Club", "Sem nome"];
  const canonical = Object.fromEntries(
    labels.map((name, index) => {
      const item = club(`generic-${index}`, name);
      return [item.id, item];
    }),
  );
  expect(selectableQuickMatchClubs(Object.values(canonical), canonical)).toEqual([]);
});

it("always returns two distinct canonical clubs for a random matchup", () => {
  const clubs = [club("fla", "Flamengo"), club("pal", "Palmeiras"), club("bot", "Botafogo")];
  const pair = randomQuickMatchPair(clubs, () => 0);
  expect(pair).toEqual({ home: clubs[0], away: clubs[1] });
  expect(pair?.home.id).not.toBe(pair?.away.id);
  expect(randomQuickMatchPair([clubs[0]!], () => 0)).toBeNull();
});

it("keeps the default quick-match league backed by two identified canonical clubs", async () => {
  const { CLUBS } = await preloadQuickMatchCatalog();
  const selected = selectableQuickMatchClubs(DEFAULT_QUICK_MATCH_LEAGUE.clubs, CLUBS);
  expect(selected.length).toBeGreaterThanOrEqual(2);
  expect(selected.every((item) => item.name.trim() && item.name.trim().toLocaleLowerCase() !== "clube")).toBe(true);
});
