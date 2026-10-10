import { describe, expect, it } from "vitest";
import { presentationWorkerBudget } from "./presentation-worker-budget";

describe("presentation worker budget", () => {
  it("keeps live rendering and sequential simulation capacity reserved", () => {
    expect(presentationWorkerBudget(2, 8)).toEqual({ total: 0, textures: 0, geometry: 0 });
    expect(presentationWorkerBudget(4, 8)).toEqual({ total: 1, textures: 1, geometry: 0 });
    expect(presentationWorkerBudget(6, 8)).toEqual({ total: 3, textures: 2, geometry: 1 });
  });

  it("caps aggregate presentation work instead of saturating every logical core", () => {
    const budget = presentationWorkerBudget(64, 32);
    expect(budget).toEqual({ total: 4, textures: 2, geometry: 2 });
    expect(budget.textures + budget.geometry).toBeLessThanOrEqual(budget.total);
  });

  it("limits memory-constrained devices to one background worker", () => {
    expect(presentationWorkerBudget(16, 2)).toEqual({ total: 1, textures: 1, geometry: 0 });
  });

  it("uses a conservative fallback when device capacity is unknown", () => {
    expect(presentationWorkerBudget(undefined, undefined)).toEqual({
      total: 1,
      textures: 1,
      geometry: 0,
    });
  });
});
