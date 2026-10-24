import type { CameraMode } from "./camera-modes";

/** Reduced motion keeps the whole pitch visible for automatic/cinema lenses.
 * Explicit manual viewpoints remain available without shake or moving orbit. */
export function accessibleMatchCamera(mode: CameraMode, reducedMotion: boolean): CameraMode {
  return reducedMotion && (mode === "broadcast" || mode === "director" || mode === "cinematic")
    ? "tactical"
    : mode;
}
