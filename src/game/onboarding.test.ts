import { describe, expect, it } from "vitest";
import { initCareer } from "./career";
import { LEAGUES } from "./data/leagues";
import { onboardingProgress } from "./onboarding";

const league = LEAGUES[0]!;
const fresh = () => initCareer(league.id, league.clubs[0]!.id, "Teste");

describe("guided onboarding to the first match", () => {
  it("starts with the club chosen and the squad as the next step", () => {
    const progress = onboardingProgress(fresh(), new Set());
    expect(progress.steps.map((s) => s.id)).toEqual([
      "club",
      "squad",
      "lineup",
      "tactics",
      "prematch",
      "match",
    ]);
    expect(progress.steps[0]!.done).toBe(true);
    expect(progress.next?.id).toBe("squad");
  });
  it("advances as the manager visits squad, tactics and pre-match", () => {
    const progress = onboardingProgress(fresh(), new Set(["squad", "tactics", "prematch"]));
    expect(progress.next?.id).toBe("match");
    expect(progress.complete).toBe(false);
  });
  it("asks to fix the lineup when a starter is injured", () => {
    const career = fresh();
    const first = career.lineup[0]!;
    career.players[first] = { ...career.players[first]!, injuryWeeks: 2 };
    const lineup = onboardingProgress(career, new Set(["squad"])).steps.find(
      (s) => s.id === "lineup",
    )!;
    expect(lineup.done).toBe(false);
    expect(lineup.hint).toContain("Só 10");
  });
  it("retires itself once the first match is played", () => {
    const career = fresh();
    const progress = onboardingProgress({ ...career, matchLog: [{} as never] }, new Set());
    expect(progress.complete).toBe(true);
    expect(progress.next).toBeNull();
  });
});
