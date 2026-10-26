import { describe, expect, it } from "vitest";
import { initCareer } from "@/game/career";
import { LEAGUES } from "@/game/data/leagues";
import { evaluateServerAchievements } from "./achievement-verification";
import { verifyCareerProgress } from "./career-verification";

function fresh() {
  const league = LEAGUES[0]!;
  return initCareer(league.id, league.clubs[0]!.id, "Treinador");
}

describe("server achievement trust boundary", () => {
  it("requires the literal server verification flag", () => {
    for (const flag of [false, null, undefined, 1, "true", {}, []]) {
      expect(evaluateServerAchievements(fresh(), flag)).toEqual([]);
    }
  });
  it("does not award client records, players, manager history or ids", () => {
    const state = fresh();
    const forged = {
      ...state,
      achievements: ["primeira-vitoria", "campeao-liga"],
      records: { promotions: 99, biggestSigning: 1000 },
      pressure: 99,
      players: {},
      managerHistory: [{ clubId: state.clubId }, { clubId: state.clubId }],
    };
    expect(evaluateServerAchievements(forged, true)).toEqual(
      evaluateServerAchievements(state, true),
    );
    expect(evaluateServerAchievements(forged, true)).not.toContain("primeira-vitoria");
    expect(evaluateServerAchievements(forged, true)).not.toContain("acesso-elite");
  });
  it("fails closed for progressed, duplicate-fixture and malformed saves", () => {
    const state = fresh();
    const duplicate = structuredClone(state);
    duplicate.fixtures[1] = duplicate.fixtures[0]!;
    for (const value of [
      null,
      [],
      {},
      { ...state, round: 2 },
      { ...state, results: [{ hg: 9, ag: 0 }] },
      { ...state, trophies: [{ name: "Liga", season: 1 }] },
      duplicate,
      { ...state, finances: { ...state.finances, budget: Infinity } },
    ]) {
      expect(verifyCareerProgress(value)).toBe(false);
      expect(evaluateServerAchievements(value, true)).toEqual([]);
    }
  });
  it("rejects prototype keys and cyclic objects without throwing", () => {
    const state = fresh();
    const cyclic = { ...state, extra: {} as unknown };
    cyclic.extra = cyclic;
    expect(evaluateServerAchievements(cyclic, true)).toEqual([]);
    const polluted = JSON.parse(
      JSON.stringify(state).replace('"season":1', '"__proto__":{"admin":true},"season":1'),
    );
    expect(evaluateServerAchievements(polluted, true)).toEqual([]);
  });
});
