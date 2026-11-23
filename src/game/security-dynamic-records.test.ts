import { describe, expect, it } from "vitest";

import { initCareer } from "./career";
import { seasonCompetitionRecord } from "./competition-season";
import { buildTeamSetup } from "./quickMatch";
import { MatchSim } from "./sim";

describe("game input boundary prototype and enum guards", () => {
  it("keeps continental points on a null-prototype dictionary", () => {
    const state = initCareer("bra", "fla", "CodeQL security regression");
    const record = seasonCompetitionRecord(state, {}, [], null, []);
    expect(Object.getPrototypeOf(record.continentalPoints)).toBeNull();
  });

  it("ignores invalid post-serialization team and talk values", () => {
    const sim = new MatchSim(
      buildTeamSetup("fla"),
      buildTeamSetup("pal"),
      "team-talk-enum-guard",
    );
    try {
      expect(sim.applyTeamTalk("__proto__" as never, "motivar")).toBe(false);
      expect(sim.applyTeamTalk("home", "__proto__" as never)).toBe(false);
      expect(sim.applyTeamTalk("home", "motivar")).toBe(true);
      expect(sim.applyTeamTalk("home", "motivar")).toBe(false);
    } finally {
      sim.dispose();
    }
  });
});
