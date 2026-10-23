import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createAthleteSearch, athletePanelSearch } from "./athlete-route-search";

describe("athlete URL search contract", () => {
  it("accepts only the three numeric save slots and falls back for malformed values", () => {
    for (const slot of [1, 2, 3]) {
      expect(createAthleteSearch({ slot })).toEqual({ slot });
      expect(athletePanelSearch({ slot })).toEqual({ slot });
    }
    for (const slot of [undefined, null, "2", "bad", 0, 4, -1, 1.5, NaN, Infinity, {}, []]) {
      expect(createAthleteSearch({ slot, untrusted: true })).toEqual({ slot: 1 });
      expect(athletePanelSearch({ slot, untrusted: true })).toEqual({ slot: 1 });
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
      expect(athletePanelSearch({ slot: 2, tab })).toEqual({ slot: 2, tab });
    }
    expect(athletePanelSearch({})).toEqual({ slot: 1 });
    for (const tab of ["admin", "", null, 1, [], {}]) {
      expect(() => athletePanelSearch({ slot: 2, tab })).toThrow();
    }
    for (const input of [undefined, null, "", [], 2]) {
      expect(() => createAthleteSearch(input)).toThrow();
      expect(() => athletePanelSearch(input)).toThrow();
    }
  });
  it("matches the former Zod schemas across valid, malformed and inherited search values", () => {
    const slot = z.number().int().min(1).max(3).catch(1);
    const formerCreate = z.object({ slot });
    const formerPanel = z.object({
      slot,
      tab: z
        .enum([
          "semana",
          "calendario",
          "saude",
          "atributos",
          "selecao",
          "contrato",
          "noticias",
          "historico",
        ])
        .optional(),
    });
    const values: unknown[] = [
      undefined,
      null,
      true,
      "",
      2,
      [],
      new Date(0),
      new Map(),
      {},
      Object.create({ slot: 2, tab: "saude" }),
    ];
    for (const slotValue of [undefined, null, "2", NaN, Infinity, -1, 0, 1, 1.5, 2, 3, 4, {}, []]) {
      for (const tab of [
        undefined,
        null,
        "semana",
        "historico",
        "saude",
        "contrato",
        "admin",
        "",
        1,
        [],
        {},
      ]) {
        values.push({ slot: slotValue, tab, extra: "must be stripped" });
      }
    }
    for (const input of values) {
      for (const [former, parse] of [
        [formerCreate, createAthleteSearch],
        [formerPanel, athletePanelSearch],
      ] as const) {
        const expected = former.safeParse(input);
        if (expected.success) expect(parse(input)).toEqual(expected.data);
        else expect(() => parse(input)).toThrow();
      }
    }
  });
});
