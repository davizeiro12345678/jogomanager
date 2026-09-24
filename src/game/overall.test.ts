import { describe, expect, it } from "vitest";
import { computeOverall } from "./overall";

const base = { seed: "p1", leagueTier: 1, clubStrength: 85, position: "MF" as const, age: 27 };

describe("computeOverall", () => {
  it("é determinístico", () => {
    expect(computeOverall(base)).toEqual(computeOverall(base));
  });
  it("clube forte em liga forte supera clube fraco em divisão baixa", () => {
    const weak = computeOverall({ ...base, leagueTier: 3, clubStrength: 55 });
    expect(computeOverall(base).overall).toBeGreaterThan(weak.overall);
  });
  it("fica dentro dos limites e potencial ≥ overall", () => {
    const r = computeOverall({ ...base, age: 18, clubStrength: 40, leagueTier: 5 });
    expect(r.overall).toBeGreaterThanOrEqual(40);
    expect(r.potential).toBeGreaterThanOrEqual(r.overall);
  });
});
