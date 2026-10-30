import { describe, expect, it } from "vitest";
import { stadiumEnvironmentResolution } from "./pmrem-budget";

describe("static stadium PMREM capture budget", () => {
  it("uses bounded power-of-two cube sizes at each quality", () => {
    expect(stadiumEnvironmentResolution("alta", 1)).toBe(256);
    expect(stadiumEnvironmentResolution("media", 1)).toBe(128);
    expect(stadiumEnvironmentResolution("baixa", 1)).toBe(64);
  });

  it("reduces allocations under memory pressure and never requests non-power-of-two cubes", () => {
    expect(stadiumEnvironmentResolution("alta", 0.5)).toBe(128);
    expect(stadiumEnvironmentResolution("media", 0.5)).toBe(64);
    for (const scale of [0, 0.3, 0.6, 0.9, 1.1, 1.4, 2, Number.NaN])
      expect([64, 128, 256]).toContain(stadiumEnvironmentResolution("alta", scale));
  });
});
