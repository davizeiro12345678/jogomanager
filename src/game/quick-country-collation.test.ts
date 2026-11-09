import { afterEach, expect, it, vi } from "vitest";
import { QUICK_MATCH_LEAGUE_DIRECTORY } from "./data/quick-match-catalog";
import { groupQuickMatchLeagues } from "./quick-country-groups";

afterEach(() => vi.restoreAllMocks());

it.each(["pt-BR", "en", "es", "ar", "zh-CN"])(
  "preserves country order with one collator rather than ICU setup per comparison (%s)",
  (lang) => {
    const expected = [
      ...new Set(QUICK_MATCH_LEAGUE_DIRECTORY.map((league) => league.country)),
    ].sort((left, right) =>
      left === "Brasil" ? -1 : right === "Brasil" ? 1 : left.localeCompare(right, lang),
    );
    const legacy = vi.spyOn(String.prototype, "localeCompare");
    const collators = vi.spyOn(Intl, "Collator");
    expect(
      groupQuickMatchLeagues(QUICK_MATCH_LEAGUE_DIRECTORY, lang).map(([country]) => country),
    ).toEqual(expected);
    expect(legacy).not.toHaveBeenCalled();
    expect(collators).toHaveBeenCalledTimes(1);
  },
);

it("keeps all league identities and in-country order without mutating the source", () => {
  const leagues = Object.freeze([
    Object.freeze({ id: "es", country: "Espanha" }),
    Object.freeze({ id: "br-a", country: "Brasil" }),
    Object.freeze({ id: "pt", country: "Portugal" }),
    Object.freeze({ id: "br-b", country: "Brasil" }),
  ]);
  const result = groupQuickMatchLeagues(leagues, "pt-BR");
  expect(result.map(([country]) => country)).toEqual(["Brasil", "Espanha", "Portugal"]);
  const brazil = result[0]![1];
  expect(brazil).toEqual([leagues[1], leagues[3]]);
  expect(brazil[0]).toBe(leagues[1]);
  expect(brazil[1]).toBe(leagues[3]);
  expect(leagues.map((league) => league.id)).toEqual(["es", "br-a", "pt", "br-b"]);
});

it("accepts country labels that coincide with object-prototype property names", () => {
  const leagues = [
    { id: "proto", country: "__proto__" },
    { id: "constructor", country: "constructor" },
    { id: "br", country: "Brasil" },
  ];
  const result = new Map(groupQuickMatchLeagues(leagues, "en"));
  expect(result.get("__proto__")).toEqual([leagues[0]]);
  expect(result.get("constructor")).toEqual([leagues[1]]);
  expect(result.get("Brasil")).toEqual([leagues[2]]);
  expect(groupQuickMatchLeagues([], "pt-BR")).toEqual([]);
});
