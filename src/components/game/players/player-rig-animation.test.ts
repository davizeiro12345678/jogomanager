import { describe, expect, it } from "vitest";
import { GOAL_PRESENTATION_SECONDS } from "@/game/goal-choreography";
import {
  resolvePlayerRigAnimationFrame,
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
