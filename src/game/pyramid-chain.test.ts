import { describe, expect, it } from "vitest";
import { applyPyramid, leagueClubIds, PYRAMID } from "./pyramid";
import type { CareerState, TableRow } from "./types";

describe("pirâmide em cadeia", () => {
  it("Série B sobe 4 e desce 4 ao mesmo tempo, sem duplicar clubes", () => {
    expect(PYRAMID["bra2"]).toBe("bra3");
    const base = { leagueId: "bra2", clubId: "", leagueClubs: {} } as unknown as CareerState;
    const ids = leagueClubIds(base, "bra2");
    const state = { ...base, clubId: ids[0]! } as CareerState;
    const table = ids.map((clubId) => ({ clubId }) as TableRow);
    const move = applyPyramid(state, table)!;
    expect(move.moved).toBe("subiu");
    expect(move.leagueId).toBe("bra");
    const all = ["bra", "bra2", "bra3"].flatMap((l) => move.leagueClubs[l] ?? []);
    expect(new Set(all).size).toBe(all.length);
    expect(move.leagueClubs["bra2"]!.length).toBe(ids.length);
    expect(move.leagueClubs["bra2"]).not.toContain(ids[ids.length - 1]);
  });
});
