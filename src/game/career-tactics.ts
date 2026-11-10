import { FORMATIONS } from "./formations";
import type { FormationKey, Tactics } from "./types";

export function isCareerFormation(value: unknown): value is FormationKey {
  return typeof value === "string" && Object.hasOwn(FORMATIONS, value);
}

/** Repair a personal save at hydration, leaving valid tactical choices intact. */
export function normalizedCareerTactics(value: unknown): Tactics {
  const input =
    value !== null && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const setting = (key: string, fallback: number, max: number) => {
    const number = input[key];
    return typeof number === "number" && Number.isFinite(number)
      ? Math.max(0, Math.min(max, Math.round(number)))
      : fallback;
  };
  return {
    formation: isCareerFormation(input["formation"]) ? input["formation"] : "4-3-3",
    mentality: setting("mentality", 2, 4),
    pressing: setting("pressing", 1, 2),
    width: setting("width", 1, 2),
    tempo: setting("tempo", 1, 2),
  };
}
