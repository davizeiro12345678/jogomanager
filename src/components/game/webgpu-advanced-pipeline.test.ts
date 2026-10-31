import { describe, expect, it } from "vitest";
import { clusteredLightingBudget } from "./webgpu-cluster-budget";

describe("clustered GPU light list budgets", () => {
  it("bounds per-cluster storage and scales the tile grid by device quality", () => {
    const high = clusteredLightingBudget("alta");
    const medium = clusteredLightingBudget("media");
    const low = clusteredLightingBudget("baixa");
    expect(high.maxLights).toBeGreaterThan(medium.maxLights);
    expect(medium.maxLights).toBeGreaterThan(low.maxLights);
    expect(high.maxLightsPerCluster).toBeLessThanOrEqual(16);
    expect(low.tileSize).toBeGreaterThan(high.tileSize);
    expect(low.zSlices).toBeLessThan(high.zSlices);
  });
});
