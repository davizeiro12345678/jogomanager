import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { makeRng } from "@/game/rng";
import { createStadiumCosmeticRng, createWeatherDrops } from "./stadium-cosmetics";

describe("stadium cosmetic randomness", () => {
  it("repeats the cosmetic stream for the same seed and separates other seeds", () => {
    const first = makeRng("matchday-cosmetics");
    const second = makeRng("matchday-cosmetics");
    expect(Array.from({ length: 24 }, () => first())).toEqual(
      Array.from({ length: 24 }, () => second()),
    );
    expect(makeRng("matchday-cosmetics")()).not.toBe(makeRng("other-matchday")());
  });

  it("keeps weather helpers in the shared cosmetics module and recreates respawn streams", () => {
    const helperSource = readFileSync(new URL("./stadium-cosmetics.ts", import.meta.url), "utf8");
    const weatherSource = readFileSync(new URL("./StadiumWeather.tsx", import.meta.url), "utf8");
    expect(helperSource).toContain("export function createWeatherDrops");
    expect(helperSource).toContain("export function createStadiumCosmeticRng");
    expect(weatherSource).toContain('from "./stadium-cosmetics"');
    expect(weatherSource).toContain("function spawnDrop");
    expect(weatherSource).not.toContain("function createWeatherDrops");
    expect(weatherSource).not.toContain("Math.random");

    const firstPool = createWeatherDrops("matchday-cosmetics");
    expect(createWeatherDrops("matchday-cosmetics")).toEqual(firstPool);
    expect(createWeatherDrops("other-matchday")).not.toEqual(firstPool);

    const firstRespawn = createStadiumCosmeticRng("matchday-cosmetics", "weather-drop", 7, 1);
    const secondRespawn = createStadiumCosmeticRng("matchday-cosmetics", "weather-drop", 7, 1);
    expect(Array.from({ length: 6 }, () => firstRespawn())).toEqual(
      Array.from({ length: 6 }, () => secondRespawn()),
    );
  });

  it("uses seeded streams instead of ambient Math.random in all cosmetic particle sources", () => {
    for (const file of ["StadiumWeather.tsx", "Atmosphere.tsx", "CrowdReaction.tsx"]) {
      const source = readFileSync(new URL(`./${file}`, import.meta.url), "utf8");
      expect(source, file).toContain("createStadiumCosmeticRng");
      expect(source, file).not.toContain("Math.random");
    }
  });
});
