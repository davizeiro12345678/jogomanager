import { AthletePoseBlender } from "@/game/athlete-pose-blender";
import { emptyPose } from "@/game/animation-core";
import { describe, expect, it } from "vitest";
import { GOAL_PRESENTATION_SECONDS } from "@/game/goal-choreography";
import {
  resolvePlayerRigAnimationFrame,
  PlayerRigAnimationClock,
  supportShiftAt,
  type PlayerRigAnimationInput,
} from "./player-rig-animation";
import type { SelectCtx } from "@/game/animation";

type AnimationInputOverrides = Omit<Partial<PlayerRigAnimationInput>, "selection"> & {
  selection?: Partial<SelectCtx>;
};

const input = (overrides: AnimationInputOverrides = {}) => {
  const { selection: selectionOverrides, ...frameOverrides } = overrides;
  return {
    currentClip: "idle" as const,
    currentTime: 0,
    deltaSeconds: 0.1,
    ...frameOverrides,
    selection: {
      isGK: false,
      action: null,
      actionT: 0.4,
      actionDur: 1.2,
      speed: 5.5,
      hasBall: false,
      ballDist: 20,
      stamina: 75,
      defending: false,
      stopped: false,
      seed: 11,
      time: 3,
      ...selectionOverrides,
    },
  };
};

describe("resolvePlayerRigAnimationFrame", () => {
  it("holds the shared event choice while reception height changes and allows a preview override", () => {
    const frameInput = input({
      selectedClip: "chestControlExit",
      selection: { action: "trap", ballHeight: 0.4 },
    });
    expect(resolvePlayerRigAnimationFrame(frameInput).clip).toBe("chestControlExit");
    expect(
      resolvePlayerRigAnimationFrame({ ...frameInput, previewClip: "thighCushion" }).clip,
    ).toBe("thighCushion");
  });

  it("prefers a preview clip and resets time when the clip changes", () => {
    const frame = resolvePlayerRigAnimationFrame(
      input({
        currentClip: "idle",
        currentTime: 9,
        previewClip: "run",
        selection: { speed: 5.5 },
      }),
    );

    expect(frame.clip).toBe("run");
    expect(frame.clipTime).toBeCloseTo(0.1);
  });

  it("advances the selected clip with the same bounded gait cadence", () => {
    const frame = resolvePlayerRigAnimationFrame(
      input({
        currentClip: "run",
        currentTime: 2,
        previewClip: "run",
        deltaSeconds: 0.2,
        selection: { speed: 2.75 },
      }),
    );

    expect(frame.clipTime).toBeCloseTo(2.11);
  });

  it("uses preview time before goal progress and action progress", () => {
    const frame = resolvePlayerRigAnimationFrame(
      input({
        previewAt: 0.15,
        goalProgress: 0.7,
        selection: { action: "shot", actionT: 0.2, actionDur: 1.2 },
      }),
    );

    expect(frame.progress).toBe(0.15);
    expect(frame.context.t).toBeCloseTo(0.18);
  });

  it("uses goal progress before action progress and retains the goal clock", () => {
    const frame = resolvePlayerRigAnimationFrame(
      input({
        goalProgress: 0.65,
        selection: { action: "celebrate", actionT: 0.2, actionDur: 1.2 },
      }),
    );

    expect(frame.progress).toBe(0.65);
    expect(frame.context.t).toBeCloseTo(0.65 * GOAL_PRESENTATION_SECONDS);
  });

  it("returns repeatable output for identical frame inputs", () => {
    const frameInput = input({
      selection: { action: "shot", actionT: 0.25, actionDur: 1.1, time: 7 },
    });

    expect(resolvePlayerRigAnimationFrame(frameInput)).toEqual(
      resolvePlayerRigAnimationFrame(frameInput),
    );
  });
});

describe("elapsed pose timing and planted support", () => {
  it("advances the same pose clock for 2 seconds at 10/20/30/60 Hz", () => {
    for (const fps of [10, 20, 30, 60]) {
      for (const cadence of [0, 1 / 36, 1 / 16]) {
        const clock = new PlayerRigAnimationClock();
        let time = 0;
        let pending = 0;
        for (let frame = 0; frame < fps * 2; frame++) {
          pending += 1 / fps;
          const elapsed = clock.consume(1 / fps, cadence);
          if (elapsed === null) continue;
          expect(elapsed).toBeCloseTo(pending, 12);
          pending = 0;
          const result = resolvePlayerRigAnimationFrame(
            input({
              currentClip: "run",
              previewClip: "run",
              currentTime: time,
              deltaSeconds: elapsed,
            }),
          );
          time = result.clipTime;
        }
        // Include any residual deferred LOD interval in the comparison.
        const residual = clock.consume(0, 0);
        expect(time + (residual ?? 0)).toBeCloseTo(2, 12);
      }
    }
  });
  it("keeps a hitch elapsed while rejecting invalid clock deltas and clearing culled history", () => {
    const clock = new PlayerRigAnimationClock();
    expect(clock.consume(0.01, 0.06)).toBeNull();
    expect(clock.consume(0.15, 0.06)).toBeCloseTo(0.16);
    expect(clock.consume(Number.NaN, 0)).toBe(0);
    expect(clock.consume(-1, 0)).toBe(0);
    clock.consume(0.01, 0.06);
    clock.reset();
    expect(clock.consume(0.03, 0)).toBe(0.03);
  });
  it("transfers pelvis weight without a low-FPS snap and reaches the same support at every rate", () => {
    for (const fps of [10, 20, 30, 60]) {
      let shift = -0.035;
      for (let i = 0; i < fps; i++) shift = supportShiftAt(shift, 0.05, 1 / fps);
      expect(shift).toBeCloseTo(supportShiftAt(-0.035, 0.05, 1), 12);
    }
    expect(supportShiftAt(0, 0.05, 0.1)).toBeLessThan(0.05);
    expect(supportShiftAt(0.02, 0.05, Number.NaN)).toBe(0.02);
  });
});

it("retains the authored shot impact at 10/20/30/60 Hz with the elapsed clock", () => {
  for (const fps of [10, 20, 30, 60]) {
    const clock = new PlayerRigAnimationClock();
    const mixer = new AthletePoseBlender();
    mixer.sample(emptyPose(), 0, { clip: "idle", action: null, progress: 0 });
    let time = 0;
    for (let i = 0; i <= fps * 0.4; i++) {
      const dt = i === 0 ? 0 : 1 / fps;
      time += dt;
      const frame = resolvePlayerRigAnimationFrame(
        input({
          currentClip: "shotPower",
          selectedClip: "shotPower",
          currentTime: 0,
          deltaSeconds: clock.consume(dt, 0) ?? 0,
          selection: { action: "shotPower", actionDur: 1, actionT: 1 - time },
        }),
      );
      const target = { ...emptyPose(), legRPitch: -0.8, kneeR: -0.3, hipY: -0.03 };
      const actual = mixer.sample(target, dt, {
        clip: frame.clip,
        action: "shotPower",
        progress: frame.progress,
        supportFoot: "left",
      });
      expect(Object.values(actual).every(Number.isFinite)).toBe(true);
      if (i === fps * 0.4) {
        expect(frame.progress).toBeCloseTo(0.4, 12);
        expect(actual.legRPitch).toBeCloseTo(target.legRPitch, 12);
        expect(actual.kneeR).toBeCloseTo(target.kneeR, 12);
      }
    }
  }
});
