import { expect, it } from "vitest";
import { officialCue, officialShirt } from "./official-presentation";
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
