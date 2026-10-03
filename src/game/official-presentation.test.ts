import { expect, it } from "vitest";
import {
  officialCue,
  officialGestureWeight,
  officialShirt,
  officialTrackingTarget,
} from "./official-presentation";
const zero = { cards: 0, reds: 0, goals: 0, offsides: 0, fouls: 0 };
it("consumes simultaneous counters once without stale foul/card gestures on the next frame", () => {
  const next = { cards: 1, reds: 1, goals: 0, offsides: 0, fouls: 1 };
  expect(officialCue(zero, next, "ref")).toBe("red");
  expect(officialCue(next, next, "ref")).toBe("none");
  expect(officialCue(zero, { ...zero, offsides: 1 }, "ref")).toBe("none");
  expect(officialCue(zero, { ...zero, offsides: 1 }, "ar1")).toBe("offside");
});
it("chooses a contrasting uniform for a yellow/green fixture", () => {
  expect(officialShirt("#e5ca39", "#39cbd5")).toBe("#ed729b");
});
it("prepares, holds and recovers a signal instead of snapping the shoulder", () => {
  expect(officialGestureWeight(2.4, 2.4)).toBe(0);
  expect(officialGestureWeight(1.2, 2.4)).toBe(1);
  expect(officialGestureWeight(0, 2.4)).toBe(0);
  expect(officialGestureWeight(2.35, 2.4)).toBeLessThan(0.1);
  expect(officialGestureWeight(0.05, 2.4)).toBeLessThan(0.1);
});
it("aligns the assistant with the ball or second-last active defender in its half", () => {
  const players = [
    { x: 45, z: 0, side: "away" as const },
    { x: 31, z: 5, side: "away" as const },
    { x: 12, z: 5, side: "away" as const },
    { x: -44, z: 0, side: "home" as const },
    { x: -29, z: 5, side: "home" as const },
  ];
  const out = { x: 0, z: 0 };
  expect(officialTrackingTarget("ar1", { x: 18, z: 2 }, players, 52.5, 34, out)).toBe(out);
  expect(out).toEqual({ x: 31, z: 35.6 });
  officialTrackingTarget("ar1", { x: 38, z: 2 }, players, 52.5, 34, out);
  expect(out.x).toBe(38);
  officialTrackingTarget("ar2", { x: -18, z: 2 }, players, 52.5, 34, out);
  expect(out).toEqual({ x: -29, z: -35.6 });
  officialTrackingTarget(
    "ar1",
    { x: 18, z: 2 },
    players.map((p, i) => ({ ...p, sentOff: i === 0 })),
    52.5,
    34,
    out,
  );
  expect(out.x).toBe(18);
  officialTrackingTarget("ar2", { x: 15, z: 2 }, [], 52.5, 34, out);
  expect(out.x).toBeCloseTo(0);
});
it("keeps the referee inside the touchlines and away from a player occupying the target", () => {
  const out = { x: 0, z: 0 };
  const player = { x: -5, z: 6, side: "home" as const };
  officialTrackingTarget("ref", { x: 0, z: 0 }, [player], 52.5, 34, out);
  expect(Math.hypot(out.x - player.x, out.z - player.z)).toBeCloseTo(2.3);
  officialTrackingTarget("ref", { x: 100, z: -100 }, [], 52.5, 34, out);
  expect(Math.abs(out.x)).toBeLessThan(52.5);
  expect(Math.abs(out.z)).toBeLessThan(34);
});
