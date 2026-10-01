/** Cosmetic time: hidden/paused scenes do no work and a stalled frame cannot
 * fling the camera or a hand across the room. Never used by the match Worker. */
export function cinematicDelta(raw: number, stopped: boolean): number {
  return stopped || !Number.isFinite(raw) ? 0 : Math.max(0, Math.min(1 / 12, raw));
}

export function cinematicDetail(quality: string, hero: boolean) {
  return { high: quality !== "baixa" && hero, radial: hero && quality === "alta" ? 16 : 10 };
}
