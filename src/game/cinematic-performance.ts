/** Cosmetic time: hidden/paused scenes do no work and a stalled frame cannot
 * fling the camera or a hand across the room. Never used by the match Worker. */
export function cinematicDelta(raw: number, stopped: boolean): number {
  return stopped || !Number.isFinite(raw) ? 0 : Math.max(0, Math.min(1 / 12, raw));
}

export function cinematicDetail(quality: string, hero: boolean) {
  return { high: quality === "alta" && hero, radial: hero ? (quality === "alta" ? 16 : 10) : 8 };
}

/** Core count alone cannot identify a fast GPU. Auto starts balanced and can
 * decline quickly; explicitly selected detail levels remain available. */
export function cinematicInitialQuality(
  quality: "baixa" | "media" | "alta",
  mode: "auto" | "baixa" | "media" | "alta",
) {
  return mode === "auto" ? (quality === "alta" ? "media" : quality) : mode;
}

/** Use the already-created WebGL context; no extra GPU benchmark download. */
export function cinematicGpuQuality(quality: "baixa" | "media" | "alta", renderer: string) {
  return /Intel.*(?:Iris|UHD|HD Graphics)|SwiftShader|llvmpipe|Microsoft Basic Render/i.test(
    renderer,
  )
    ? "baixa"
    : quality;
}
