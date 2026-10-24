/** Cosmetic work only; the authoritative match clock never uses this gate. */
export class CinematicPoseBudget {
  private elapsed = 0;
  private visible = true;
  sample(raw: number, visible: boolean, principal: boolean, force = false): number | null {
    const dt = Number.isFinite(raw) ? Math.max(0, Math.min(1 / 12, raw)) : 0;
    this.elapsed += dt;
    const entering = visible && !this.visible;
    this.visible = visible;
    const interval = visible ? (principal ? 0 : 1 / 30) : 1 / 8;
    if (!force && !entering && (this.elapsed <= 0 || this.elapsed + 1e-9 < interval)) return null;
    const step = Math.min(1 / 12, this.elapsed);
    this.elapsed = 0;
    return step;
  }
}

/** Deliberately padded for sitting, reaching, props and secondary motion. */
export function cinematicActorBounds(height: number) {
  const h = Number.isFinite(height) ? Math.max(1.4, Math.min(2.2, height)) : 1.8;
  return { centerY: h * 0.5, radius: h * 1.15 + 0.25 };
}
