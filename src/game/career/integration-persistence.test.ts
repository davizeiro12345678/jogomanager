import { describe, expect, it } from "vitest";
import { advanceRound, initCareer } from "../career";
import { CLUBS } from "../data/leagues";
import { activateAdvanced } from "../tactical-plan";
import { runDrill, DRILLS } from "../training-drills";
import { appendMatchAnalytics, type CareerMatchAnalytics } from "../match-analytics";
import { exportCareerFile, importCareerFile } from "../contracts/career-transfer";
import { repairCareer } from "../career-repair";

const fresh = () => initCareer(CLUBS["fla"]!.league, "fla", "Persistência");
describe("integrated tactical learning and backup persistence", () => {
  it("learns from the played round without changing main development or finance algorithms", () => {
    const legacy = fresh();
    const advanced = { ...legacy, tactics: activateAdvanced(legacy.tactics) };
    const timestamp = 1_800_000_000_000;
    const before = advanced.tactics.advanced!.familiarity.team;
    const next = advanceRound(advanced, { hg: 1, ag: 0 }, [], "Liga", timestamp);
    const unchangedRules = advanceRound(legacy, { hg: 1, ag: 0 }, [], "Liga", timestamp);
    expect(next.tactics.advanced!.familiarity.team).toBe(before + 1);
    expect(next.tactics.advanced!.familiarity.played).toHaveLength(1);
    expect(unchangedRules.tactics.advanced).toBeUndefined();
    expect(next.players).toEqual(unchangedRules.players);
    expect(next.finances).toEqual(unchangedRules.finances);
    expect(next.attrDeltas).toEqual(unchangedRules.attrDeltas);
  });
  it("persists measured reports and training familiarity through the actual backup importer", () => {
    const legacy = fresh();
    const advanced = { ...legacy, tactics: activateAdvanced(legacy.tactics) };
    const trained = runDrill(advanced, DRILLS[0]!.id);
    const legacyTraining = runDrill(legacy, DRILLS[0]!.id);
    expect(trained.tactics.advanced!.familiarity.team).toBe(53);
    expect(trained.players).toEqual(legacyTraining.players);
    expect(runDrill(trained, DRILLS[0]!.id)).toBe(trained);
    const fixture = trained.fixtures.find(
      (f) => f.home === trained.clubId || f.away === trained.clubId,
    )!;
    const entry: CareerMatchAnalytics = {
      id: `${trained.season}:${trained.round}:${fixture.home}:${fixture.away}`,
      season: trained.season,
      round: trained.round,
      home: fixture.home,
      away: fixture.away,
      source: "spatial",
      score: [2, 1],
      xg: [1.75, 0.8],
      possession: [55, 45],
      passes: [167, 142],
      changes: [],
    };
    const measured = appendMatchAnalytics(appendMatchAnalytics(trained, entry), entry);
    expect(measured.matchAnalytics).toHaveLength(1);
    const restored = importCareerFile(exportCareerFile(measured));
    expect(restored.matchAnalytics).toEqual([entry]);
    expect(restored.tactics.advanced).toEqual(trained.tactics.advanced);
  });
  it("repairs malformed analytics and invalid advanced programs from untrusted saves", () => {
    const state = fresh();
    const repaired = repairCareer({
      ...state,
      tactics: { ...state.tactics, advanced: { version: 99 } as never },
      matchAnalytics: [{ id: "untrusted" } as never],
    });
    expect(repaired.state.tactics.advanced).toBeUndefined();
    expect(repaired.state.tactics.formation).toBe(state.tactics.formation);
    expect(repaired.state.matchAnalytics).toEqual([]);
    expect(repaired.fixes.length).toBeGreaterThan(0);
  });
});
