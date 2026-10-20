import type { AttrDelta, DetailedAttributes, PlayerProfile } from "./attributes";
import type { CareerState, Player, TrainingFocus } from "./types";
import { interpolateAnchors } from "./economy";
import { normalizedPlayerRatings } from "./player-rating-inputs";
import { effectivePlayer } from "./player-effective";
export { DEVELOPMENT_OVR_WEIGHTS, deltaFor, effectivePlayer } from "./player-effective";

export type CoreSkill = "pace" | "shooting" | "passing" | "defending" | "physical";
export interface DevelopmentBase {
  rulesVersion: 1 | 2;
  ovr: number;
  core: Record<CoreSkill, number>;
  profile: PlayerProfile;
}
export type AttributeSource = Pick<CareerState, "attrDeltas" | "developmentRulesVersion">;

const precise = (v: number) => Math.round(v * 1e6) / 1e6;

/** Rounded UI view only; training, market quotes and match calculations keep the precise projection. */
export function playerForDisplay(p: Player, source?: AttributeSource): Player {
  const effective = effectivePlayer(p, source);
  return {
    ...effective,
    ovr: Math.round(effective.ovr),
    pace: Math.round(effective.pace),
    shooting: Math.round(effective.shooting),
    passing: Math.round(effective.passing),
    defending: Math.round(effective.defending),
    physical: Math.round(effective.physical),
  };
}

export function trainingAgeFactor(age: number): number {
  return interpolateAnchors(Number.isFinite(age) ? age : 26, [
    [18, 1.15],
    [21, 1.08],
    [26, 1],
    [31, 0.9],
    [35, 0.76],
    [38, 0.65],
  ]);
}

/** Shared response for drills and weekly development; all non-age factors retain their rules. */
export function developmentResponse(
  p: Player,
  intensity: 0 | 1 | 2,
  profile: PlayerProfile,
): number {
  const savedPotential = p.potential;
  p = normalizedPlayerRatings(p);
  const condition = Math.max(0.45, Math.min(1.1, p.condition / 82));
  const cap = Number.isFinite(savedPotential)
    ? savedPotential!
    : Math.min(99, (p.developmentBase?.ovr ?? p.ovr) + 6);
  const headroom = Math.max(0.25, Math.min(1.12, (cap - p.ovr + 8) / 12));
  const personality =
    profile.personality === "profissional"
      ? 1.14
      : profile.personality === "determinado"
        ? 1.1
        : profile.personality === "líder"
          ? 1.05
          : profile.personality === "temperamental"
            ? 0.9
            : 1;
  return (
    trainingAgeFactor(p.age) *
    condition *
    headroom *
    personality *
    (intensity === 0 ? 0.78 : intensity === 2 ? 1.16 : 1)
  );
}

export const FOCUS_ATTRIBUTES: Record<TrainingFocus, readonly (keyof DetailedAttributes)[]> = {
  ataque: ["finishing", "longShots", "composure", "offBall", "technique"],
  defesa: ["marking", "tackling", "interceptions", "anticipation", "positioning"],
  fisico: ["strength", "stamina", "naturalFitness", "injuryResistance", "balance"],
  tecnica: ["passing", "vision", "firstTouch", "ballControl", "decisions"],
  equilibrado: ["pace", "acceleration", "agility", "teamwork", "workRate"],
};

/** Limit only the proposed increment; existing saved deltas are never erased. */
export function limitedDevelopmentDelta(
  p: Player,
  state: CareerState,
  changes: AttrDelta,
): AttrDelta {
  const existing = { ...(state.attrDeltas?.[p.id] ?? {}) };
  if (!p.developmentBase || p.developmentBase.rulesVersion !== 2) return existing;
  const before = effectivePlayer(p, state).ovr;
  const savedStart =
    state.developmentSeasonStart?.season === state.season
      ? state.developmentSeasonStart.ratings?.[p.id]
      : undefined;
  const start = Number.isFinite(savedStart) ? savedStart! : before;
  const annual = p.age <= 23 ? 3 : p.age <= 28 ? 1.5 : 0.5;
  const cap = Number.isFinite(p.potential) ? p.potential! : Math.min(99, p.developmentBase.ovr + 6);
  const upper = Math.max(before, Math.min(cap, start + annual));
  const lower = Math.min(before, start - 2);
  const candidate = (scale: number): AttrDelta => {
    const out = { ...existing };
    for (const [key, change] of Object.entries(changes)) {
      if (!(key in p.developmentBase!.profile.attrs) || !Number.isFinite(change)) continue;
      const k = key as keyof DetailedAttributes;
      const base = p.developmentBase!.profile.attrs[k];
      const recorded = existing[k] ?? 0;
      // Bound only this proposed increment, even when a historical delta is beyond an attribute cap.
      const minimumMove = Math.min(0, 20 - base - recorded);
      const maximumMove = Math.max(0, 99 - base - recorded);
      out[k] = precise(recorded + Math.max(minimumMove, Math.min(maximumMove, change! * scale)));
    }
    return out;
  };
  const valid = (delta: AttrDelta) => {
    const rating = effectivePlayer(p, { attrDeltas: { [p.id]: delta } }).ovr;
    return rating <= upper && rating >= lower;
  };
  const full = candidate(1);
  if (valid(full)) return full;
  let low = 0,
    high = 1;
  for (let step = 0; step < 32; step++) {
    const mid = (low + high) / 2;
    if (valid(candidate(mid))) low = mid;
    else high = mid;
  }
  return candidate(low);
}

export function withDevelopmentSeasonStart(state: CareerState): CareerState {
  if (state.developmentRulesVersion !== 2) return state;
  const previous =
    state.developmentSeasonStart?.season === state.season
      ? (state.developmentSeasonStart.ratings ?? {})
      : {};
  const missing = Object.values(state.players).filter((p) => !Number.isFinite(previous[p.id]));
  if (state.developmentSeasonStart?.season === state.season && !missing.length) return state;
  return {
    ...state,
    developmentSeasonStart: {
      season: state.season,
      ratings: {
        ...previous,
        ...Object.fromEntries(missing.map((p) => [p.id, effectivePlayer(p, state).ovr])),
      },
    },
  };
}
