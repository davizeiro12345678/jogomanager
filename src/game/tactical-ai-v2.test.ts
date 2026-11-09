import { describe, expect, it } from "vitest";
import {
  coordinatedDefensiveCover,
  coordinatedHalfTimePlan,
  coordinatedOffsideTrap,
  coordinatedPassingLaneCover,
  coordinatedSupportRun,
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
    expect(
      coordinatedOffsideTrap({ ...trap, ballX: 0, defenderLineX: 20, attackDirection: -1 }),
    ).toBeCloseTo(-coordinatedOffsideTrap(trap));
  });
  it("does not trigger when the opponent is too close or too far, or a late lead is protected", () => {
    expect(coordinatedOffsideTrap({ ...trap, ballX: -12 })).toBe(0);
    expect(coordinatedOffsideTrap({ ...trap, ballX: 30 })).toBe(0);
    expect(coordinatedOffsideTrap({ ...trap, scoreDifference: 2 })).toBe(0);
    expect(coordinatedOffsideTrap({ ...trap, minute: 90 })).toBe(0);
  });
  it("keeps coverage and acceleration bounded under extreme inputs", () => {
    const cover = coordinatedDefensiveCover({
      ballZ: 34,
      targetZ: -34,
      stamina: 22,
      pressing: 2,
      minute: 88,
      scoreDifference: -2,
      attackDirection: 1,
    });
    expect(cover.lateral).toBeLessThanOrEqual(3.25);
    expect(cover.lateral).toBeGreaterThan(0);
    expect(cover.forward).toBeGreaterThan(0);
    expect(cover.sprint).toBeLessThanOrEqual(1.2);
  });
  it("is deterministic and fails closed on invalid numerical data", () => {
    const inputs = {
      ballZ: 11,
      targetZ: -7,
      stamina: 68,
      pressing: 1,
      minute: 83,
      scoreDifference: -1,
      attackDirection: -1 as const,
    };
    expect(coordinatedDefensiveCover(inputs)).toEqual(coordinatedDefensiveCover(inputs));
    expect(coordinatedDefensiveCover({ ...inputs, stamina: NaN })).toEqual({
      lateral: 0,
      forward: 0,
      sprint: 1,
    });
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

describe("Versioned spatial intelligence", () => {
  const lane = {
    ballX: 0,
    ballZ: 0,
    receiverX: 18,
    receiverZ: 8,
    defenderX: 10,
    defenderZ: 6,
    pressing: 2,
    stamina: 80,
  };
  it("shadows reachable passing corridors without pulling distant defenders", () => {
    const close = coordinatedPassingLaneCover(lane);
    expect(close.forward).toBeLessThan(0);
    expect(close.lateral).toBeLessThan(0);
    expect(coordinatedPassingLaneCover({ ...lane, defenderX: -40, defenderZ: -20 })).toEqual({
      forward: 0,
      lateral: 0,
      sprint: 1,
    });
  });
  it("does not act on invalid input or exhausted stamina", () => {
    expect(coordinatedPassingLaneCover({ ...lane, receiverX: NaN })).toEqual({
      forward: 0,
      lateral: 0,
      sprint: 1,
    });
    expect(coordinatedPassingLaneCover({ ...lane, stamina: 0 })).toEqual({
      forward: 0,
      lateral: 0,
      sprint: 1,
    });
  });
  const support = {
    holderX: 5,
    holderZ: 0,
    playerX: 15,
    playerZ: 3,
    opponentLineX: 14,
    attackingDirection: 1 as const,
    stamina: 75,
    midfield: false,
  };
  it("withdraws a forward from offside risk to create a lateral outlet", () => {
    const run = coordinatedSupportRun(support);
    expect(run.forward).toBeLessThan(0);
    expect(run.lateral).toBeGreaterThan(0);
    expect(coordinatedSupportRun({ ...support, stamina: 5 })).toEqual({
      forward: 0,
      lateral: 0,
      sprint: 1,
    });
  });
  it("mirrors the same offside correction for the opposite attack direction", () => {
    const mirrored = coordinatedSupportRun({
      ...support,
      holderX: -5,
      playerX: -15,
      opponentLineX: -14,
      attackingDirection: -1,
    });
    expect(mirrored.forward).toBeCloseTo(-coordinatedSupportRun(support).forward);
  });
  it("remains bounded and deterministic across the pitch", () => {
    for (let x = -50; x <= 50; x += 5) {
      for (let z = -30; z <= 30; z += 5) {
        const a = coordinatedPassingLaneCover({ ...lane, defenderX: x, defenderZ: z });
        const b = coordinatedPassingLaneCover({ ...lane, defenderX: x, defenderZ: z });
        expect(a).toEqual(b);
        expect(Math.abs(a.forward)).toBeLessThanOrEqual(2.6);
        expect(Math.abs(a.lateral)).toBeLessThanOrEqual(3);
        const run = coordinatedSupportRun({ ...support, playerX: x, playerZ: z });
        expect(Number.isFinite(run.forward) && Number.isFinite(run.lateral)).toBe(true);
        expect(Math.abs(run.forward)).toBeLessThanOrEqual(5);
        expect(Math.abs(run.lateral)).toBeLessThanOrEqual(2.7);
      }
    }
  });
});
