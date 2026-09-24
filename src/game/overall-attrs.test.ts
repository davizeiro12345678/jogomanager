import { describe, expect, it } from "vitest";
import { formAdjustment, positionalOverall, potentialFor } from "./overall";

describe("overall por atributos", () => {
  const striker = { pace: 85, shooting: 88, passing: 70, defending: 30, physical: 75 };
  it("atacante vale mais na frente que na defesa", () => {
    expect(positionalOverall("FW", striker)).toBeGreaterThan(positionalOverall("DF", striker));
  });
  it("forma limitada a ±2", () => {
    expect(formAdjustment(100)).toBe(2);
    expect(formAdjustment(0)).toBe(-2);
  });
  it("potencial determinístico, nunca abaixo do overall, veteranos param", () => {
    expect(potentialFor(70, 18, 0.5, "a")).toBe(potentialFor(70, 18, 0.5, "a"));
    expect(potentialFor(70, 18, 0.5, "a")).toBeGreaterThanOrEqual(70);
    expect(potentialFor(80, 31, 1, "b")).toBe(80);
  });
});
