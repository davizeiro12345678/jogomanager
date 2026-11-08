import { bounded, teamDay } from "./match-probability";
import { makeRng } from "./rng";
import type { Player } from "./types";
import { matchProfileAttributes } from "./player-match-attributes";
import type { AttributeSource } from "./player-development";
import { effectivePlayer } from "./player-effective";
import { normalizedPlayerRatings } from "./player-rating-inputs";

/**
 * Admission gate for a starting XI. This deliberately does no repair or
 * random work: invalid saves must be rejected before MatchSim is constructed.
 */
export function isMatchEligible(players: readonly Player[], expectedClubId?: string): boolean {
  if (!Array.isArray(players) || players.length !== 11) return false;

  const ids = new Set<string>();
  const clubId = expectedClubId ?? players[0]?.clubId;
  if (typeof clubId !== "string") return false;
  let hasGoalkeeper = false;
  for (const player of players) {
    if (
      !player ||
      typeof player.id !== "string" ||
      player.clubId !== clubId ||
      ids.has(player.id) ||
      player.injuryWeeks !== 0 ||
      player.suspended !== false
    )
      return false;
    ids.add(player.id);
    hasGoalkeeper ||= player.pos === "GK";
  }
  return hasGoalkeeper;
}

/** Select fit starters without turning recent results into permanent overall changes. */
export function selectionRating(p: Player, source?: AttributeSource): number {
  p = normalizedPlayerRatings(effectivePlayer(p, source));
  return (
    p.ovr +
    (bounded(p.form, 60, 0, 100) - 60) * 0.035 -
    Math.max(0, 85 - bounded(p.condition, 100, 0, 100)) * 0.18
  );
}

/** Temporary match attributes; persisted ratings, imported records and development stay intact. */
export function matchAttributes(
  p: Player,
  seed: string,
  side: "home" | "away",
  source?: AttributeSource,
) {
  p = normalizedPlayerRatings(effectivePlayer(p, source));
  const rnd = makeRng(`player-day:${seed}:${side}:${p.id}`);
  const detailed = matchProfileAttributes(p, source);
  const consistency =
    p.personality === "temperamental" ? 1.4 : p.personality === "profissional" ? 0.7 : 1;
  const regularity = Math.max(0.8, Math.min(1.2, 1 - (detailed.consistency - 65) * 0.005));
  const variation = teamDay(seed, side) + (rnd() + rnd() - 1) * 3 * consistency * regularity;
  const readiness =
    (bounded(p.form, 60, 0, 100) - 60) * 0.045 +
    (bounded(p.morale, 70, 0, 100) - 70) * 0.02 -
    Math.max(0, 85 - bounded(p.condition, 100, 0, 100)) * 0.12;
  const technical = (v: number) => bounded(v + variation + readiness, 60, 35, 99);
  return {
    pace: bounded(p.pace + (variation + readiness) * 0.25, 60, 35, 99),
    shooting: technical(
      p.shooting + Math.max(-1.5, Math.min(1.5, (detailed.technique - p.shooting) * 0.12)),
    ),
    passing: technical(
      p.passing + Math.max(-1.5, Math.min(1.5, (detailed.teamwork - p.passing) * 0.12)),
    ),
    defending: technical(
      p.defending + Math.max(-1.5, Math.min(1.5, (detailed.anticipation - p.defending) * 0.12)),
    ),
    physical: technical(p.physical),
    stamina: bounded(p.condition, 100, 12, 100),
  };
}
