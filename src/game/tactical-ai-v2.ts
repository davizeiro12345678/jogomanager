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
  ) return 0;
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
    ![s.ballZ, s.targetZ, s.stamina, s.pressing, s.minute, s.scoreDifference].every(
      Number.isFinite,
    )
  ) return { lateral: 0, forward: 0, sprint: 1 };
  const stamina = clamp(s.stamina, 0, 100) / 100;
  const pressing = clamp(s.pressing, 0, 2);
  const urgency = s.minute > 75 && s.scoreDifference < 0
    ? clamp((s.minute - 75) / 15, 0, 1)
    : 0;
  const lateral = clamp(
    (s.ballZ - s.targetZ) * (0.04 + pressing * 0.035) * (0.65 + stamina * 0.35),
    -3.25,
    3.25,
  );
  const forward = s.attackDirection * urgency * (1.2 + pressing * 0.65);
  const sprint = Math.min(1.2, 1 + urgency * 0.1 + (pressing === 2 ? 0.05 : 0));
  return { lateral, forward, sprint };
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
    if (pressing !== tactics.pressing || width !== tactics.width) {
      tactics.pressing = pressing;
      tactics.width = width;
      notes.push("aproxima as linhas e pressiona a segunda bola");
    }
  }
  if (own.goals < foe.goals && own.shots >= foe.shots + 3) {
    tactics.tempo = clamp(tactics.tempo + 1, 0, 2);
    tactics.mentality = clamp(tactics.mentality + 1, 0, 4);
    notes.push("acelera a circulação para transformar chances em gols");
  }
  return { tactics, notes };
}
