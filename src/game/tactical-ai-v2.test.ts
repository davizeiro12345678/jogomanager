import { describe, expect, it } from "vitest";
import {
  coordinatedDefensiveCover,
  coordinatedHalfTimePlan,
  coordinatedOffsideTrap,
} from "./tactical-ai-v2";

const trap = {
  pressing: 2,
  ballX: 0,
  defenderLineX: -20,
  attackDirection: 1 as const,
  minute: 40,
  scoreDifference: 0,
};

describe("Versioned coordinated football intelligence", () => {
  it("activates the offside trap at real 0..2 pressing levels", () => {
    expect(coordinatedOffsideTrap(trap)).toBeGreaterThan(0);
    expect(coordinatedOffsideTrap({ ...trap, pressing: 1 })).toBe(0);
    expect(coordinatedOffsideTrap({ ...trap, pressing: 0 })).toBe(0);
  });
  it("mirrors the tactical advance for the other attack direction", () => {
    expect(coordinatedOffsideTrap({ ...trap, ballX: 0, defenderLineX: 20, attackDirection: -1 }))
      .toBeCloseTo(-coordinatedOffsideTrap(trap));
  });
  it("does not trigger when the opponent is too close or too far, or a late lead is protected", () => {
    expect(coordinatedOffsideTrap({ ...trap, ballX: -12 })).toBe(0);
    expect(coordinatedOffsideTrap({ ...trap, ballX: 30 })).toBe(0);
    expect(coordinatedOffsideTrap({ ...trap, scoreDifference: 2 })).toBe(0);
    expect(coordinatedOffsideTrap({ ...trap, minute: 90 })).toBe(0);
  });
  it("keeps coverage and acceleration bounded under extreme inputs", () => {
    const cover = coordinatedDefensiveCover({
      ballZ: 34, targetZ: -34, stamina: 22, pressing: 2,
      minute: 88, scoreDifference: -2, attackDirection: 1,
    });
    expect(cover.lateral).toBeLessThanOrEqual(3.25);
    expect(cover.lateral).toBeGreaterThan(0);
    expect(cover.forward).toBeGreaterThan(0);
    expect(cover.sprint).toBeLessThanOrEqual(1.2);
  });
  it("is deterministic and fails closed on invalid numerical data", () => {
    const inputs = {
      ballZ: 11, targetZ: -7, stamina: 68, pressing: 1, minute: 83,
      scoreDifference: -1, attackDirection: -1 as const,
    };
    expect(coordinatedDefensiveCover(inputs)).toEqual(coordinatedDefensiveCover(inputs));
    expect(coordinatedDefensiveCover({ ...inputs, stamina: NaN }))
      .toEqual({ lateral: 0, forward: 0, sprint: 1 });
  });
  it("adapts the half-time response without leaving tactical bounds", () => {
    const base = { formation: "4-3-3" as const, mentality: 2, pressing: 1, width: 1, tempo: 1 };
    const plan = coordinatedHalfTimePlan(
      { goals: 0, shots: 2, possession: 36 },
      { goals: 1, shots: 8, possession: 64 },
      base,
      base,
    );
    expect(plan.tactics.pressing).toBe(2);
    expect(plan.tactics.width).toBe(0);
    expect(plan.notes.some((note) => note.includes("segunda bola"))).toBe(true);
  });
});
