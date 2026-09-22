import { describe, expect, it } from "vitest";

import { resolveRuntimeSceneBudget } from "./runtime-scene-budget";

describe("RuntimeSceneBudget", () => {
  it("keeps High crowd and near-player work inside the planned first-stage budget", () => {
    const high = resolveRuntimeSceneBudget("alta");
    expect(high.crowdInstances).toBe(4_096);
    expect(high.crowdVisibleTiles).toBe(18);
    expect(high.heroPlayers).toBe(2);
    expect(high.replayHeroPlayers).toBe(4);
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
  });
});
