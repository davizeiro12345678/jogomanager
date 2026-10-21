import type { AttrDelta, DetailedAttributes } from "./attributes";
import type { AttributeSource, CoreSkill } from "./player-development";
import { ratingValue } from "./player-rating-inputs";
import type { Player } from "./types";

/** Same detailed-to-core contribution weights previously used by readiness. */
const SKILL_WEIGHTS: Record<CoreSkill, readonly (readonly [keyof DetailedAttributes, number])[]> = {
  pace: [
    ["acceleration", 0.35],
    ["agility", 0.25],
    ["balance", 0.2],
    ["pace", 0.2],
  ],
  shooting: [
    ["finishing", 0.36],
    ["longShots", 0.2],
    ["technique", 0.16],
    ["composure", 0.12],
    ["decisions", 0.1],
    ["setPieces", 0.06],
  ],
  passing: [
    ["passing", 0.28],
    ["vision", 0.2],
    ["firstTouch", 0.13],
    ["teamwork", 0.12],
    ["decisions", 0.12],
    ["crossing", 0.1],
    ["offBall", 0.05],
  ],
  defending: [
    ["marking", 0.2],
    ["tackling", 0.2],
    ["interceptions", 0.16],
    ["anticipation", 0.16],
    ["concentration", 0.1],
    ["positioning", 0.1],
    ["heading", 0.08],
  ],
  physical: [
    ["strength", 0.24],
    ["stamina", 0.2],
    ["workRate", 0.16],
    ["naturalFitness", 0.12],
    ["determination", 0.1],
    ["jumping", 0.1],
    ["balance", 0.08],
  ],
};
const KEEPER_WEIGHTS = [
  ["reflexes", 0.22],
  ["handling", 0.18],
  ["oneOnOnes", 0.16],
  ["commandOfArea", 0.12],
  ["positioning", 0.12],
  ["concentration", 0.1],
  ["communication", 0.1],
] as const;
export const DEVELOPMENT_OVR_WEIGHTS: Record<Player["pos"], Record<CoreSkill, number>> = {
  GK: { pace: 0.1, shooting: 0.05, passing: 0.15, defending: 0.5, physical: 0.2 },
  DF: { pace: 0.15, shooting: 0.05, passing: 0.1, defending: 0.45, physical: 0.25 },
  MF: { pace: 0.15, shooting: 0.15, passing: 0.4, defending: 0.1, physical: 0.2 },
  FW: { pace: 0.2, shooting: 0.45, passing: 0.1, defending: 0.05, physical: 0.2 },
};
const SKILLS = Object.keys(SKILL_WEIGHTS) as CoreSkill[];
const precise = (v: number) => Math.round(v * 1e6) / 1e6;

/** A provided source wins even when empty; an explicit match snapshot is the fallback. */
export function deltaFor(p: Player, source?: AttributeSource): AttrDelta {
  return source ? (source.attrDeltas?.[p.id] ?? {}) : (p.developmentDelta ?? {});
}

export function effectivePlayer(p: Player, source?: AttributeSource): Player {
  const base = p.developmentBase;
  if (
    !base ||
    base.rulesVersion !== 2 ||
    !base.profile?.attrs ||
    !base.core ||
    !Number.isFinite(base.ovr)
  )
    return p;
  const delta = deltaFor(p, source);
  const core = { ...base.core };
  let ovrGain = 0;
  for (const skill of SKILLS) {
    const weights = skill === "defending" && p.pos === "GK" ? KEEPER_WEIGHTS : SKILL_WEIGHTS[skill];
    const gain = weights.reduce((sum, [key, weight]) => {
      const initial = ratingValue(base.profile.attrs[key]);
      const move = typeof delta[key] === "number" && Number.isFinite(delta[key]) ? delta[key]! : 0;
      return sum + (ratingValue(initial + move) - initial) * weight;
    }, 0);
    core[skill] = precise(ratingValue(base.core[skill] + gain));
    ovrGain += (core[skill] - base.core[skill]) * DEVELOPMENT_OVR_WEIGHTS[p.pos][skill];
  }
  return {
    ...p,
    ...core,
    ovr: precise(ratingValue(base.ovr + ovrGain)),
    developmentDelta: { ...delta },
  };
}
