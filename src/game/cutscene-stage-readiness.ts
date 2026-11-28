import { createCeremonyCompletion } from "./ceremony-completion";

/** Maximum wait for an autoplay cutscene's WebGL stage to become interactive.
 * The scene continues in 2D; the match simulation is never forced forward. */
export const AUTO_CUTSCENE_3D_READINESS_TIMEOUT_MS = 12_000;

export type CutsceneStageFallbackReason = "load-error" | "timeout";

export type CutsceneStageReadiness = {
  autoPlay: boolean;
  mode: "3d" | "2d";
  stageReady: boolean;
  paused: boolean;
  hidden: boolean;
  loadFailed: boolean;
  onFallback: (reason: CutsceneStageFallbackReason) => void;
};

/**
 * Fail open only for the presentation layer of autoplay cutscenes.
 * Cancel the deadline when the stage is ready, the tab is hidden, the user
 * pauses, or the component unmounts. Manual cinematics remain user-controlled.
 */
export function armCutsceneStageReadinessFallback(
  state: CutsceneStageReadiness,
): { cancel(): void } | null {
  if (!state.autoPlay || state.mode !== "3d" || state.stageReady || state.paused || state.hidden) {
    return null;
  }

  if (state.loadFailed) {
    state.onFallback("load-error");
    return null;
  }

  return createCeremonyCompletion(
    () => state.onFallback("timeout"),
    AUTO_CUTSCENE_3D_READINESS_TIMEOUT_MS,
  );
}
