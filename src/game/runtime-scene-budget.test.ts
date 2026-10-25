import { describe, expect, it } from "vitest";

import { resolveRuntimeSceneBudget } from "./runtime-scene-budget";

describe("RuntimeSceneBudget", () => {
  it("keeps mobile background work bounded even when a high tier is requested", () => {
    for (const tier of ["baixa", "media", "alta", "cinema"] as const) {
      const initial = resolveRuntimeSceneBudget(tier, 0, true);
      for (let stage = 0; stage <= 8; stage++) {
        const budget = resolveRuntimeSceneBudget(tier, stage, true);
        expect(budget.heroPlayers).toBeLessThanOrEqual(tier === "baixa" ? 0 : 1);
        expect(budget.crowdInstances).toBeLessThanOrEqual(tier === "baixa" ? 512 : 1024);
        expect(budget.grassChunks).toBeLessThanOrEqual(6);
        expect(budget.crowdInstances).toBeLessThanOrEqual(initial.crowdInstances);
        expect(budget.shadows).toBe(false);
        expect(budget.post).toBe("off");
      }
    }
  });
  it("keeps High crowd and near-player work inside the planned first-stage budget", () => {
    const high = resolveRuntimeSceneBudget("alta");
    expect(high.crowdInstances).toBe(4_096);
    expect(high.crowdVisibleTiles).toBe(18);
    expect(high.heroPlayers).toBe(6);
    expect(high.replayHeroPlayers).toBe(10);
    expect(high.post).toBe("balanced");
  });

  it("degrades full scene work in a stable order and protects close players until last", () => {
    const initial = resolveRuntimeSceneBudget("alta", 0);
    const grass = resolveRuntimeSceneBudget("alta", 3);
    const crowd = resolveRuntimeSceneBudget("alta", 5);
    const emergency = resolveRuntimeSceneBudget("alta", 8);

    expect(grass.grassDensity).toBeLessThan(initial.grassDensity);
    expect(crowd.crowdInstances).toBeLessThan(initial.crowdInstances);
    expect(crowd.heroPlayers).toBe(initial.heroPlayers);
    expect(emergency.heroPlayers).toBeLessThan(initial.heroPlayers);
    expect(emergency.post).toBe("off");
  });

  it("clamps invalid pressure stages", () => {
    expect(resolveRuntimeSceneBudget("media", -4).stage).toBe(0);
    expect(resolveRuntimeSceneBudget("media", 99).stage).toBe(8);
    expect(resolveRuntimeSceneBudget("media", Number.NaN).stage).toBe(0);
  });
  it("sheds lens work and pixels before close athlete anatomy", () => {
    const base = resolveRuntimeSceneBudget("alta");
    const pressure = resolveRuntimeSceneBudget("alta", 2);
    expect(pressure.post).toBe("off");
    expect(pressure.resolutionScale).toBeLessThan(base.resolutionScale);
    expect(pressure.heroPlayers).toBe(base.heroPlayers);
    expect(pressure.goalFxDensity).toBeLessThan(base.goalFxDensity);
  });
});
