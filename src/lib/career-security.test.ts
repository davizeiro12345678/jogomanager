import { describe, expect, it } from "vitest";
import { initCareer } from "@/game/career";
import { LEAGUES } from "@/game/data/leagues";
import { verifyCareerProgress } from "./career.functions";

function fresh() {
  const club = LEAGUES[0]!.clubs[0]!;
  return initCareer(LEAGUES[0]!.id, club.id, "Treinador");
}

describe("official career progress", () => {
  it("recognizes only a fresh, unplayed career", () => {
    const state = fresh();
    expect(verifyCareerProgress(state)).toBe(true);
    expect(verifyCareerProgress({ ...state, round: 2 })).toBe(false);
    expect(verifyCareerProgress({ ...state, results: [{ ...state.fixtures[0]!, hg: 5, ag: 0 }] })).toBe(false);
    expect(verifyCareerProgress({ ...state, trophies: [{ name: "Copa", season: 1 }] })).toBe(false);
    expect(verifyCareerProgress({ ...state, matchLog: [{ gf: 10, ga: 0 }] as typeof state.matchLog })).toBe(false);
    expect(verifyCareerProgress({ ...state, finances: { ...state.finances, budget: 1000 } })).toBe(false);
  });
});