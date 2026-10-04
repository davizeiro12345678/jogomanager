/** Cosmetic time: hidden/paused scenes do no work and a stalled frame cannot
 * fling the camera or a hand across the room. Never used by the match Worker. */
export function cinematicDelta(raw: number, stopped: boolean): number {
  return stopped || !Number.isFinite(raw) ? 0 : Math.max(0, Math.min(1 / 12, raw));
}

/**
 * The automatic profile begins at `media` to protect weak GPUs, but a medium
 * close-up must not turn its principal actor into a background mannequin.
 * Keep the expensive physical-material pass reserved for `alta`; give the
 * one or two narrative subjects a portrait mesh and articulated hands from
 * `media` upward. Extras retain the compact mesh at every tier.
 */
export function cinematicDetail(quality: string, hero: boolean) {
  const portrait = hero && quality !== "baixa";
  return {
    high: quality === "alta" && hero,
    portrait,
    radial: hero ? (quality === "alta" ? 16 : quality === "media" ? 12 : 8) : 8,
  };
}

/** Core count alone cannot identify a fast GPU. Auto starts balanced and can
 * decline quickly; explicitly selected detail levels remain available. */
export function cinematicInitialQuality(
  quality: "baixa" | "media" | "alta",
  mode: "auto" | "baixa" | "media" | "alta",
) {
  return mode === "auto" ? (quality === "alta" ? "media" : quality) : mode;
}

type CinematicQuality = "baixa" | "media" | "alta";

/** Match the cinematic PerformanceMonitor bounds: below 24 FPS declines and
 * at or above 45 FPS can safely promote one detail level. */
const CINEMATIC_AUTO_DECLINE_FPS = 24;
const CINEMATIC_AUTO_INCLINE_FPS = 45;

/** A sustained high-FPS sample earns one higher automatic detail level. */
export function cinematicAutoQualityOnIncline(quality: CinematicQuality): CinematicQuality {
  return quality === "baixa" ? "media" : "alta";
}

/** A sustained low-FPS sample sheds only one automatic detail level. */
export function cinematicAutoQualityOnDecline(quality: CinematicQuality): CinematicQuality {
  return quality === "alta" ? "media" : "baixa";
}

/** A monitor fallback only changes quality when its current FPS sample proves
 * a direction. Flip-flopping after a high-FPS incline must not force baixa. */
export function cinematicAutoQualityOnFallback(
  quality: CinematicQuality,
  fps: number,
): CinematicQuality {
  if (fps >= CINEMATIC_AUTO_INCLINE_FPS) return cinematicAutoQualityOnIncline(quality);
  if (fps < CINEMATIC_AUTO_DECLINE_FPS) return cinematicAutoQualityOnDecline(quality);
  return quality;
}

/** Use the already-created WebGL context; no extra GPU benchmark download. */
export function cinematicGpuQuality(quality: "baixa" | "media" | "alta", renderer: string) {
  return /Intel.*(?:Iris|UHD|HD Graphics)|SwiftShader|llvmpipe|Microsoft Basic Render/i.test(
    renderer,
  )
    ? "baixa"
    : quality;
}
