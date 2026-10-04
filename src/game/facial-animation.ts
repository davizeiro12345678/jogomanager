import type { FaceExpression } from "./animation-extra3";

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : 0));
const fract = (v: number) => v - Math.floor(v);
const noise = (seed: number, index: number) =>
  fract(Math.sin(seed * 17.19 + index * 78.233) * 43758.5453);
const smooth = (v: number) => {
  const x = clamp(v, 0, 1);
  return x * x * (3 - 2 * x);
};

export interface FacialPose {
  jaw: number;
  lidClosure: number;
  eyeX: number;
  eyeY: number;
}
export const emptyFacialPose = (): FacialPose => ({ jaw: 0, lidClosure: 0.001, eyeX: 0, eyeY: 0 });

/** The upper lid sweeps down and the lower lid rises around orbital hinges. */
export function eyelidRotationFor(lidClosure: number, upper: boolean): number {
  const closure = clamp(lidClosure, 0, 1);
  return closure * (upper ? 0.58 : -0.34);
}

/** Positive head pitch looks down. Aerial balls must lift the gaze even nearby. */
export function ballGazePitch(distance: number, ballHeight: number, eyeHeight: number): number {
  return clamp(Math.atan2(eyeHeight - ballHeight, Math.max(0.4, distance)) * 0.55, -0.38, 0.28);
}

/** Deterministic micro-movement sampled from match time, independent of FPS.
 * A reusable output keeps the close-up animation free of frame allocations. */
export function facialPoseAt(
  time: number,
  seed: number,
  expression: FaceExpression,
  gazeYaw: number,
  gazePitch: number,
  effort: number,
  out: FacialPose = emptyFacialPose(),
): FacialPose {
  const t = Number.isFinite(time) ? Math.max(0, time) : 0;
  const actor = Math.abs(Number.isFinite(seed) ? seed : 0) % 65536;
  const period = (3.2 + noise(actor, 1) * 2.6) * clamp(expression.blinkRate, 0.5, 2.8);
  const elapsed = (t + noise(actor, 2) * period) % period;
  // Closing is faster than reopening; tired eyelids retain a modest droop.
  const blink = elapsed < 0.055 ? smooth(elapsed / 0.055) : 1 - smooth((elapsed - 0.055) / 0.12);
  const rest = clamp((1 - expression.lids) * 0.55, 0.001, 0.32);
  out.lidClosure = clamp(Math.max(rest, blink), 0.001, 1);
  const breathing =
    Math.sin(t * (3.5 + clamp(effort, 0, 1) * 2.5) + actor) * 0.012 * clamp(effort, 0, 1);
  const talking =
    expression.jaw > 0.3 && expression.jaw < 0.7 ? Math.sin(t * 9 + actor) * 0.015 : 0;
  out.jaw = clamp(0.015 + expression.jaw * 0.24 + breathing + talking, 0.008, 0.29);
  // Short fixation intervals with small saccades; sustained attention follows the ball.
  const fixation = t / (0.24 + noise(actor, 3) * 0.16);
  const index = Math.floor(fixation),
    blend = smooth(fract(fixation) / 0.18);
  const wander = 1 - clamp(expression.gaze, 0, 1);
  const x = noise(actor, index * 2 + 8) * (1 - blend) + noise(actor, index * 2 + 10) * blend;
  const y = noise(actor, index * 2 + 9) * (1 - blend) + noise(actor, index * 2 + 11) * blend;
  out.eyeX = clamp(gazeYaw * 0.5 * expression.gaze + (x - 0.5) * 0.65 * wander, -0.85, 0.85);
  out.eyeY = clamp(-gazePitch * 1.8 * expression.gaze + (y - 0.5) * 0.5 * wander, -0.7, 0.7);
  return out;
}
