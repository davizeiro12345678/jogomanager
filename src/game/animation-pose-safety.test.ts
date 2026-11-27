import { describe, expect, it } from "vitest";
import { clampPose, emptyPose, isPoseValid, JOINT_LIMITS } from "./animation-core";

describe("procedural animation pose safety", () => {
  it("neutralizes invalid joints instead of leaking NaN into bone matrices", () => {
    const source = emptyPose();
    source.headYaw = Number.NaN;
    source.kneeL = Number.POSITIVE_INFINITY;
    source.ankleR = Number.NEGATIVE_INFINITY;

    const safe = clampPose(source);

    expect(safe.headYaw).toBe(0);
    expect(safe.kneeL).toBe(0);
    expect(safe.ankleR).toBe(0);
    expect(isPoseValid(safe)).toBe(true);
    expect(Number.isNaN(source.headYaw)).toBe(true);
  });

  it("preserves valid poses and clamps finite angles to joint limits", () => {
    const pose = emptyPose();
    pose.headYaw = 0.3;
    pose.kneeL = -4;
    pose.armLRoll = 2;

    const safe = clampPose(pose);

    expect(safe.headYaw).toBe(0.3);
    expect(safe.kneeL).toBe(JOINT_LIMITS.kneeL.min);
    expect(safe.armLRoll).toBe(JOINT_LIMITS.armLRoll.max);
    expect(pose.kneeL).toBe(-4);
    expect(isPoseValid(safe)).toBe(true);
  });
});
