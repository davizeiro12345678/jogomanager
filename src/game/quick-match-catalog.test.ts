import { expect, it } from "vitest";

import {
  DEFAULT_QUICK_MATCH_LEAGUE,
  QUICK_MATCH_LEAGUE_DIRECTORY,
} from "./data/quick-match-catalog";
import { LEAGUES } from "./data/leagues";
import { preloadQuickMatchCatalog } from "./quick-match-catalog";

it("keeps the lightweight league directory and default roster aligned with the full catalog", () => {
  expect(QUICK_MATCH_LEAGUE_DIRECTORY).toEqual(
    LEAGUES.map(({ id, name, country }) => ({ id, name, country })),
  );
  expect(DEFAULT_QUICK_MATCH_LEAGUE).toEqual(LEAGUES[0]);
  expect(DEFAULT_QUICK_MATCH_LEAGUE.clubs.length).toBeGreaterThanOrEqual(2);
});

it("shares the lazy full-catalog import and resolves the same league data", async () => {
  const first = preloadQuickMatchCatalog();
  const second = preloadQuickMatchCatalog();

  expect(second).toBe(first);
  const catalog = await first;
  expect(catalog.LEAGUES).toBe(LEAGUES);
  expect(catalog.getLeague("bra")).toEqual(DEFAULT_QUICK_MATCH_LEAGUE);
});
