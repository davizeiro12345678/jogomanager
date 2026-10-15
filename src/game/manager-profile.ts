import type { ManagerAttributes, ManagerLook, ManagerPersonality, ManagerProfile } from "./types";

/**
 * Shared, defensive construction of the profile that represents a manager.
 *
 * The regular career wizard and the custom-club wizard must create the same
 * durable identity. Keeping this outside either React screen also means a
 * malformed draft can never make it into a CareerState just because a second
 * wizard forgot one of the constraints.
 */
export const DEFAULT_MANAGER_LOOK: ManagerLook = {
  skin: 1,
  hair: 1,
  hairColor: "#2b1d14",
  beard: 0,
  outfit: 0,
};

export const DEFAULT_MANAGER_ATTRIBUTES: ManagerAttributes = {
  attack: 6,
  defense: 6,
  market: 6,
  squad: 6,
  media: 6,
};

export const MANAGER_PERSONALITIES = [
  "calmo",
  "motivador",
  "durao",
  "tatico",
  "jovem",
] as const satisfies readonly ManagerPersonality[];

export interface ManagerProfileDraft {
  name: string;
  country: string;
  age: number;
  favClub: string;
  look?: Partial<ManagerLook>;
  personality?: ManagerPersonality;
  reputation?: number;
  attrs?: Partial<ManagerAttributes>;
  approval?: number;
}

const clampInt = (value: unknown, min: number, max: number, fallback: number) => {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, Math.round(numeric)));
};

function safeColor(value: unknown, fallback: string) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

export function normalizeManagerLook(look?: Partial<ManagerLook>): ManagerLook {
  return {
    skin: clampInt(look?.skin, 0, 5, DEFAULT_MANAGER_LOOK.skin),
    hair: clampInt(look?.hair, 0, 6, DEFAULT_MANAGER_LOOK.hair),
    hairColor: safeColor(look?.hairColor, DEFAULT_MANAGER_LOOK.hairColor),
    beard: clampInt(look?.beard, 0, 4, DEFAULT_MANAGER_LOOK.beard),
    outfit: clampInt(look?.outfit, 0, 2, DEFAULT_MANAGER_LOOK.outfit),
  };
}

export function normalizeManagerAttributes(attrs?: Partial<ManagerAttributes>): ManagerAttributes {
  return {
    attack: clampInt(attrs?.attack, 1, 10, DEFAULT_MANAGER_ATTRIBUTES.attack),
    defense: clampInt(attrs?.defense, 1, 10, DEFAULT_MANAGER_ATTRIBUTES.defense),
    market: clampInt(attrs?.market, 1, 10, DEFAULT_MANAGER_ATTRIBUTES.market),
    squad: clampInt(attrs?.squad, 1, 10, DEFAULT_MANAGER_ATTRIBUTES.squad),
    media: clampInt(attrs?.media, 1, 10, DEFAULT_MANAGER_ATTRIBUTES.media),
  };
}

/** Creates a profile suitable for persistence in CareerState. */
export function createManagerProfile(draft: ManagerProfileDraft): ManagerProfile {
  const reputation = clampInt(draft.reputation, 1, 5, 3);
  const personality = MANAGER_PERSONALITIES.includes(draft.personality as ManagerPersonality)
    ? (draft.personality as ManagerPersonality)
    : "motivador";

  return {
    name: draft.name.trim().slice(0, 48) || "Técnico",
    country: draft.country.trim().slice(0, 80) || "bra",
    age: clampInt(draft.age, 20, 75, 38),
    favClub: draft.favClub.trim().slice(0, 80),
    look: normalizeManagerLook(draft.look),
    personality,
    reputation,
    attrs: normalizeManagerAttributes(draft.attrs),
    approval: clampInt(draft.approval, 20, 95, 55 + reputation * 4),
  };
}
