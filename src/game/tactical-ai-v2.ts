/**
 * Opt-in, deterministic tactical intelligence for newly created quick matches.
 *
 * Version 1 matches deliberately keep their old movement and replay behavior.
 * Decisions are pure and consume no RNG, wall clock, network, or mutable cache.
 */
import { halfTimePlan, type HalfStats, type HalfTimePlan } from "./ai-halftime";
import type { Tactics } from "./types";

const clamp = (value: number, lower: number, upper: number) =>
  Math.max(lower, Math.min(upper, value));

export interface OffsideTrapSituation {
  pressing: number;
  ballX: number;
  defenderLineX: number;
  attackDirection: 1 | -1;
  minute: number;
  scoreDifference: number;
}

/** Advance the entire defensive line only when a high press has safe space. */
export function coordinatedOffsideTrap(s: OffsideTrapSituation): number {
  if (
    s.pressing !== 2 ||
    ![s.ballX, s.defenderLineX, s.minute, s.scoreDifference].every(Number.isFinite) ||
    s.minute < 5 ||
    s.minute > 85 ||
    s.scoreDifference >= 2
  )
    return 0;
  const spaceAhead = (s.ballX - s.defenderLineX) * s.attackDirection;
  if (spaceAhead < 14 || spaceAhead > 39) return 0;
  return s.attackDirection * Math.min(3.5, 1.4 + (spaceAhead - 14) * 0.105);
}

export interface DefensiveCoverSituation {
  ballZ: number;
  targetZ: number;
  stamina: number;
  pressing: number;
  minute: number;
  scoreDifference: number;
  attackDirection: 1 | -1;
}

/** Bounded lateral compactness and coordinated late-match pressing. */
export function coordinatedDefensiveCover(s: DefensiveCoverSituation) {
  if (
    ![s.ballZ, s.targetZ, s.stamina, s.pressing, s.minute, s.scoreDifference].every(Number.isFinite)
  )
    return { lateral: 0, forward: 0, sprint: 1 };
  const stamina = clamp(s.stamina, 0, 100) / 100;
  const pressing = clamp(s.pressing, 0, 2);
  const urgency = s.minute > 75 && s.scoreDifference < 0 ? clamp((s.minute - 75) / 15, 0, 1) : 0;
  const lateral = clamp(
    (s.ballZ - s.targetZ) * (0.04 + pressing * 0.035) * (0.65 + stamina * 0.35),
    -3.25,
    3.25,
  );
  const forward = s.attackDirection * urgency * (1.2 + pressing * 0.65);
  const sprint = Math.min(1.2, 1 + urgency * 0.1 + (pressing === 2 ? 0.05 : 0));
  return { lateral, forward, sprint };
}

export interface PassingLaneSituation {
  ballX: number;
  ballZ: number;
  receiverX: number;
  receiverZ: number;
  defenderX: number;
  defenderZ: number;
  pressing: number;
  stamina: number;
}

/**
 * A midfielder shadows the corridor of a live opponent pass rather than
 * running blindly at the ball. Only nearby athletes can contest the corridor.
 * Outputs are bounded target offsets, never teleports or random samples.
 */
export function coordinatedPassingLaneCover(s: PassingLaneSituation) {
  const neutral = { forward: 0, lateral: 0, sprint: 1 };
  if (
    ![
      s.ballX,
      s.ballZ,
      s.receiverX,
      s.receiverZ,
      s.defenderX,
      s.defenderZ,
      s.pressing,
      s.stamina,
    ].every(Number.isFinite)
  )
    return neutral;
  const laneX = (s.ballX + s.receiverX) * 0.5;
  const laneZ = (s.ballZ + s.receiverZ) * 0.5;
  const dist = Math.hypot(laneX - s.defenderX, laneZ - s.defenderZ);
  if (dist > 18 || s.stamina < 15) return neutral;
  const influence =
    (0.11 + clamp(s.pressing, 0, 2) * 0.055) * (0.6 + clamp(s.stamina, 0, 100) * 0.004);
  return {
    forward: clamp((laneX - s.defenderX) * influence, -2.6, 2.6),
    lateral: clamp((laneZ - s.defenderZ) * influence, -3, 3),
    sprint: dist > 9 ? 1.1 : 1,
  };
}

export interface SupportRunSituation {
  holderX: number;
  holderZ: number;
  playerX: number;
  playerZ: number;
  opponentLineX: number;
  attackingDirection: 1 | -1;
  stamina: number;
  midfield: boolean;
}

/**
 * Versioned positional support: players form passing triangles, midfielders
 * provide the backward outlet, and forward runs avoid the opponent's line.
 * Existing V1 formation logic and RNG sequence stay completely untouched.
 */
export function coordinatedSupportRun(s: SupportRunSituation) {
  const neutral = { forward: 0, lateral: 0, sprint: 1 };
  if (
    ![s.holderX, s.holderZ, s.playerX, s.playerZ, s.opponentLineX, s.stamina].every(Number.isFinite)
  )
    return neutral;
  const distance = Math.hypot(s.playerX - s.holderX, s.playerZ - s.holderZ);
  if (distance < 4 || distance > 42 || s.stamina < 10) return neutral;
  const direction = s.attackingDirection;
  const ahead = (s.playerX - s.holderX) * direction;
  const pastLine = (s.playerX - s.opponentLineX) * direction;
  const onsideCorrection = pastLine > -2 ? -clamp(pastLine + 2, 0, 5) : 0;
  const desiredForward = s.midfield ? (ahead > 5 ? -2 : 1.4) : ahead < -8 ? 2 : 0.8;
  const flank = s.playerZ >= s.holderZ ? 1 : -1;
  const widthGap = Math.abs(s.playerZ - s.holderZ);
  return {
    forward: direction * clamp(desiredForward + onsideCorrection, -5, 3),
    lateral: flank * clamp((9 - widthGap) * 0.3, -1.7, 2.7),
    sprint: distance > 14 && s.stamina > 50 ? 1.1 : 1,
  };
}

/** Adaptive coach with bounded, explainable reactions to opposing patterns. */
export function coordinatedHalfTimePlan(
  own: HalfStats,
  foe: HalfStats,
  current: Tactics,
  opponent: Tactics,
): HalfTimePlan {
  const previous = halfTimePlan(own, foe, current, opponent);
  const tactics = { ...previous.tactics };
  const notes = [...previous.notes];
  const shotGap = foe.shots - own.shots;
  if (own.possession < 44 && shotGap >= 3) {
    const pressing = clamp(tactics.pressing + 1, 0, 2);
    const width = clamp(tactics.width - 1, 0, 2);
    // The legacy plan can already saturate both ranges. Still report the v2
    // reason when its trigger applies; otherwise an identical tactical state
    // inexplicably loses its explanation and the regression contract fails.
    tactics.pressing = pressing;
    tactics.width = width;
    notes.push("aproxima as linhas e pressiona a segunda bola");
  }
  if (own.goals < foe.goals && own.shots >= foe.shots + 3) {
    tactics.tempo = clamp(tactics.tempo + 1, 0, 2);
    tactics.mentality = clamp(tactics.mentality + 1, 0, 4);
    notes.push("acelera a circulação para transformar chances em gols");
  }
  return { tactics, notes };
}
