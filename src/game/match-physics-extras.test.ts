import { describe, expect, it } from "vitest";
import {
  blockRestitution,
  bodyContactShare,
  fatigueStrikeFactor,
  firstTouchSpill,
  headerPower,
  parryReboundSpeed,
  pitchTraction,
  quadraticDragDeceleration,
  settlesOnTurf,
  shotProfile,
} from "./match-physics-extras";

describe("match physics extras", () => {
  it("chip is softer and higher than a power shot", () => {
    expect(shotProfile("chip").power).toBeLessThan(shotProfile("shotPower").power);
    expect(shotProfile("chip").loft).toBeGreaterThan(1);
    expect(shotProfile("shotPlaced").spin).toBeGreaterThan(shotProfile("shot").spin);
  });
  it("tired legs strike weaker", () => {
    expect(fatigueStrikeFactor(80)).toBe(1);
    expect(fatigueStrikeFactor(12)).toBeCloseTo(0.8796, 3);
  });
  it("stronger, heavier player yields less in contact", () => {
    expect(bodyContactShare(90, 92, 40, 66)).toBeLessThan(0.5);
    expect(bodyContactShare(50, 78, 50, 78)).toBeCloseTo(0.5);
  });
  it("wet pitch loses grip over the match", () => {
    expect(pitchTraction("clear", 5000)).toBe(1);
    expect(pitchTraction("rain", 0)).toBeCloseTo(0.72);
    expect(pitchTraction("rain", 5400)).toBeCloseTo(0.66);
  });
  it("drag grows with the square of speed", () => {
    expect(quadraticDragDeceleration(30) / quadraticDragDeceleration(15)).toBeCloseTo(4);
  });
  it("slow grounded ball settles, airborne does not", () => {
    expect(settlesOnTurf(0.2, 0.12)).toBe(true);
    expect(settlesOnTurf(0.2, 1)).toBe(false);
  });
  it("slide and heavy defender deaden blocks", () => {
    expect(blockRestitution(true, 90)).toBeLessThan(blockRestitution(false, 70));
  });
  it("hard shot parries further; strong keeper parries less", () => {
    expect(parryReboundSpeed(8, 36, 50)).toBeGreaterThan(parryReboundSpeed(8, 18, 50));
    expect(parryReboundSpeed(8, 30, 90)).toBeLessThan(parryReboundSpeed(8, 30, 40));
  });
  it("header uses cross pace and jump", () => {
    expect(headerPower(15, 20, 80)).toBeGreaterThan(headerPower(15, 5, 40));
  });
  it("hard or wet ball spills further", () => {
    expect(firstTouchSpill(4, 30, "rain")).toBeGreaterThan(firstTouchSpill(4, 10, "clear"));
  });
});
