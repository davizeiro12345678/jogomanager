import { describe, expect, it } from "vitest";
import { parseCareerInput } from "./career-input";

describe("career manager name", () => {
  it("removes Unicode control and direction-format characters before saving", () => {
    const input = {
      state: {
        leagueId: "league",
        clubId: "club",
        managerName: "João\u202e Silva\u0085",
        season: 1,
        round: 1,
        fixtures: [],
        results: [],
      },
    };

    expect(parseCareerInput(input).state.managerName).toBe("João Silva");
  });
});
