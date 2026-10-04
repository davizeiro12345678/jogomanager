import { describe, expect, it } from "vitest";

import { HIGH_FIDELITY_PHYSICS_HZ, highFidelitySubsteps } from "./physics-quality";

describe("high-fidelity physics timing", () => {
  it("keeps the 30 Hz live tick at or below a 139 Hz physical substep", () => {
    const elapsed = 1 / 30;
    const substeps = highFidelitySubsteps(elapsed);

    expect(HIGH_FIDELITY_PHYSICS_HZ).toBe(139);
    expect(substeps).toBe(5);
    expect(elapsed / substeps).toBeLessThanOrEqual(1 / HIGH_FIDELITY_PHYSICS_HZ);
  });

  it("covers every bounded elapsed interval without losing simulation time", () => {
    for (const elapsed of [1 / 240, 1 / 120, 1 / 60, 1 / 30, 0.1, 0.4]) {
      const substeps = highFidelitySubsteps(elapsed);
      expect(substeps).toBeGreaterThanOrEqual(1);
      expect(elapsed / substeps).toBeLessThanOrEqual(1 / HIGH_FIDELITY_PHYSICS_HZ);
      expect((elapsed / substeps) * substeps).toBeCloseTo(elapsed, 12);
    }
  });

  it("does not create zero or non-finite substeps for paused and invalid visual frames", () => {
    expect(highFidelitySubsteps(0)).toBe(1);
    expect(highFidelitySubsteps(-1)).toBe(1);
    expect(highFidelitySubsteps(Number.NaN)).toBe(1);
  });
});
