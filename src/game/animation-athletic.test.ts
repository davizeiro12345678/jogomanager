import { describe, expect, it } from "vitest";
import { ATHLETIC_CLIPS } from "./animation-athletic";
import { JOINTS, isPoseValid } from "./animation-core";
import { getAnnotatedClip } from "./register-animations";

describe("athletic preparation and recovery", () => {
  it("registers distinct animated loops with finite joint-safe poses at different sample rates", () => {
    const signatures = new Set<string>();
    for (const [name, clip] of Object.entries(ATHLETIC_CLIPS)) {
      expect(getAnnotatedClip(name)?.metadata.loop).toBe(true);
      const frames = [];
      for (let frame = 0; frame < 120; frame++) {
        const pose = clip({ t: frame / 30, u: frame / 120, speed: 0, stride: 0, seed: 7 });
        expect(JOINTS.every((joint) => Number.isFinite(pose[joint]))).toBe(true);
        expect(isPoseValid(pose), `${name} at frame ${frame}`).toBe(true);
        frames.push(JOINTS.map((joint) => pose[joint].toFixed(3)).join(","));
      }
      expect(new Set(frames).size).toBeGreaterThan(25);
      signatures.add(frames.join("|"));
    }
    expect(signatures.size).toBe(Object.keys(ATHLETIC_CLIPS).length);
  });
});
