import { describe, expect, it } from "vitest";
import { SERIE_D_IDS } from "./data/serie-d";
import { LEAGUES } from "./data/leagues";
import { applyPyramid, leagueClubIds, pyramidZones, pyramidTiers } from "./pyramid";
import type { CareerState, TableRow } from "./types";

const stateFor = (leagueId: string, season = 1, leagueClubs: Record<string, string[]> = {}) =>
  ({
    leagueId,
    clubId: leagueClubIds({ leagueId, leagueClubs } as CareerState)[0] ?? "",
    leagueClubs,
    season,
  }) as CareerState;
const tableFor = (state: CareerState): TableRow[] =>
  leagueClubIds(state).map((clubId) => ({ clubId }) as TableRow);

describe("pirâmides nacionais", () => {
  it("movimenta toda a cadeia brasileira ao mesmo tempo e preserva os totais", () => {
    const state = stateFor("bra2");
    const move = applyPyramid(state, tableFor(state));
    expect(move?.leagueId).toBe("bra");
    expect(move?.movements.some((m) => SERIE_D_IDS.includes(m.from))).toBe(true);
    expect(move?.movements.filter((m) => m.to === "bra3").flatMap((m) => m.promoted)).toHaveLength(
      6,
    );
    const ids = ["bra", "bra2", "bra3", ...SERIE_D_IDS];
    const all = ids.flatMap((id) => move?.leagueClubs[id] ?? []);
    expect(new Set(all).size).toBe(all.length);
    expect(move?.leagueClubs["bra"]).toHaveLength(20);
    expect(move?.leagueClubs["bra2"]).toHaveLength(20);
    expect(move?.leagueClubs["bra3"]).toHaveLength(24);
    expect(all.length).toBe(ids.flatMap((id) => leagueClubIds(state, id)).length);
  });

  it("mantém clubes e tamanhos por dez temporadas em cada país com pirâmide", () => {
    const representativeIds = [
      "bra",
      "eng",
      "esp",
      "ita",
      "ger",
      "fra",
      "por",
      "arg",
      "pol",
      "jpn",
      "kor",
    ];
    for (const leagueId of representativeIds) {
      let state = stateFor(leagueId);
      const country = LEAGUES.find((l) => l.id === leagueId)?.country;
      const original = LEAGUES.filter((l) => pyramidTiers(leagueId)?.flat().includes(l.id)).flatMap(
        (l) => l.clubs.map((c) => c.id),
      );
      for (let season = 1; season <= 10; season++) {
        const move = applyPyramid(state, tableFor(state));
        expect(move, `${leagueId} temporada ${season}`).not.toBeNull();
        const next = {
          ...state,
          season: season + 1,
          clubId: state.clubId,
          leagueId: move?.leagueId ?? state.leagueId,
          leagueClubs: { ...state.leagueClubs, ...move?.leagueClubs },
        };
        const all = LEAGUES.filter((l) => pyramidTiers(leagueId)?.flat().includes(l.id)).flatMap(
          (l) => leagueClubIds(next, l.id),
        );
        expect(all.length).toBe(original.length);
        expect(new Set(all).size).toBe(all.length);
        for (const l of LEAGUES.filter((l) => pyramidTiers(leagueId)?.flat().includes(l.id)))
          if (leagueId !== "bra" || !["bra3", ...SERIE_D_IDS].includes(l.id))
            expect(leagueClubIds(next, l.id).length).toBe(l.clubs.length);
        state = next;
      }
    }
  });

  it("marca acesso e queda na divisão intermediária e suporta saves sem composição própria", () => {
    const state = stateFor("bra2");
    const zones = pyramidZones("bra2", leagueClubIds(state).length);
    expect(zones.slice(0, 2)).toEqual(Array(2).fill("acesso"));
    expect(zones.slice(2, 6)).toEqual(Array(4).fill("playoff"));
    expect(zones.slice(-4)).toEqual(Array(4).fill("rebaixamento"));
    expect(applyPyramid(state, tableFor(state))?.leagueClubs["bra3"]).toBeDefined();
    const regionalTotal = SERIE_D_IDS.reduce(
      (sum, id) =>
        sum +
        pyramidZones(id, leagueClubIds(state, id).length, undefined, 1).filter(
          (zone) => zone === "playoff",
        ).length,
      0,
    );
    expect(regionalTotal).toBe(64);
  });
});
