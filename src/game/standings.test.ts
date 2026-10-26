import { describe, expect, it } from "vitest";
import { rankTable, tableFromFixtures } from "./standings";
import type { Fixture, TableRow } from "./types";

describe("standings aggregation and ranking", () => {
  it("counts both appearances when a fixture refers to the same club", () => {
    const match: Fixture = { round: 1, home: "a", away: "a", homeGoals: 3, awayGoals: 1 };
    expect(tableFromFixtures(["a", "a"], [match], "Brasil")).toEqual([
      { clubId: "a", p: 2, w: 1, d: 0, l: 1, gf: 4, ga: 4, pts: 3 },
    ]);
    expect(tableFromFixtures(["a"], [{ ...match, awayGoals: 3 }], "Brasil")[0]).toMatchObject({
      p: 2,
      w: 0,
      d: 2,
      l: 0,
      pts: 2,
    });
  });

  it("ranks actual ties without changing the source order or row statistics", () => {
    const row = (clubId: string, pts: number, wins: number): TableRow =>
      Object.freeze({ clubId, p: 3, w: wins, d: 0, l: 0, gf: 4, ga: 2, pts });
    const rows = [row("b", 6, 1), row("c", 9, 3), row("a", 6, 2), row("d", 0, 0)];
    const before = structuredClone(rows);
    expect(rankTable(rows, [], "Brasil").map((r) => r.clubId)).toEqual(["c", "a", "b", "d"]);
    expect(rows).toEqual(before);
  });
});
