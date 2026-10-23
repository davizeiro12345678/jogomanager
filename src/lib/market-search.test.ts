import { expect, it } from "vitest";
import { marketNamePattern, normalizeMarketSearch } from "./market-search";
it("canonicalizes public filters for a stable cache key", () => {
  expect(normalizeMarketSearch({ q: "  João  ", pos: "ALL", page: 0 })).toEqual({
    q: "João",
    page: 0,
  });
  expect(normalizeMarketSearch({ maxAge: 40, minAge: 18, page: 0 })).toEqual(
    normalizeMarketSearch({ page: 0, minAge: 18, maxAge: 40 }),
  );
  expect(marketNamePattern("100%_real\\name")).toBe("%100\\%\\_real\\\\name%");
});
it.each([
  { page: Infinity },
  { page: 0.1 },
  { page: -1 },
  { page: 10001 },
  { q: "a".repeat(81) },
  { q: { toString: (): string => "query" } },
  { minAge: 50, maxAge: 20 },
  { q: "a\n" },
  { minOvr: 101 },
])("rejects abusive or inconsistent market ranges: %j", (input) => {
  expect(() => normalizeMarketSearch(input)).toThrow();
});
