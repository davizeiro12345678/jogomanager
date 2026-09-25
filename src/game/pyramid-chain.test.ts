import { describe, expect, it } from "vitest";
import { LEAGUES } from "./data/leagues";
import { applyPyramid, leagueClubIds, pyramidZones } from "./pyramid";
import type { CareerState, TableRow } from "./types";

const stateFor = (leagueId: string, season = 1, leagueClubs: Record<string, string[]> = {}) => ({
  leagueId, clubId: leagueClubIds({ leagueId, leagueClubs } as CareerState)[0] ?? "",
  leagueClubs, season,
}) as CareerState;
const tableFor = (state: CareerState): TableRow[] =>
  leagueClubIds(state).map((clubId) => ({ clubId }) as TableRow);

describe("pirâmides nacionais", () => {
  it("movimenta toda a cadeia brasileira ao mesmo tempo e preserva os totais", () => {
    const state = stateFor("bra2");
    const move = applyPyramid(state, tableFor(state));
    expect(move?.leagueId).toBe("bra");
    expect(move?.movements.some((m) => m.from === "y5079a" || m.from === "y5079b" || m.from === "y5079c")).toBe(true);
    expect(move?.movements.filter((m) => m.to === "bra3").flatMap((m) => m.promoted)).toHaveLength(4);
    const ids = ["bra", "bra2", "bra3", "y5079a", "y5079b", "y5079c"];
    const all = ids.flatMap((id) => move?.leagueClubs[id] ?? []);
    expect(new Set(all).size).toBe(all.length);
    for (const id of ids) expect(move?.leagueClubs[id]).toHaveLength(leagueClubIds(state, id).length);
  });

  it("mantém clubes e tamanhos por dez temporadas em cada país com pirâmide", () => {
    const representativeIds = ["bra", "eng", "esp", "ita", "ger", "fra", "por", "arg", "pol", "jpn", "kor"];
    for (const leagueId of representativeIds) {
      let state = stateFor(leagueId);
      const country = LEAGUES.find((l) => l.id === leagueId)?.country;
      const original = LEAGUES.filter((l) => l.country === country).flatMap((l) => l.clubs.map((c) => c.id));
      for (let season = 1; season <= 10; season++) {
        const move = applyPyramid(state, tableFor(state));
        expect(move, `${leagueId} temporada ${season}`).not.toBeNull();
        const next = { ...state, season: season + 1, clubId: state.clubId,
          leagueId: move?.leagueId ?? state.leagueId,
          leagueClubs: { ...state.leagueClubs, ...move?.leagueClubs } };
        const all = LEAGUES.filter((l) => l.country === country)
          .flatMap((l) => leagueClubIds(next, l.id));
        expect(all.length).toBe(original.length);
        expect(new Set(all).size).toBe(all.length);
        for (const l of LEAGUES.filter((l) => l.country === country))
          expect(leagueClubIds(next, l.id).length).toBe(l.clubs.length);
        state = next;
      }
    }
  });

  it("marca acesso e queda na divisão intermediária e suporta saves sem composição própria", () => {
    const state = stateFor("bra2");
    const zones = pyramidZones("bra2", leagueClubIds(state).length);
    expect(zones.slice(0, 4)).toEqual(Array(4).fill("acesso"));
    expect(zones.slice(-4)).toEqual(Array(4).fill("rebaixamento"));
    expect(applyPyramid(state, tableFor(state))?.leagueClubs["bra3"]).toBeDefined();
  });
});
