import { describe, expect, it } from "vitest";
import { emptyPose } from "./animation-core";
import { AthletePoseBlender } from "./athlete-pose-blender";

describe("athlete transitions", () => {
  it("restarts early repeated actions and event changes from the displayed pose", () => {
    for (const restart of [
      { progress: 0.1, event: 1 },
      { progress: 0.2, event: 2 },
    ]) {
      const mixer = new AthletePoseBlender();
      const shown = { ...emptyPose(), legRPitch: -0.7 };
      mixer.sample(shown, 0, { clip: "shotPower", action: "shotPower", progress: 0.2, event: 1 });
      const target = { ...shown, legRPitch: 0.5 };
      expect(
        mixer.sample(target, 1 / 60, { clip: "shotPower", action: "shotPower", ...restart })
          .legRPitch,
      ).toBe(shown.legRPitch);
      mixer.sample(target, 0.2, {
        clip: "shotPower",
        action: "shotPower",
        progress: 0.4,
        event: restart.event,
      });
      expect(mixer.pose.legRPitch).toBe(target.legRPitch);
    }
  });

  it("does not turn ground ankle corrections into recoil on an interruption", () => {
    const mixer = new AthletePoseBlender();
    const target = emptyPose();
    const pose = mixer.sample(target, 0, { clip: "run", action: null, progress: 0 });
    pose.ankleL += 0.2; // The final ground adapter mutates the exposed pose.
    mixer.sample(target, 1 / 60, { clip: "run", action: null, progress: 0 });
    mixer.sample(target, 0, { clip: "stand", action: null, progress: 0 });
    expect(mixer.sample(target, 0.01, { clip: "stand", action: null, progress: 0 }).ankleL).toBe(0);
  });

  it("settles a kick's support leg before the trunk without delaying ball contact", () => {
    const mixer = new AthletePoseBlender();
    mixer.sample(emptyPose(), 0, { clip: "run", action: null, progress: 0 });
    const target = { ...emptyPose(), legLPitch: 0.3, hipYaw: 0.3, legRPitch: -0.8 };
    const input = {
      clip: "shot",
      action: "shot",
      progress: 0.05,
      supportFoot: "left" as const,
      phase: 0,
    };
    mixer.sample(target, 0, input);
    const settling = mixer.sample(target, 0.06, { ...input, progress: 0.1 });
    expect(settling.legLPitch).toBeGreaterThan(settling.hipYaw);
    expect(mixer.sample(target, 0.02, { ...input, progress: 0.4 })).toEqual(target);
  });

  it("keeps interrupted action channels finite on missing progress", () => {
    const mixer = new AthletePoseBlender();
    mixer.sample(emptyPose(), 0, { clip: "run", action: null, progress: 0 });
    const target = { ...emptyPose(), hipY: -0.2, kneeL: -0.8 };
    for (let frame = 0; frame < 30; frame++) {
      const result = mixer.sample(target, 1 / 60, {
        clip: "tackle",
        action: "tackle",
        progress: NaN,
      });
      expect(Object.values(result).every(Number.isFinite)).toBe(true);
      expect(Math.abs(result.hipY)).toBeLessThanOrEqual(0.2);
    }
  });

  it("follows a continuous gesture exactly once its transition has settled", () => {
    const mixer = new AthletePoseBlender();
    for (let frame = 0; frame < 120; frame++) {
      const target = { ...emptyPose(), armLPitch: Math.sin((frame / 60) * 3) * 0.5 };
      const actual = mixer.sample(target, 1 / 60, { clip: "dialogue", action: null, progress: 0 });
      expect(actual.armLPitch).toBeCloseTo(target.armLPitch, 10);
    }
  });
  it("bounds root-height momentum in metres during an interrupted landing", () => {
    const mixer = new AthletePoseBlender();
    mixer.sample(emptyPose(), 0, { clip: "land", action: null, progress: 0 });
    const raised = { ...emptyPose(), hipY: 0.1 };
    mixer.sample(raised, 0.01, { clip: "land", action: null, progress: 0 });
    mixer.sample(raised, 0, { clip: "stand", action: null, progress: 0 });
    expect(
      mixer.sample(raised, 0.005, { clip: "stand", action: null, progress: 0 }).hipY,
    ).toBeLessThan(0.105);
  });
  it("carries a moving joint into an interrupted clip without a frozen first derivative", () => {
    const mixer = new AthletePoseBlender();
    mixer.sample(emptyPose(), 0, { clip: "run", action: null, progress: 0 });
    mixer.sample({ ...emptyPose(), armLPitch: 0.1 }, 0.02, {
      clip: "run",
      action: null,
      progress: 0,
    });
    const target = { ...emptyPose(), armLPitch: 0.1 };
    mixer.sample(target, 0, { clip: "idle", action: null, progress: 0 });
    const next = mixer.sample(target, 0.005, { clip: "idle", action: null, progress: 0 }).armLPitch;
    expect(next).toBeGreaterThan(0.115);
    expect(next).toBeLessThan(0.13);
    const atRest = mixer.sample(target, 0.5, { clip: "idle", action: null, progress: 0 });
    expect(atRest.armLPitch).toBeCloseTo(0.1, 6);
    expect(
      Object.values(mixer.sample(target, NaN, { clip: "idle", action: null, progress: 0 })).every(
        Number.isFinite,
      ),
    ).toBe(true);
  });
  it("approaches contact continuously instead of snapping on entering the old contact window", () => {
    const mixer = new AthletePoseBlender();
    mixer.sample(emptyPose(), 0, { clip: "run", action: null, progress: 0 });
    const impact = { ...emptyPose(), legRPitch: -0.8 };
    mixer.sample(impact, 0, { clip: "shotPower", action: "shotPower", progress: 0.3 });
    const before = mixer.sample(impact, 0.005, {
      clip: "shotPower",
      action: "shotPower",
      progress: 0.326,
    }).legRPitch;
    expect(before).toBeLessThan(0);
    expect(before).toBeGreaterThan(-0.3);
    expect(
      mixer.sample(impact, 0.01, { clip: "shotPower", action: "shotPower", progress: 0.4 })
        .legRPitch,
    ).toBe(-0.8);
  });
  it("starts interrupted transitions from the displayed pose and converges at different frame rates", () => {
    for (const fps of [15, 30, 60, 120]) {
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
