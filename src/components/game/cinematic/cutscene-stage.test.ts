import { describe, expect, it } from "vitest";
import {
  CUTSCENE_OPAQUE_MATTE,
  CUTSCENE_TRANSITION_TIMING,
  createCutsceneTransitionController,
  cutsceneMatteStyle,
} from "./cutscene-transition";

describe("cutscene presentation transitions", () => {
  it("invalidates delayed callbacks when a camera transition is interrupted", () => {
    const controller = createCutsceneTransitionController();
    const first = controller.start(false);
    const second = controller.start(false);

    expect(controller.advance(first.generation, "fading-in")).toBeNull();
    expect(controller.advance(second.generation, "fading-in")).toMatchObject({
      generation: second.generation,
      phase: "fading-in",
      durationMs: CUTSCENE_TRANSITION_TIMING.fadeInMs,
    });
    expect(controller.advance(first.generation, "stable")).toBeNull();

    const cancelled = controller.cancel(second.generation);
    expect(cancelled).toMatchObject({ phase: "cancelled" });
    expect(controller.advance(second.generation, "stable")).toBeNull();
  });

  it("keeps the illustrated environment visible during crossfades and honors reduced motion", () => {
    expect(cutsceneMatteStyle("stable", false, true)).toEqual({
      background: CUTSCENE_OPAQUE_MATTE,
      opacity: 0.58,
      transition: "none",
    });

    expect(cutsceneMatteStyle("fading-out", false, false).opacity).toBeLessThan(0.6);
    expect(cutsceneMatteStyle("stable", false, false).opacity).toBe(0);

    expect(cutsceneMatteStyle("fading-in", true, true)).toEqual({
      background: CUTSCENE_OPAQUE_MATTE,
      opacity: 0,
      transition: "none",
    });

    const controller = createCutsceneTransitionController();
    expect(controller.start(true)).toMatchObject({
      phase: "stable",
      opacity: 0,
      durationMs: 0,
    });
  });
});
