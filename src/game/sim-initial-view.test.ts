import { describe, expect, it } from "vitest";
import { initialMatchSnapshot } from "./sim-initial-view";
import { MatchSim } from "./sim";
import { snapshotMatch } from "./live-match";
import { buildTeamSetup } from "./quickMatch";

describe("lightweight initial match view", () => {
  it("matches engine kickoff data without loading or stepping an engine in the UI", () => {
    for (const seed of ["initial-view", "other-referee", "rain-view"]) {
      const home = buildTeamSetup("fla"),
        away = buildTeamSetup("pal");
      const sim = new MatchSim(home, away, seed, { weather: "rain" });
      try {
        const initial = initialMatchSnapshot(home, away, seed, "rain");
        const canonical = snapshotMatch(sim, 0);
        for (const key of [
          "time",
          "clock",
          "phase",
          "weather",
          "wind",
          "refName",
          "players",
          "ball",
          "possession",
          "stats",
          "events",
          "eventSeq",
          "finished",
          "subsUsed",
        ] as const) {
          expect(initial[key], `${seed}: ${key}`).toEqual(canonical[key]);
        }
      } finally {
        sim.dispose();
      }
    }
  });
});
