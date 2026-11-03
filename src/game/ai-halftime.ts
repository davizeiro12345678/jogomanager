/**
 * Half-time reading of the opponent for CPU-managed teams. Deterministic: it
 * only looks at first-half numbers and tactics, so replays stay identical.
 */
import type { Tactics } from "./types";

export interface HalfStats {
  goals: number;
  shots: number;
  /** Share of first-half possession, 0..100. */
  possession: number;
}

export interface HalfTimePlan {
  tactics: Tactics;
  /** Short reasons, for match commentary. */
  notes: string[];
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export function halfTimePlan(own: HalfStats, foe: HalfStats, current: Tactics, foeTactics: Tactics): HalfTimePlan {
  const t = { ...current };
  const notes: string[] = [];
  const diff = own.goals - foe.goals;

  // Opponent owns the ball: press higher to win it back.
  if (foe.possession >= 58 && t.pressing < 2) {
    t.pressing += 1;
    notes.push("aperta a marcação para recuperar a bola");
  }
  // Opponent creating far more: drop deeper and close the middle.
  if (foe.shots >= 6 && foe.shots >= own.shots * 2) {
    t.mentality = clamp(t.mentality - 1, 0, 4);
    t.width = clamp(t.width - 1, 0, 2);
    notes.push("recua e fecha o meio");
  }
  // Opponent attacks wide: widen the block to cover the flanks.
  if (foeTactics.width >= 2 && t.width < 2 && !notes.includes("recua e fecha o meio")) {
    t.width += 1;
    notes.push("abre a linha para fechar as pontas");
  }
  // Opponent presses high: go direct over the press.
  if (foeTactics.pressing >= 2 && t.tempo < 2) {
    t.tempo += 1;
    notes.push("joga mais direto para fugir da pressão");
  }
  // Scoreline: chase when losing, protect when winning by two.
  if (diff < 0) {
    t.mentality = clamp(t.mentality + 1, 0, 4);
    notes.push("se lança ao ataque");
  } else if (diff >= 2) {
    t.mentality = clamp(t.mentality - 1, 0, 4);
    notes.push("administra a vantagem");
  }
  return { tactics: t, notes };
}
