/**
 * Ten deterministic physics refinements for the 3D match.
 *
 * Pure functions only (no randomness, no React/three): MatchSim and the Rapier
 * ball authority call them with values they already own, so seeds, replays and
 * server re-simulation stay reproducible.
 */
import type { WeatherKind } from "./sim-rules";

const clamp = (n: number, lo: number, hi: number) =>
  Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : lo;

/** 1. Shot technique: each strike style has its own power, loft and spin. */
export type ShotTechnique =
  | "shotPower"
  | "shot"
  | "shotPlaced"
  | "chip"
  | "volley"
  | "bicycle";

export interface ShotProfile {
  power: number;
  spin: number;
  /** Extra arrival height (m) relative to the decided target. */
  loft: number;
}

const SHOT_PROFILES: Record<ShotTechnique, ShotProfile> = {
  shotPower: { power: 1.12, spin: 0.55, loft: 0 },
  shot: { power: 1, spin: 1, loft: 0 },
  shotPlaced: { power: 0.82, spin: 1.7, loft: 0 },
  chip: { power: 0.6, spin: 0.4, loft: 1.1 },
  volley: { power: 1.08, spin: 0.7, loft: 0.15 },
  bicycle: { power: 0.9, spin: 0.5, loft: 0.3 },
};

export function shotProfile(technique: ShotTechnique): ShotProfile {
  return SHOT_PROFILES[technique];
}

/** 2. Fatigue costs strike power: below 55 stamina a shot loses up to 12%. */
export function fatigueStrikeFactor(stamina: number): number {
  return 1 - clamp(55 - stamina, 0, 43) * 0.0028;
}

/** 3. Strength duels: the heavier, stronger body yields less ground. */
export function bodyContactShare(
  aPhysical: number,
  aKg: number | undefined,
  bPhysical: number,
  bKg: number | undefined,
): number {
  const strength = (physical: number, kg: number | undefined) =>
    clamp(kg ?? 78, 45, 130) * (0.7 + clamp(physical, 0, 100) * 0.006);
  const a = strength(aPhysical, aKg);
  const b = strength(bPhysical, bKg);
  // share of the overlap A absorbs; never fully immovable
  return clamp(b / (a + b), 0.2, 0.8);
}

/** 4. Pitch wear: a wet pitch churns up and loses grip as the match goes on. */
export function pitchTraction(weather: WeatherKind, matchSeconds: number): number {
  if (weather !== "rain") return 1;
  const wear = clamp(matchSeconds / (90 * 60), 0, 1.4);
  return 0.72 - wear * 0.06;
}

/** 5. Quadratic air drag (m/s² per (m/s)²) — fast shots lose pace in flight. */
export const QUADRATIC_AIR_DRAG = 0.0055;
export function quadraticDragDeceleration(speed: number): number {
  const v = clamp(speed, 0, 60);
  return QUADRATIC_AIR_DRAG * v * v;
}

/** 6. Rolling stop: below this speed a grounded ball settles instead of creeping. */
export const ROLLING_STOP_SPEED = 0.35;
export function settlesOnTurf(speed: number, height: number): boolean {
  return speed < ROLLING_STOP_SPEED && height <= 0.13;
}

/** 7. Block rebound: slides absorb more, and heavy defenders deaden the ball. */
export function blockRestitution(slide: boolean, defenderKg: number | undefined): number {
  const mass = clamp(defenderKg ?? 78, 45, 130);
  return (slide ? 0.75 : 1) * (1.1 - (mass - 45) / 425);
}

/** 8. Goalkeeper parry: rebound scales with shot pace and the keeper's strength. */
export function parryReboundSpeed(base: number, shotSpeed: number, gkPhysical: number): number {
  const pace = clamp(shotSpeed / 30, 0.5, 1.4);
  const hands = 1.15 - clamp(gkPhysical, 0, 100) * 0.003;
  return base * pace * hands;
}

/** 9. Header energy: incoming cross pace and jumping power add to the header. */
export function headerPower(base: number, incomingSpeed: number, physical: number): number {
  return base + clamp(incomingSpeed, 0, 30) * 0.18 + clamp(physical, 0, 100) * 0.03;
}

/** 10. First-touch spill: a hard or wet ball bounces further off a bad touch. */
export function firstTouchSpill(base: number, incomingSpeed: number, weather: WeatherKind): number {
  const pace = 0.7 + clamp(incomingSpeed, 0, 34) * 0.02;
  return base * pace * (weather === "rain" ? 1.18 : 1);
}
