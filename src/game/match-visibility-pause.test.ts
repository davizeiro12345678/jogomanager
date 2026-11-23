import { describe, expect, it } from "vitest";
import { shouldPauseMatch } from "./match-visibility-pause";

describe("match visibility pause", () => {
  it("keeps the worker paused if ceremony finishes in a hidden tab", () => {
    expect(shouldPauseMatch(false, false, false, false, true)).toBe(true);
  });
  it("starts only when the ceremony is finished and the tab is visible", () => {
    expect(shouldPauseMatch(false, false, false, false, false)).toBe(false);
    expect(shouldPauseMatch(false, true, false, false, false)).toBe(true);
    expect(shouldPauseMatch(false, false, true, false, false)).toBe(true);
  });
  it("respects manual pause and half-time hold", () => {
    expect(shouldPauseMatch(true, false, false, false, false)).toBe(true);
    expect(shouldPauseMatch(false, false, false, true, false)).toBe(true);
  });
});
