import { describe, expect, it } from "vitest";
import { createAthleteSearch, athletePanelSearch } from "./athlete-route-search";

describe("athlete URL search contract", () => {
  it("accepts only the three numeric save slots and falls back for malformed values", () => {
    for (const slot of [1, 2, 3]) {
      expect(createAthleteSearch.parse({ slot })).toEqual({ slot });
      expect(athletePanelSearch.parse({ slot })).toEqual({ slot });
    }
    for (const slot of [undefined, null, "2", "bad", 0, 4, -1, 1.5, NaN, Infinity, {}, []]) {
      expect(createAthleteSearch.parse({ slot, untrusted: true })).toEqual({ slot: 1 });
      expect(athletePanelSearch.parse({ slot, untrusted: true })).toEqual({ slot: 1 });
    }
  });
  it("preserves optional panel tabs and rejects unknown or non-string tabs", () => {
    for (const tab of [
      "semana",
      "calendario",
      "saude",
      "atributos",
      "selecao",
      "contrato",
      "noticias",
      "historico",
    ]) {
      expect(athletePanelSearch.parse({ slot: 2, tab })).toEqual({ slot: 2, tab });
    }
    expect(athletePanelSearch.parse({})).toEqual({ slot: 1 });
    for (const tab of ["admin", "", null, 1, [], {}]) {
      expect(athletePanelSearch.safeParse({ slot: 2, tab }).success).toBe(false);
    }
    for (const input of [undefined, null, "", [], 2]) {
      expect(createAthleteSearch.safeParse(input).success).toBe(false);
      expect(athletePanelSearch.safeParse(input).success).toBe(false);
    }
  });
});
