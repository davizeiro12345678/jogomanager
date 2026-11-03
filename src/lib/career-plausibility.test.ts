import { describe, expect, it } from "vitest";
import { plausibilityIssues } from "./career-plausibility";

const base = {
  season: 1,
  clubId: "fla",
  results: [] as { home: string; away: string; hg: number; ag: number }[],
  trophies: [] as unknown[],
  finances: { budget: 50 },
  matchLog: [] as { gf: number; ga: number }[],
};
const s = (over: Partial<typeof base>) => ({ ...base, ...over }) as never;

describe("career plausibility limits", () => {
  it("accepts an ordinary save", () => {
    expect(plausibilityIssues(null, s({}), null)).toEqual([]);
  });
  it("flags more than 15 goals in a match and a budget above 5000M", () => {
    expect(plausibilityIssues(null, s({ matchLog: [{ gf: 16, ga: 0 }] }), null)).toContain("goals");
    expect(plausibilityIssues(null, s({ finances: { budget: 5001 } }), null)).toContain("budget");
  });
  it("flags more than 6 trophies per season", () => {
    expect(plausibilityIssues(null, s({ trophies: Array(7).fill({}) }), null)).toContain(
      "trophies",
    );
  });
  it("flags a season finished in under 2 minutes", () => {
    expect(plausibilityIssues(s({ season: 1 }), s({ season: 2 }), 60_000)).toContain("season_pace");
    expect(plausibilityIssues(s({ season: 1 }), s({ season: 2 }), 180_000)).not.toContain(
      "season_pace",
    );
  });
});
