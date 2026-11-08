export type CutsceneTransitionPhase = "stable" | "fading-out" | "fading-in" | "cancelled";

export interface CutsceneTransitionSnapshot {
  generation: number;
  phase: CutsceneTransitionPhase;
  opacity: 0 | 1;
  durationMs: number;
}

export const CUTSCENE_TRANSITION_TIMING = {
  fadeOutMs: 140,
  fadeInMs: 180,
} as const;

export const CUTSCENE_OPAQUE_MATTE = "rgb(3 7 11)";

function transitionSnapshot(
  generation: number,
  phase: CutsceneTransitionPhase,
): CutsceneTransitionSnapshot {
  return {
    generation,
    phase,
    opacity: phase === "fading-out" ? 1 : 0,
    durationMs:
      phase === "fading-out"
        ? CUTSCENE_TRANSITION_TIMING.fadeOutMs
        : phase === "fading-in"
          ? CUTSCENE_TRANSITION_TIMING.fadeInMs
          : 0,
  };
}

/**
 * A transition token makes delayed visual callbacks disposable. The match
 * result never crosses this boundary: this controller only gates presentation.
 */
export function createCutsceneTransitionController() {
  let generation = 0;
  let phase: CutsceneTransitionPhase = "stable";

  return {
    start(reducedMotion: boolean) {
      generation += 1;
      phase = reducedMotion ? "stable" : "fading-out";
      return transitionSnapshot(generation, phase);
    },
    advance(token: number, nextPhase: "fading-in" | "stable") {
      if (token !== generation || phase === "cancelled") return null;
      if (nextPhase === "fading-in" && phase !== "fading-out") return null;
      if (nextPhase === "stable" && phase !== "fading-in") return null;
      phase = nextPhase;
      return transitionSnapshot(generation, phase);
    },
    cancel(token?: number) {
      if (token !== undefined && token !== generation) return null;
      const cancelledGeneration = generation;
      generation += 1;
      phase = "cancelled";
      return transitionSnapshot(cancelledGeneration, phase);
    },
  };
}

export function cutsceneMatteStyle(
  phase: CutsceneTransitionPhase,
  reducedMotion: boolean,
  pending: boolean,
) {
  const opaque = !reducedMotion && (pending || phase === "fading-out");
  const fadingIn = !reducedMotion && phase === "fading-in";
  return {
    background: CUTSCENE_OPAQUE_MATTE,
    opacity: opaque ? 1 : 0,
    transition: fadingIn
      ? `opacity ${CUTSCENE_TRANSITION_TIMING.fadeInMs}ms cubic-bezier(0.22, 1, 0.36, 1)`
      : "none",
  } as const;
}
