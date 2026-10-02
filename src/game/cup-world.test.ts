import { describe, expect, it } from "vitest";
import { createCups, playCupStage } from "./cup";
import { initCareer } from "./career";
import { getLeague } from "./data/leagues";
import { CONTINENTAL_NAMES, type Confederation } from "./competition-regulations";
import { primaryCompetitionId } from "./competition-season";
import { worldCupField, CLUB_WORLD_CUP_QUOTA } from "./competition-fields";
import type { CareerState, CompetitionSeasonRecord } from "./types";

const countryLeagues: Record<Confederation, string[]> = {
  UEFA: ["eng", "esp", "ger", "ita", "fra", "por"],
  CONMEBOL: ["bra", "arg", "uru"],
  CONCACAF: ["mex", "usa"],
  CAF: ["egy", "mar"],
  AFC: ["sau", "jpn"],
  OFC: ["nzl"],
};
function qualifiedState(): CareerState {
  const base = initCareer("bra", getLeague("bra").clubs[0]!.id, "Teste");
  const champions: Record<string, string> = {},
    continentalPoints: Record<string, number> = {};
  for (const [confed, leagues] of Object.entries(countryLeagues) as [Confederation, string[]][]) {
    const representatives = leagues.flatMap((id) =>
      getLeague(id)
        .clubs.slice(0, confed === "OFC" ? 1 : 2)
        .map((c) => c.id),
    );
    champions[primaryCompetitionId(confed)] = representatives[0]!;
    representatives.forEach((id, index) => (continentalPoints[id] = 30 - index));
  }
  champions["league:usa"] = getLeague("usa").clubs[3]!.id;
  const competitionHistory: CompetitionSeasonRecord[] = [1, 2, 3].map((season) => ({
    season,
    year: 2025 + season,
    champions,
    continentalPoints,
    tables: {},
  }));
  return { ...base, season: 4, calendarYear: 2029, competitionHistory };
}
describe("copas mundiais por classificação", () => {
  it("Mundial tem 32 clubes únicos, seis confederações, sede e campeão mesmo com usuário eliminado", () => {
    const state = qualifiedState();
    const field = worldCupField(state);
    expect(field).toHaveLength(32);
    expect(new Set(field).size).toBe(32);
    expect(Object.values(CLUB_WORLD_CUP_QUOTA).reduce((a, b) => a + b, 0)).toBe(31);
    expect(CLUB_WORLD_CUP_QUOTA[CONTINENTAL_NAMES.CONCACAF]).toBe(4);
    expect(CLUB_WORLD_CUP_QUOTA[CONTINENTAL_NAMES.OFC]).toBe(1);
    const cup = createCups(state).find((c) => c.id === "club_world_cup")!;
    expect(cup.groups).toHaveLength(8);
    expect(cup.entered).toBe(true);
    let current = cup;
    for (let i = 0; i < 12 && !current.winner; i++) current = playCupStage(current, state).cup;
    expect(current.winner).toBeTruthy();
  });
  it("força de catálogo ou troféu legado isolado não inventam classificação mundial", () => {
    const state = qualifiedState();
    expect(worldCupField({ ...state, competitionHistory: [] })).toEqual([]);
    expect(worldCupField({ ...state, calendarYear: 2028 })).toEqual([]);
    expect(
      createCups({
        ...state,
        competitionHistory: [],
        trophies: [{ season: 3, name: "Copa Libertadores" }],
      }).some((c) => c.id === "intercontinental"),
    ).toBe(false);
  });
  it("Intercontinental usa os seis campeões e entrada europeia apenas na final", () => {
    const state = qualifiedState(),
      initial = createCups(state).find((c) => c.id === "intercontinental")!;
    expect(Object.keys(initial.intercontinentalChampions!)).toHaveLength(6);
    expect(initial.ties).toHaveLength(1);
    let current = initial;
    for (let i = 0; i < 5 && !current.winner; i++) current = playCupStage(current, state).cup;
    expect(current.winner).toBeTruthy();
    const european = initial.intercontinentalChampions!.UEFA!;
    expect(
      current.ties.filter((t) => t.home === european || t.away === european).map((t) => t.round),
    ).toEqual([3]);
  });
});
