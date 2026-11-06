import { describe, expect, it } from "vitest";
import { playerGuideProgress } from "./guide-progress";

const season = {
  season: 1,
  age: 18,
  clubId: "club",
  apps: 0,
  starts: 0,
  goals: 0,
  assists: 0,
  ratingSum: 0,
  motm: 0,
};
describe("player guidance follows played progress", () => {
  it("does not complete a new career without committed reports", () => {
    expect(
      playerGuideProgress({ lastMatch: null, recent: [], current: season, history: [] }).completed,
    ).toBe(0);
  });
  it("recognizes appearances from previous seasons after a season rollover", () => {
    expect(
      playerGuideProgress({
        lastMatch: null,
        recent: [],
        current: season,
        history: [{ ...season, apps: 1 }],
      }),
    ).toMatchObject({ weekPlayed: true, appeared: true, completed: 2 });
  });
});
