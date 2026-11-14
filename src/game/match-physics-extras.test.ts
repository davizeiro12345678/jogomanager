import { describe, expect, it } from "vitest";
import {
  blockRestitution,
  bodyContactShare,
  fatigueStrikeFactor,
  firstTouchSpill,
  goalkeeperCanReach,
  headerPower,
  parryReboundSpeed,
  pitchTraction,
  quadraticDragDeceleration,
  settlesOnTurf,
  shotProfile,
  sweptBallPlayerContact,
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
  it("revised goalkeepers only save physically reachable trajectories", () => {
    expect(goalkeeperCanReach(49, 0, 50, 0.5, 1, 85, 90)).toBe(true);
    expect(goalkeeperCanReach(30, 0, 50, 0.5, 1, 85, 90)).toBe(false);
    expect(goalkeeperCanReach(49, -4, 50, 3, 1, 85, 90)).toBe(false);
    expect(goalkeeperCanReach(49, 0, 50, 0, Number.NaN, 85, 90)).toBe(false);
  });

  it("prevents fast ball tunneling past a standing defender", () => {
    const hit = sweptBallPlayerContact(-10, 0, 10, 0, 0, 0.5, 1.25);
    expect(hit).not.toBeNull();
    expect(hit?.fraction).toBeCloseTo(0.5);
    expect(hit?.distance).toBeCloseTo(0.5);
    expect(sweptBallPlayerContact(-10, 0, 10, 0, 0, 3, 1.25)).toBeNull();
  });

  it("rejects impossible contact inputs and retains stationary-ball contact", () => {
    expect(sweptBallPlayerContact(0, 0, 0, 0, 0.5, 0, 1.25)).toEqual({
      fraction: 1,
      distance: 0.5,
    });
    expect(sweptBallPlayerContact(0, 0, 0, 0, 2, 0, 1.25)).toBeNull();
    expect(sweptBallPlayerContact(0, 0, 10, 0, 1, 0, -1)).toBeNull();
    expect(sweptBallPlayerContact(0, 0, Number.NaN, 0, 1, 0, 1)).toBeNull();
    expect(sweptBallPlayerContact(0, 0, Number.MAX_VALUE, 1, 1, 0, 1)).toBeNull();
  });

  it("hard or wet ball spills further", () => {
    expect(firstTouchSpill(4, 30, "rain")).toBeGreaterThan(firstTouchSpill(4, 10, "clear"));
  });
});
