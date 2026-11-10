import { describe, expect, it } from "vitest";
import type { League } from "./types";
import { countryIdentity, countryOptions } from "./country-options";

function league(id: string, country: string): League {
  return { id, country, name: `Liga ${id}`, flag: "", clubs: [] };
}

describe("nationality choices for career creation", () => {
  const catalog = [
    league("bra", "Brasil"),
    league("eng", "Inglaterra"),
    league("sco", "Escócia"),
    league("wls", "País de Gales"),
    league("brazil-import", "Brazil"),
    league("england-import", "England"),
    league("scotland-import", "Scotland"),
    league("wales-import", "Wales"),
    league("usa", "Estados Unidos"),
    league("usa-import", "USA"),
    league("usa-alias", "United States"),
    league("world", "World"),
    league("worldwide", "Worldwide"),
    league("europe", "Europe"),
    league("uk", "United Kingdom"),
  ];

  it("groups imported English and Portuguese names while keeping the first stable league id", () => {
    const choices = countryOptions(catalog, "");
    expect(choices.map(({ league: item }) => item.id)).toEqual([
      "bra",
      "sco",
      "usa",
      "eng",
      "wls",
      "uk",
    ]);
    expect(catalog).toHaveLength(15);
  });

  it("finds the same choice through translated, partial and accent-insensitive searches", () => {
    for (const query of ["Brasil", "braz", "BRASÍL"]) {
      expect(countryOptions(catalog, query).map(({ league: item }) => item.id)).toEqual(["bra"]);
    }
    for (const query of ["Estados Unidos", "United States", "USA"]) {
      expect(countryOptions(catalog, query).map(({ league: item }) => item.id)).toEqual(["usa"]);
    }
  });

  it("does not merge the UK's distinct football nations or distinct Congos", () => {
    expect(
      new Set(
        ["England", "Scotland", "Wales", "Northern Ireland", "United Kingdom"].map(countryIdentity),
      ).size,
    ).toBe(5);
    expect(countryIdentity("Congo - Kinshasa")).not.toBe(countryIdentity("Congo - Brazzaville"));
  });

  it.each([
    ["Alemanha", "Germany"],
    ["França", "France"],
    ["Sérvia", "Serbia"],
    ["Vietnã", "Vietnam"],
    ["Turquia", "Turkey"],
    ["Costa do Marfim", "Ivory-Coast"],
    ["Emirados Árabes", "United-Arab-Emirates"],
    ["RD Congo", "DR Congo"],
  ])("matches catalog aliases %s and %s", (first, second) => {
    expect(countryIdentity(first)).toBe(countryIdentity(second));
  });

  it("normalizes whitespace and hyphen variants without dropping unknown country names", () => {
    const choices = countryOptions(
      [
        league("nz", "New-Zealand"),
        league("nz2", "  New Zealand  "),
        league("custom", "Foo Isles"),
      ],
      "",
    );
    expect(choices.map(({ league: item }) => item.id)).toEqual(["custom", "nz"]);
  });
});
