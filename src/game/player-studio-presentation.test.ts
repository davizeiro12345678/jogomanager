import { describe, expect, it } from "vitest";
import {
  STUDIO_ACTION_BALL_Z,
  STUDIO_NEUTRAL_GAZE_BALL_Z,
  studioBallFocusDistanceFor,
} from "./player-studio-presentation";

describe("Player Studio gaze target", () => {
  it("keeps inspection and non-ball presentation poses level", () => {
    expect(studioBallFocusDistanceFor({ action: null })).toBe(STUDIO_NEUTRAL_GAZE_BALL_Z);
    expect(studioBallFocusDistanceFor({ action: "celebrate" })).toBe(STUDIO_NEUTRAL_GAZE_BALL_Z);
    expect(studioBallFocusDistanceFor({ action: "dejected" })).toBe(STUDIO_NEUTRAL_GAZE_BALL_Z);
  });

  it("keeps ball tracking for controls, strikes, duels and goalkeeper actions", () => {
    for (const movement of [
      { action: null, hasBall: true },
      { action: "pass" as const },
      { action: "shotPower" as const },
      { action: "duel" as const },
      { action: "saveHigh" as const },
    ]) {
      expect(studioBallFocusDistanceFor(movement)).toBe(STUDIO_ACTION_BALL_Z);
    }
  });
});
