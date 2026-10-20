import type { DetailedAttributes } from "./attributes";
import type { AttributeSource } from "./player-development";
import { buildAttrs } from "./player-physique";
import { normalizedPlayerRatings, ratingValue } from "./player-rating-inputs";
import { makeRng } from "./rng";
import type { Player } from "./types";

/** Shared match/profile projection; a saved base and explicit source remain authoritative. */
export function projectedAttribute(
  player: Player,
  key: keyof DetailedAttributes,
  initial: number,
  source?: AttributeSource,
): number {
  const delta = source ? source.attrDeltas?.[player.id] : player.developmentDelta;
  const move = delta?.[key];
  if (typeof move === "number" && Number.isFinite(move))
    return player.developmentBase?.rulesVersion === 2
      ? ratingValue(initial + move)
      : Math.max(20, Math.min(99, Math.round(initial + move)));
  if (!player.developmentBase && Number.isFinite(player.detailedAttributes?.[key]))
    return ratingValue(player.detailedAttributes![key]);
  return initial;
}

/** The four detailed inputs used by a match, without club history or UI metadata. */
export function matchProfileAttributes(player: Player, source?: AttributeSource) {
  // buildAttrs is the first consumer of this same stream in baseProfileFor.
  // Frozen profiles keep their original seed, including rules-2/imported identities.
  const initial =
    player.developmentBase?.profile?.attrs ??
    buildAttrs(normalizedPlayerRatings(player), makeRng(`profile-${player.id}-${player.name}`));
  return {
    consistency: projectedAttribute(player, "consistency", initial.consistency, source),
    technique: projectedAttribute(player, "technique", initial.technique, source),
    teamwork: projectedAttribute(player, "teamwork", initial.teamwork, source),
    anticipation: projectedAttribute(player, "anticipation", initial.anticipation, source),
  };
}
