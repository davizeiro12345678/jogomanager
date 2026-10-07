import { lazy, useEffect } from "react";
import { reportSilent } from "@/lib/silent-errors";

let stage: Promise<typeof import("../CinematicStage3D")> | undefined;
export const CINEMATIC_RETRY_DELAYS_MS = [250, 750, 2_000] as const;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function loadWithRetry<T>(
  importer: () => Promise<T>,
  sleep: (ms: number) => Promise<void> = wait,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= CINEMATIC_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      return await importer();
    } catch (error) {
      lastError = error;
      const delay = CINEMATIC_RETRY_DELAYS_MS[attempt];
      if (delay === undefined) break;
      await sleep(delay);
    }
  }
  throw lastError;
}

/** The dialogue shell never waits for Three, rigs or the lens bundle. */
export function preloadCinematicStage() {
  stage ??= loadWithRetry(() => import("../CinematicStage3D")).catch((error: unknown) => {
    stage = undefined;
    reportSilent("cutscene.stage", error, {
      classification: "degradation",
      feature: "cinematic-stage",
      phase: "chunk-load",
      dedupeKey: `cinematic-stage:${error instanceof Error ? error.message : String(error)}`,
    });
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
