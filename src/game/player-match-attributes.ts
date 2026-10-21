import type { DetailedAttributes } from "./attributes";
import type { AttributeSource } from "./player-development";
import { buildAttrs } from "./player-physique";
import { normalizedPlayerRatings, ratingValue } from "./player-rating-inputs";
import { makeRng } from "./rng";
import type { Player } from "./types";

type MatchProfile = Pick<
  DetailedAttributes,
  "consistency" | "technique" | "teamwork" | "anticipation"
>;

// Match construction repeatedly sees the same immutable ratings. The complete
// profile used to cache this generation; extracting its lightweight projection
// must retain that reuse without importing profile history or the club catalog.
// Only generated inputs are cached: imported values and career deltas below
// must be resolved on every call, including an explicitly empty source.
const generatedProfiles = new Map<string, MatchProfile>();
const MAX_GENERATED_PROFILES = 2048;

function generatedMatchProfile(player: Player): MatchProfile {
  const key = JSON.stringify([
    player.id,
    player.name,
    player.pos,
    player.age,
    player.ovr,
    player.pace,
    player.shooting,
    player.passing,
    player.defending,
    player.physical,
  ]);
  const cached = generatedProfiles.get(key);
  if (cached) return cached;
  const { consistency, technique, teamwork, anticipation } = buildAttrs(
    normalizedPlayerRatings(player),
    makeRng(`profile-${player.id}-${player.name}`),
  );
  const generated = { consistency, technique, teamwork, anticipation };
  // Bounded FIFO; changing a player's ratings creates a new key, so training,
  // imports and editor updates cannot return stale attributes.
  if (generatedProfiles.size >= MAX_GENERATED_PROFILES)
    generatedProfiles.delete(generatedProfiles.keys().next().value!);
  generatedProfiles.set(key, generated);
  return generated;
}

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
  const initial = player.developmentBase?.profile?.attrs ?? generatedMatchProfile(player);
  return {
    consistency: projectedAttribute(player, "consistency", initial.consistency, source),
    technique: projectedAttribute(player, "technique", initial.technique, source),
    teamwork: projectedAttribute(player, "teamwork", initial.teamwork, source),
    anticipation: projectedAttribute(player, "anticipation", initial.anticipation, source),
  };
}
