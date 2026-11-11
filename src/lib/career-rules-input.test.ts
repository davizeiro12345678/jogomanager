import { describe, expect, it } from "vitest";
import { parseCareerInput } from "./career-input";

const state = {
  leagueId: "bra",
  clubId: "fla",
  managerName: "Rules audit",
  season: 1,
  round: 1,
  fixtures: [],
  results: [],
};

describe("untrusted career match rules selection", () => {
  it("preserves a missing legacy version and explicit supported revisions", () => {
    expect(parseCareerInput({ state }).state).not.toHaveProperty("matchRulesRevision");
    for (const matchRulesRevision of [1, 2])
      expect(
        parseCareerInput({ state: { ...state, matchRulesRevision } }).state.matchRulesRevision,
      ).toBe(matchRulesRevision);
  });
  it.each([0, 3, null, "2", -1])(
    "rejects unsupported persisted version %s",
    (matchRulesRevision) => {
      expect(() => parseCareerInput({ state: { ...state, matchRulesRevision } })).toThrow();
    },
  );
});
