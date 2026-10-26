import { describe, expect, it } from "vitest";
import {
  careerLeagueOptions,
  discoverClubs,
  isCareerCompetition,
  requiredReputation,
} from "./club-discovery";
import type { League } from "./types";

const leagues: League[] = [
  {
    id: "br",
    name: "Brasileirão",
    country: "Brasil",
    flag: "BR",
    clubs: [
      {
        id: "sao",
        name: "São Paulo",
        short: "SAO",
        league: "br",
        strength: 81,
        primary: "#f00",
        secondary: "#fff",
      },
      {
        id: "fla",
        name: "Flamengo",
        short: "FLA",
        league: "br",
        strength: 88,
        primary: "#f00",
        secondary: "#000",
      },
    ],
  },
  {
    id: "pt",
    name: "Primeira Liga",
    country: "Portugal",
    flag: "PT",
    clubs: [
      {
        id: "por",
        name: "Porto",
        short: "POR",
        league: "pt",
        strength: 84,
        primary: "#00f",
        secondary: "#fff",
      },
    ],
  },
];
const base = { query: "", leagueId: "br", reputation: 3 };
describe("career club discovery", () => {
  it("finds a club outside the currently selected league and keeps its correct league", () => {
    expect(
      discoverClubs(leagues, { ...base, query: "portugal" }).map((r) => [r.club.id, r.league.id]),
    ).toEqual([["por", "pt"]]);
  });
  it("matches names without accents, tokens and short names", () => {
    expect(discoverClubs(leagues, { ...base, query: "sao brasil" }).map((r) => r.club.id)).toEqual([
      "sao",
    ]);
  });
  it("limits unfiltered browsing to the league and preserves the reputation gate", () => {
    const rows = discoverClubs(leagues, base);
    expect(rows.map((r) => r.club.id)).toEqual(["sao", "fla"]);
    expect(rows.map((r) => r.locked)).toEqual([false, true]);
    expect(requiredReputation(88)).toBe(4);
    expect(requiredReputation(96)).toBe(5);
    expect(discoverClubs(leagues, { ...base, availableOnly: true })).toHaveLength(1);
  });
  it("combines an explicit search scope and challenge without returning stale clubs", () => {
    expect(discoverClubs(leagues, { ...base, query: "Porto", scopeSearch: true })).toEqual([]);
    expect(discoverClubs(leagues, { ...base, challenge: "underdog" })).toEqual([]);
    expect(discoverClubs(leagues, { ...base, challenge: "build" }).map((r) => r.club.id)).toEqual([
      "sao",
    ]);
  });
  it("keeps cups and continental competitions out of new career searches", () => {
    const cup = { ...leagues[0]!, id: "cup", name: "Copa do Brasil" };
    const continental = { ...leagues[0]!, id: "continental", name: "Champions League" };
    expect(isCareerCompetition(cup)).toBe(false);
    expect(isCareerCompetition(continental)).toBe(false);
    expect(discoverClubs([cup, continental], { ...base, query: "sao" })).toEqual([]);
  });
  it("searches large catalogs while retaining the selected league option", () => {
    const playableClubs = Array.from({ length: 6 }, (_, i) => ({
      ...leagues[0]!.clubs[0]!,
      id: `club-${i}`,
    }));
    const large = Array.from({ length: 50 }, (_, i) => ({
      ...leagues[0]!,
      id: `league-${i}`,
      name: i === 49 ? "Brasileirão Série B" : `Liga ${i}`,
      clubs: playableClubs,
    }));
    const options = careerLeagueOptions(large, "serie b", "league-0", 10);
    expect(options.map((league) => league.id)).toEqual(["league-49", "league-0"]);
    expect(careerLeagueOptions(large).length).toBe(40);
    expect(careerLeagueOptions(large, "serie b", "league-0", 1)).toEqual([large[0]]);
    expect(careerLeagueOptions(large, "sem correspondência", "league-0", 10, false)).toEqual([]);
  });
});
