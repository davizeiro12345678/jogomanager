import { describe, expect, it } from "vitest";
import { halfTimePlan } from "./ai-halftime";

const base = { formation: "4-3-3", mentality: 2, pressing: 1, width: 1, tempo: 1 } as const;

describe("CPU half-time reading", () => {
  it("presses higher when the opponent had 58%+ of the ball", () => {
    const plan = halfTimePlan(
      { goals: 0, shots: 3, possession: 40 },
      { goals: 0, shots: 4, possession: 60 },
      base,
      base,
    );
    expect(plan.tactics.pressing).toBe(2);
  });
  it("drops deeper and narrows when outshot two to one", () => {
    const plan = halfTimePlan(
      { goals: 0, shots: 3, possession: 50 },
      { goals: 0, shots: 8, possession: 50 },
      base,
      base,
    );
    expect(plan.tactics.mentality).toBe(1);
    expect(plan.tactics.width).toBe(0);
  });
  it("covers the flanks against a wide team and goes direct against a high press", () => {
    const plan = halfTimePlan(
      { goals: 0, shots: 4, possession: 50 },
      { goals: 0, shots: 4, possession: 50 },
      base,
      { ...base, width: 2, pressing: 2 },
    );
    expect(plan.tactics.width).toBe(2);
    expect(plan.tactics.tempo).toBe(2);
  });
  it("attacks when losing and protects a two-goal lead", () => {
    const even = { goals: 0, shots: 4, possession: 50 };
    expect(
      halfTimePlan({ ...even, goals: 0 }, { ...even, goals: 1 }, base, base).tactics.mentality,
    ).toBe(3);
    expect(
      halfTimePlan({ ...even, goals: 2 }, { ...even, goals: 0 }, base, base).tactics.mentality,
    ).toBe(1);
  });
});
