import { describe, expect, it } from "vitest";
import { initCareer } from "./career";
import { LEAGUES } from "./data/leagues";
import { CAREER_SERVICES } from "@/lib/wallet-rules";
import {
  applyPremiumScout,
  applyTrainingUpgrade,
  canUpgradeTraining,
  premiumScoutCandidates,
  trainingUpgradeMultiplier,
} from "./coin-services-training";
const fresh = () => {
  const league = LEAGUES[0];
  const club = league?.clubs[0];
  if (!league || !club) throw new Error("Fixture missing");
  return initCareer(league.id, club.id, "Test");
};
describe("training and individual scout services", () => {
  it("prices training at 150 coins with five weekly uses", () =>
    expect(CAREER_SERVICES.training_upgrade).toEqual({ cost: 150, weeklyLimit: 5 }));
  it("prices scouting at 120 coins with seven weekly uses", () =>
    expect(CAREER_SERVICES.premium_scout).toEqual({ cost: 120, weeklyLimit: 7 }));
  it("adds 50% only in the purchased round without stacking", () => {
    const career = applyTrainingUpgrade(fresh());
    expect(trainingUpgradeMultiplier(career)).toBe(1.5);
    expect(canUpgradeTraining(career)).toBe(false);
    expect(trainingUpgradeMultiplier({ ...career, round: career.round + 1 })).toBe(1);
  });
  it("does not sell an upgrade after the round exercise", () => {
    const career = fresh();
    expect(
      canUpgradeTraining({
        ...career,
        drillsByRound: { [`${career.season}-${career.round}`]: "posse" },
      }),
    ).toBe(false);
  });
  it("reveals exactly one existing opponent with no duplicate", () => {
    const career = fresh();
    const target = premiumScoutCandidates(career)[0];
    if (!target) throw new Error("Expected opponent");
    const next = applyPremiumScout(career, target.id);
    expect(next.scoutReports.length).toBe(career.scoutReports.length + 1);
    expect(next.scoutReports[0]?.ovr).toBe(target.ovr);
    expect(applyPremiumScout(next, target.id)).toBe(next);
  });
});
