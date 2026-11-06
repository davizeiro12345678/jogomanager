import { describe, expect, it } from "vitest";
import { initCareer } from "./career";
import { applyWeekAction } from "./season-mode";
import { coachResults, summarizeCoachSquad } from "./coach-office";

describe("coach office preserves career decisions", () => {
  it("previews exactly the existing week effect without changing the save", () => {
    const career = initCareer("bra", "fla", "Preview");
    const before = structuredClone(career);
    const prepared = applyWeekAction(career, "descanso");
    const player = Object.values(career.players).find((entry) => entry.clubId === career.clubId);
    if (!player) throw new Error("missing squad");
    expect(prepared.players[player.id]?.condition).toBe(Math.min(100, player.condition + 9));
    expect(career).toEqual(before);
    expect(summarizeCoachSquad(career).players.length).toBeGreaterThan(10);
  });
  it("keeps persisted results after reopening and excludes a previous club", () => {
    const career = initCareer("bra", "fla", "Results");
    const result = {
      season: 1,
      round: 1,
      clubId: "fla",
      comp: "Liga",
      opponentId: "pal",
      home: true,
      gf: 2,
      ga: 1,
      players: [],
    };
    career.matchLog = [result, { ...result, clubId: "cor" }];
    expect(coachResults(structuredClone(career))).toEqual([result]);
  });
});
