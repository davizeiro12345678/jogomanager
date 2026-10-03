import { describe, expect, it } from "vitest";
import { checkSeasonIntegrity } from "./season-integrity";
import { generateFixtures } from "./season";
import { getLeague } from "./data/leagues";
import { retireChance } from "./regen";
import type { Player, TableRow } from "./types";

describe("checagem de temporada", () => {
  it("calendário gerado é consistente e a tabela correta passa", () => {
    const ids = getLeague("bra").clubs.map((c) => c.id);
    const fixtures = generateFixtures("bra", "seed-1");
    const games = (ids.length - 1) * 2;
    const table: TableRow[] = ids.map((clubId) => ({
      clubId,
      p: games,
      w: games,
      d: 0,
      l: 0,
      gf: 0,
      ga: 0,
      pts: games * 3,
    }));
    expect(checkSeasonIntegrity({ clubIds: ids, fixtures, table })).toEqual([]);
  });
  it("aponta pontos errados, jogos faltando e competição sem campeão", () => {
    const issues = checkSeasonIntegrity({
      clubIds: ["a", "b"],
      fixtures: [],
      table: [{ clubId: "a", p: 1, w: 1, d: 0, l: 0, gf: 1, ga: 0, pts: 1 }],
      cups: [{ name: "Copa", winner: null } as never],
    });
    expect(issues.some((i) => i.includes("pontos"))).toBe(true);
    expect(issues.some((i) => i.includes("jogou"))).toBe(true);
    expect(issues.some((i) => i.includes("sem campeão"))).toBe(true);
  });
});

describe("aposentadoria", () => {
  const p = (age: number, extra: Partial<Player> = {}) =>
    ({ age, pos: "MF", physical: 75, ovr: 75, injuryWeeks: 0, ...extra }) as Player;
  it("jovem não se aposenta, 41 anos sempre", () => {
    expect(retireChance(p(25))).toBe(0);
    expect(retireChance(p(41))).toBe(1);
  });
  it("goleiro dura mais que meia", () => {
    expect(retireChance(p(34, { pos: "GK" }))).toBeLessThan(retireChance(p(34)));
  });
});
