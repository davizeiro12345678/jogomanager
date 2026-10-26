import { describe, expect, it, vi } from "vitest";
import { emptyPose, getClip, JOINTS, mixPose, type ClipName } from "./animation";
import { gaitPoseAt, locomotionWeight } from "./gait-kinematics";
import { PlayerLocomotionPose } from "./player-locomotion-pose";

const proportions = { thigh: 0.44, shin: 0.43 };
const direction = {
  forward: 5.5,
  lateral: 0.2,
  stamina: 75,
  turnRate: 0.7,
  hasBall: true,
  style: 17,
};

describe("player locomotion sampling", () => {
  it("matches the previous catalog plus gait composition across transitions and action contacts", () => {
    const sampler = new PlayerLocomotionPose();
    const gait = emptyPose();
    const mixed = emptyPose();
    const clips: ClipName[] = [
      "idle",
      "walk",
      "run",
      "sprint",
      "shotPower",
      "standTackle",
      "header",
    ];
    for (const clip of clips)
      for (const action of [null, "shotPower", "tackle"]) {
        for (let frame = 0; frame < 120; frame++) {
          const speed = frame / 15;
          const context = { t: frame / 60, u: frame / 119, speed, stride: speed / 7, seed: 17 };
          const phase = frame * 0.17;
          const authored = getClip(clip)(context);
          const weight = locomotionWeight(speed, action, clip);
          const expected =
            weight > 0
              ? mixPose(
                  authored,
                  gaitPoseAt(phase, speed, proportions, gait, direction).pose,
                  weight,
                  mixed,
                )
              : authored;
          const actual = sampler.sample(clip, context, action, phase, proportions, direction);
          for (const joint of JOINTS) expect(actual[joint]).toBeCloseTo(expected[joint], 12);
        }
      }
  });

  it("does not resolve or allocate an overridden authored clip, but keeps partial starts and actions", () => {
    const resolve = vi.fn(getClip);
    const sampler = new PlayerLocomotionPose(resolve);
    const context = { t: 1, u: 0.4, speed: 5.5, stride: 0.8, seed: 17 };
    const first = sampler.sample("run", context, null, 1, proportions, direction);
    expect(sampler.sample("run", context, null, 2, proportions, direction)).toBe(first);
    expect(resolve).not.toHaveBeenCalled();
    sampler.sample("run", { ...context, speed: 0.7 }, null, 1, proportions, direction);
    expect(resolve).toHaveBeenCalledTimes(1);
    sampler.sample("shotPower", context, "shotPower", 1, proportions, direction);
    expect(resolve).toHaveBeenCalledTimes(2);
  });

  it("does not retain downstream ground or posture corrections in the next stride", () => {
    const sampler = new PlayerLocomotionPose();
    const context = { t: 1, u: 0, speed: 5.5, stride: 0.8, seed: 17 };
    const original = { ...sampler.sample("run", context, null, 1, proportions, direction) };
    const output = sampler.sample("run", context, null, 1, proportions, direction);
    output.ankleL += 0.5;
    output.hipY -= 0.2;
    expect(sampler.sample("run", context, null, 1, proportions, direction)).toEqual(original);
  });
});
