import type { SimView } from "@/game/sim-contracts";

/** Visual-only presentation. The match simulation stays authoritative. */
export function presentationBall(sim: SimView) {
  return sim.visualBall ?? sim.ball;
}


/**
 * The Worker/renderer already interpolates `visualBall`. Applying a second
 * camera-side spring makes the ball visibly lag behind the player's boot.
 * The same applies while a player possesses the ball: ball-foot contact must
 * follow the authoritative rendered position, not a trailing approximation.
 * Only bare canonical, free-ball positions retain legacy smoothing.
 */
export function ballHorizontalBlend(
  deltaSeconds: number,
  opts: { hasVisualBall: boolean; isHeld: boolean; discontinuity: boolean },
): number {
  if (opts.hasVisualBall || opts.isHeld || opts.discontinuity) return 1;
  const dt = Number.isFinite(deltaSeconds)
    ? Math.max(0, Math.min(deltaSeconds, 0.05))
    : 0;
  return 1 - Math.exp(-42 * dt);
}

const BALL_RADIUS = 0.12;

/**
 * Stadium lights cast a diffused contact shadow. As the ball rises the
 * penumbra grows and loses contrast; it must not shrink into a sharp disk.
 * Clamped, finite values also prevent invalid replay frames from polluting
 * the Three.js instance matrix or material opacity.
 */
export function ballShadowAppearance(height: number): { scale: number; opacity: number } {
  const elevation = Number.isFinite(height) ? Math.max(0, height - BALL_RADIUS) : 0;
  return {
    scale: 1 + Math.min(2.1, elevation * 0.3),
    opacity: 0.34 / (1 + elevation * 0.65),
  };
}
