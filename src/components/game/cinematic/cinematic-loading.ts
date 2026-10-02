import { lazy, useEffect } from "react";

let stage: Promise<typeof import("../CinematicStage3D")> | undefined;

/** The dialogue shell never waits for Three, rigs or the lens bundle. */
export function preloadCinematicStage() {
  stage ??= import("../CinematicStage3D").catch((error: unknown) => {
    stage = undefined;
    throw error;
  });
  return stage;
}

export const LazyCinematicStage = lazy(() =>
  preloadCinematicStage().then((module) => ({ default: module.CinematicStage3D })),
);

/** Prepare likely cutscenes after the host screen has had time to paint. */
export function useCinematicPreload(enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } })
      .connection;
    if (connection?.saveData) return;
    const preload = () => {
      if (!document.hidden) void preloadCinematicStage().catch(() => undefined);
    };
    if (typeof window.requestIdleCallback === "function") {
      const idle = window.requestIdleCallback(preload, { timeout: 2500 });
      return () => window.cancelIdleCallback(idle);
    }
    const timer = window.setTimeout(preload, 1000);
    return () => window.clearTimeout(timer);
  }, [enabled]);
}
