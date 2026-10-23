import { describe, expect, it } from "vitest";
import { z } from "zod";
import { athletePanelSearch, athleteSlot } from "./athlete-search";

// Compare against the shipped schema so shrinking the eager route code cannot
// silently change old URLs, fallback slots, optional tabs or invalid-tab errors.
const original = z.object({
  slot: z.number().int().min(1).max(3).catch(1),
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

describe("athlete URL compatibility", () => {
  it("preserves slot fallback and strips unrelated search fields", () => {
    for (const slot of [undefined, null, "2", 0, 1, 2, 3, 4, -1, 1.5, NaN, Infinity, {}, true]) {
      const input = { slot, unexpected: "discard" };
      const expected = original.parse(input);
      expect(athleteSlot(input)).toBe(expected.slot);
      expect(athletePanelSearch(input)).toEqual(expected);
    }
  });
  it("accepts the same tabs and rejects invalid tabs instead of trusting the URL", () => {
    for (const tab of [
      undefined,
      "semana",
      "calendario",
      "saude",
      "atributos",
      "selecao",
      "contrato",
      "noticias",
      "historico",
      "unknown",
      "",
      null,
      1,
      [],
    ]) {
      const input = { slot: 2, tab };
      const expected = original.safeParse(input);
      if (expected.success) expect(athletePanelSearch(input)).toEqual(expected.data);
      else expect(() => athletePanelSearch(input)).toThrow();
    }
  });
});
