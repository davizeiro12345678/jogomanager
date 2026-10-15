import {
  lookFor,
  lookWithPhysique,
  type BeardStyle,
  type BodyType,
  type HairStyle,
  type PlayerLook,
} from "@/game/player-model";
import type { Appearance, BodyBuild, PlayerCareerState, PlayerPosition } from "./types";

/**
 * The profile state still carries the first-generation numeric appearance for
 * backwards compatibility. New clients write this self-describing contract in
 * parallel, so a later visual revision can be introduced without guessing how
 * an old save encoded a haircut.
 */
export const ATHLETE_APPEARANCE_VERSION = 1 as const;

export interface AthleteAppearanceV1 {
  version: typeof ATHLETE_APPEARANCE_VERSION;
  skinTone: number;
  hairColor: number;
  hairStyle: HairStyle;
  beardStyle: BeardStyle;
  bootVariant: number;
  bodyType: BodyType;
}

export const ATHLETE_SKIN_TONES = [
  "#f4d3b5",
  "#e2b48c",
  "#c68a5d",
  "#a0673f",
  "#7a4a2a",
  "#4e2e1a",
] as const;
export const ATHLETE_HAIR_COLORS = ["#1b1410", "#4a2f1d", "#8a5a2b", "#d8b46a", "#b5b5b5"] as const;
export const ATHLETE_BOOT_COLORS = [
  "#101014",
  "#f2f2f2",
  "#ff2e63",
  "#00e5a0",
  "#ffcc00",
  "#3b6bff",
] as const;
export const ATHLETE_BOOT_ACCENTS = [
  "#ffffff",
  "#101014",
  "#ffd34d",
  "#00d0ff",
  "#ff4d6d",
  "#ffffff",
] as const;

export const ATHLETE_HAIR_STYLES = [
  "buzz",
  "short",
  "medium",
  "curly",
  "afro",
  "mohawk",
  "bun",
  "ponytail",
  "dreads",
  "braids",
  "headband",
  "bald",
] as const satisfies readonly HairStyle[];

export const ATHLETE_BEARD_STYLES = [
  "none",
  "stubble",
  "goatee",
  "full",
  "moustache",
] as const satisfies readonly BeardStyle[];
export const ATHLETE_BODY_TYPES = [
  "slim",
  "normal",
  "strong",
  "tall",
] as const satisfies readonly BodyType[];

const LEGACY_HAIR_STYLES: readonly HairStyle[] = [
  "buzz",
  "short",
  "short",
  "curly",
  "afro",
  "braids",
  "bun",
  "mohawk",
  "medium",
  "ponytail",
];
const LEGACY_BEARD_STYLES: readonly BeardStyle[] = ["none", "stubble", "goatee", "full"];

export const RIG_POSITION_FOR_CAREER: Record<PlayerPosition, string> = {
  GOL: "GK",
  ZAG: "DF",
  LAT: "DF",
  VOL: "MF",
  MEI: "MF",
  PON: "FW",
  ATA: "FW",
};

export const BODY_TYPE_FOR_BUILD: Record<BodyBuild, BodyType> = {
  leve: "slim",
  atletico: "normal",
  forte: "strong",
};

function objectValue(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function boundedIndex(value: unknown, fallback: number, length: number): number {
  const candidate =
    typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : fallback;
  return Math.max(0, Math.min(length - 1, candidate));
}

function option<T extends string>(value: unknown, values: readonly T[], fallback: T): T {
  return typeof value === "string" && (values as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function legacyIndex<T>(values: readonly T[], value: T, fallback: number): number {
  const index = values.indexOf(value);
  return index >= 0 ? index : fallback;
}

/** A deterministic contract used before a player makes a visual choice. */
export function defaultAthleteAppearance(
  seed: string,
  role: string,
  bodyType?: BodyType,
): AthleteAppearanceV1 {
  const base = lookFor(seed, role);
  const stable = Math.abs(base.seed);
  return {
    version: ATHLETE_APPEARANCE_VERSION,
    skinTone: stable % ATHLETE_SKIN_TONES.length,
    hairColor: (stable * 7) % ATHLETE_HAIR_COLORS.length,
    hairStyle: base.hairStyle,
    beardStyle: base.beard,
    bootVariant: (stable * 13) % ATHLETE_BOOT_COLORS.length,
    bodyType: bodyType ?? base.bodyType,
  };
}

/** Convert an existing numeric save without changing its visible choices. */
export function athleteAppearanceFromLegacy(
  legacy: Appearance | null | undefined,
  fallback: AthleteAppearanceV1,
): AthleteAppearanceV1 {
  if (!legacy) return fallback;
  const hair = boundedIndex(legacy.hair, 1, LEGACY_HAIR_STYLES.length);
  const beard = boundedIndex(legacy.beard, 0, LEGACY_BEARD_STYLES.length);
  return {
    version: ATHLETE_APPEARANCE_VERSION,
    skinTone: boundedIndex(legacy.skin, fallback.skinTone, ATHLETE_SKIN_TONES.length),
    hairColor: boundedIndex(legacy.hairColor, fallback.hairColor, ATHLETE_HAIR_COLORS.length),
    hairStyle: LEGACY_HAIR_STYLES[hair] ?? fallback.hairStyle,
    beardStyle: LEGACY_BEARD_STYLES[beard] ?? fallback.beardStyle,
    bootVariant: boundedIndex(legacy.boots, fallback.bootVariant, ATHLETE_BOOT_COLORS.length),
    bodyType: fallback.bodyType,
  };
}

/** Validate a saved v1 payload and repair malformed values from a stable base. */
export function normalizeAthleteAppearance(
  value: unknown,
  fallback: AthleteAppearanceV1,
): AthleteAppearanceV1 {
  const source = objectValue(value);
  if (!source || source["version"] !== ATHLETE_APPEARANCE_VERSION) return fallback;
  return {
    version: ATHLETE_APPEARANCE_VERSION,
    skinTone: boundedIndex(source["skinTone"], fallback.skinTone, ATHLETE_SKIN_TONES.length),
    hairColor: boundedIndex(source["hairColor"], fallback.hairColor, ATHLETE_HAIR_COLORS.length),
    hairStyle: option(source["hairStyle"], ATHLETE_HAIR_STYLES, fallback.hairStyle),
    beardStyle: option(source["beardStyle"], ATHLETE_BEARD_STYLES, fallback.beardStyle),
    bootVariant: boundedIndex(
      source["bootVariant"],
      fallback.bootVariant,
      ATHLETE_BOOT_COLORS.length,
    ),
    bodyType: option(source["bodyType"], ATHLETE_BODY_TYPES, fallback.bodyType),
  };
}

/** Legacy callers can still consume the five numeric fields unchanged. */
export function legacyAppearanceFromAthleteAppearance(appearance: AthleteAppearanceV1): Appearance {
  return {
    skin: appearance.skinTone,
    hair: legacyIndex(LEGACY_HAIR_STYLES, appearance.hairStyle, 1),
    hairColor: appearance.hairColor,
    beard: legacyIndex(LEGACY_BEARD_STYLES, appearance.beardStyle, 0),
    boots: appearance.bootVariant,
  };
}

/** Add the canonical visual contract to old and cloud-restored career states. */
export function migrateAthleteAppearance<
  T extends Pick<PlayerCareerState, "seed" | "position" | "build" | "appearance"> & {
    appearanceV1?: unknown;
  },
>(state: T): T & { appearanceV1: AthleteAppearanceV1 } {
  const fallback = defaultAthleteAppearance(
    state.seed,
    RIG_POSITION_FOR_CAREER[state.position],
    BODY_TYPE_FOR_BUILD[state.build],
  );
  const appearanceV1 =
    state.appearanceV1 === undefined
      ? athleteAppearanceFromLegacy(state.appearance, fallback)
      : normalizeAthleteAppearance(state.appearanceV1, fallback);
  return { ...state, appearanceV1 };
}

/** Resolve the saved contract into the renderer's complete, deterministic look. */
export function athleteLookForAppearance({
  seed,
  role,
  captain = false,
  appearance,
  heightCm,
  weightKg,
}: {
  seed: string;
  role: string;
  captain?: boolean;
  appearance: AthleteAppearanceV1;
  heightCm?: number | undefined;
  weightKg?: number | undefined;
}): PlayerLook {
  const base = lookFor(seed, role, captain);
  const fallback = defaultAthleteAppearance(seed, role, base.bodyType);
  const resolved = normalizeAthleteAppearance(appearance, fallback);
  const measured = lookWithPhysique(base, { height: heightCm, weight: weightKg });
  const girth =
    resolved.bodyType === "strong"
      ? Math.max(measured.girth, 1.06)
      : resolved.bodyType === "slim"
        ? Math.min(measured.girth, 0.94)
        : resolved.bodyType === "normal"
          ? Math.max(0.96, Math.min(1.04, measured.girth))
          : measured.girth;
  return {
    ...measured,
    skin: ATHLETE_SKIN_TONES[resolved.skinTone] ?? measured.skin,
    hairColor: ATHLETE_HAIR_COLORS[resolved.hairColor] ?? measured.hairColor,
    hairStyle: resolved.hairStyle,
    beard: resolved.beardStyle,
    bootColor: ATHLETE_BOOT_COLORS[resolved.bootVariant] ?? measured.bootColor,
    bootAccent: ATHLETE_BOOT_ACCENTS[resolved.bootVariant] ?? measured.bootAccent,
    bodyType: resolved.bodyType,
    girth,
    headband: resolved.hairStyle === "headband",
  };
}
