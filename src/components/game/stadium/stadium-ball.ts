import type { SimView } from "@/game/sim-contracts";

/** Visual-only presentation. The match simulation stays authoritative. */
export function presentationBall(sim: SimView) {
  return sim.visualBall ?? sim.ball;
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
