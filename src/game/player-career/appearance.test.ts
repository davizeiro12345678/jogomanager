import { describe, expect, it } from "vitest";
import {
  ATHLETE_HAIR_COLORS,
  ATHLETE_SKIN_TONES,
  athleteAppearanceFromLegacy,
  athleteLookForAppearance,
  defaultAthleteAppearance,
  legacyAppearanceFromAthleteAppearance,
  migrateAthleteAppearance,
  normalizeAthleteAppearance,
} from "./appearance";
import { createAthlete } from "./engine";

describe("athlete appearance contract", () => {
  it("migrates a legacy save without changing its visible numeric choices", () => {
    const fallback = defaultAthleteAppearance("legacy-athlete", "FW", "normal");
    const legacy = { skin: 5, hair: 5, hairColor: 3, beard: 2, boots: 4 };

    const migrated = athleteAppearanceFromLegacy(legacy, fallback);

    expect(migrated).toMatchObject({
      version: 1,
      skinTone: 5,
      hairColor: 3,
      hairStyle: "braids",
      beardStyle: "goatee",
      bootVariant: 4,
      bodyType: "normal",
    });
    expect(legacyAppearanceFromAthleteAppearance(migrated)).toEqual(legacy);
  });

  it("repairs malformed canonical data from a deterministic fallback", () => {
    const fallback = defaultAthleteAppearance("stable-seed", "MF", "slim");
    const repaired = normalizeAthleteAppearance(
      {
        version: 1,
        skinTone: 99,
        hairColor: -5,
        hairStyle: "not-a-style",
        beardStyle: "not-a-beard",
        bootVariant: 999,
        bodyType: "not-a-body",
      },
      fallback,
    );

    expect(repaired).toEqual({ ...fallback, skinTone: 5, hairColor: 0, bootVariant: 5 });
    expect(defaultAthleteAppearance("stable-seed", "MF", "slim")).toEqual(fallback);
  });

  it("adds v1 appearance to an existing career and resolves it in the renderer", () => {
    const legacyState = createAthlete(
      {
        slot: 1,
        name: "Ana Teste",
        nickname: "Ana",
        nation: "Brasil",
        hometown: "São Paulo",
        position: "ATA",
        foot: "direito",
        heightCm: 178,
        build: "atletico",
        personality: "profissional",
        origin: "base",
        clubId: "fla",
        appearance: { skin: 2, hair: 1, hairColor: 0, beard: 0, boots: 0 },
        shirtNumber: 9,
      },
      1_700_000_000_000,
    );

    const migrated = migrateAthleteAppearance(legacyState);
    const look = athleteLookForAppearance({
      seed: migrated.seed,
      role: "FW",
      appearance: migrated.appearanceV1,
      heightCm: migrated.heightCm,
      weightKg: migrated.weightKg,
    });

    expect(migrateAthleteAppearance(migrated).appearanceV1).toEqual(migrated.appearanceV1);
    expect(look.skin).toBe(ATHLETE_SKIN_TONES[2]);
    expect(look.hairColor).toBe(ATHLETE_HAIR_COLORS[0]);
    expect(look.hairStyle).toBe("short");
    expect(look.height).toBeCloseTo(178 / 180, 5);
  });
});
