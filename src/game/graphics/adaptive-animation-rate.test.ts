import { describe, expect, it } from "vitest";
import { animationPoseInterval } from "./adaptive-animation-rate";

describe("adaptive athlete animation rate", () => {
  it("keeps close-up poses synchronized to every visible frame", () => {
    for (const quality of ["alta", "media", "baixa"] as const)
      expect(animationPoseInterval(0, quality, 8)).toBe(0);
  });
  it("decreases distant pose update frequency without touching match ticks", () => {
    expect(animationPoseInterval(1, "alta")).toBe(1 / 36);
    expect(animationPoseInterval(1, "baixa")).toBe(1 / 24);
    expect(animationPoseInterval(2, "media")).toBe(1 / 16);
    expect(animationPoseInterval(2, "baixa", 2)).toBe(1 / 10);
  });
});
