import { describe, expect, it } from "vitest";
import { z } from "zod";
import { athletePanelSearch, athleteSlotSearch } from "./athlete-search";

// Compare with the previous schemas so bundle work cannot loosen URL validation.
const previousSlot = z.object({ slot: z.number().int().min(1).max(3).catch(1) });
const previousPanel = previousSlot.extend({
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

describe("lightweight athlete URL validation", () => {
  it("preserves slot bounds, strict number types, defaults and stripping", () => {
    for (const slot of [undefined, null, 0, 1, 2, 3, 4, -1, 1.5, NaN, Infinity, "2", {}, true]) {
      const search = { slot, ignored: "extra" };
      expect(athleteSlotSearch(search)).toEqual(previousSlot.parse(search));
    }
  });

  it("preserves all accepted tabs and rejects malformed tab values", () => {
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
      ["semana"],
      {},
    ]) {
      const search = { slot: 2, tab, ignored: "extra" };
      const previous = previousPanel.safeParse(search);
      if (previous.success) expect(athletePanelSearch(search)).toEqual(previous.data);
      else expect(() => athletePanelSearch(search)).toThrow();
    }
  });
});
