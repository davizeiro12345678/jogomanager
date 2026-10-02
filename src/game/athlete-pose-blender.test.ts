import { describe, expect, it } from "vitest";
import { emptyPose } from "./animation-core";
import { AthletePoseBlender } from "./athlete-pose-blender";

describe("athlete transitions", () => {
  it("starts interrupted transitions from the displayed pose and converges at different frame rates", () => {
    for (const fps of [20, 30, 60, 120]) {
      const mixer = new AthletePoseBlender();
      const idle = { ...emptyPose(), armLPitch: 0.05 };
      const run = { ...emptyPose(), armLPitch: 0.7 };
      const shot = { ...emptyPose(), armLPitch: -0.8 };
      mixer.sample(idle, 0, { clip: "idle", action: null, progress: 0 });
      expect(mixer.sample(run, 1 / fps, { clip: "run", action: null, progress: 0 }).armLPitch).toBe(
        0.05,
      );
      mixer.sample(run, 0.09, { clip: "run", action: null, progress: 0 });
      const shown = mixer.pose.armLPitch;
      expect(
        mixer.sample(shot, 1 / fps, { clip: "shotPower", action: "shotPower", progress: 0 })
          .armLPitch,
      ).toBe(shown);
      for (let frame = 1; frame <= fps; frame++)
        mixer.sample(shot, 1 / fps, { clip: "shotPower", action: "shotPower", progress: 0.2 });
      expect(mixer.pose.armLPitch).toBeCloseTo(-0.8, 6);
    }
  });
  it("preserves the contact pose after late snapshots and samples frozen inspection exactly", () => {
    const mixer = new AthletePoseBlender();
    mixer.sample(emptyPose(), 0, { clip: "run", action: null, progress: 0 });
    const impact = { ...emptyPose(), legRPitch: -0.8, kneeR: -0.3 };
    expect(
      mixer.sample(impact, 0.08, { clip: "shotPower", action: "shotPower", progress: 0.4 }),
    ).toEqual(impact);
    const continuation = { ...impact, legRPitch: -0.95 };
    expect(
      mixer.sample(continuation, 0.05, { clip: "shotPower", action: "shotPower", progress: 0.5 }),
    ).toEqual(continuation);
    const frozen = { ...impact, legRPitch: -0.42 };
    expect(
      mixer.sample(frozen, 0, {
        clip: "shotPower",
        action: "shotPower",
        progress: 0.1,
        instant: true,
      }),
    ).toEqual(frozen);
  });
  it("does not delay the planted foot after a locomotion transition settles", () => {
    const mixer = new AthletePoseBlender();
    mixer.sample(emptyPose(), 0, { clip: "run", action: null, progress: 0 });
    const stride = { ...emptyPose(), legLPitch: -0.3, kneeL: -0.45 };
    expect(mixer.sample(stride, 1 / 60, { clip: "run", action: null, progress: 0 })).toEqual(
      stride,
    );
  });
});
