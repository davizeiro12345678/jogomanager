import type { AthleteHairMotionInput, AthleteLooseHairStyle } from "./athlete-secondary-motion";
import { graphicsRendererClass } from "./graphics-renderer-metadata";

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

/** Feed a portrait's loose locks from the same pose being shown on screen. */
export function cinematicHairMotionDriveAt({
  time,
  seed,
  dt,
  moving,
  hipPitch,
  hipYaw,
  headYaw,
  style,
}: {
  time: number;
  seed: number;
  dt: number;
  moving: boolean;
  hipPitch: number;
  hipYaw: number;
  headYaw: number;
  style: AthleteLooseHairStyle;
}): AthleteHairMotionInput {
  const phase = time * 5.2 + (seed % 17) * 0.37;
  return {
    dt,
    speed: moving ? 4.2 : 0,
    accelerationLean: moving ? hipPitch * 0.45 + Math.sin(phase * 0.5) * 0.025 : 0,
    turnRate: hipYaw * 1.4 + headYaw * 0.18,
    phase,
    style,
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
  return graphicsRendererClass(renderer) === "software" ? "baixa" : quality;
}

/** Close shots keep the actor's anatomy. Shed lens passes before pixel work. */
export function cinematicPresentationBudget(quality: CinematicQuality, rawStage: number) {
  const stage = Number.isFinite(rawStage) ? Math.max(0, Math.min(4, Math.floor(rawStage))) : 0;
  return {
    stage,
    resolutionScale: stage >= 4 ? 0.76 : stage >= 3 ? 0.88 : 1,
    lens: stage >= 2 ? ("off" as const) : stage >= 1 ? ("media" as const) : quality,
    actorQuality: quality,
  };
}

/** Sustained evidence changes one lever at a time; a single stall does not
 * rebuild a portrait, and recovery is slower than shedding work. */
export class CinematicPressureController {
  stage = 0;
  private slow = 0;
  private healthy = 0;
  private cooldown = 0;
  sample(fps: number, p95: number): number {
    if (!Number.isFinite(fps) || !Number.isFinite(p95) || fps <= 0 || p95 <= 0) return this.stage;
    if (this.cooldown > 0) {
      this.cooldown -= 1;
      return this.stage;
    }
    if (fps < 45 || p95 > 28) {
      this.healthy = 0;
      if (++this.slow >= 2) {
        this.stage = Math.min(4, this.stage + 1);
        this.slow = 0;
        this.cooldown = 2;
      }
    } else {
      this.slow = 0;
      if (fps >= 55 && p95 <= 22 && ++this.healthy >= 8) {
        this.stage = Math.max(0, this.stage - 1);
        this.healthy = 0;
        this.cooldown = 2;
      }
      if (fps < 55 || p95 > 22) this.healthy = 0;
    }
    return this.stage;
  }
}
