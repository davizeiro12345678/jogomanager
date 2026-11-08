import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { makeRng } from "@/game/rng";

describe("stadium cosmetic randomness", () => {
  it("repeats the cosmetic stream for the same seed and separates other seeds", () => {
    const first = makeRng("matchday-cosmetics");
    const second = makeRng("matchday-cosmetics");
    expect(Array.from({ length: 24 }, () => first())).toEqual(
      Array.from({ length: 24 }, () => second()),
    );
    expect(makeRng("matchday-cosmetics")()).not.toBe(makeRng("other-matchday")());
  });

  it("keeps weather respawns on a dedicated deterministic stream", () => {
    const source = readFileSync(new URL("./StadiumWeather.tsx", import.meta.url), "utf8");
    expect(source).toContain("function respawnWeatherDrop");
    expect(source).toContain("makeRng(`${visualSeed}:respawn`)");
  });

  it("uses seeded streams instead of ambient Math.random in all cosmetic particle sources", () => {
    for (const [file, helper] of [
      ["StadiumWeather.tsx", "function createWeatherDrops"],
      ["Atmosphere.tsx", "function createDustMoteData"],
      ["CrowdReaction.tsx", "function createFlashCloudPositions"],
    ]) {
      const source = readFileSync(new URL(`./${file}`, import.meta.url), "utf8");
      expect(source, file).toContain(helper);
      expect(source, file).toContain("makeRng");
      expect(source, file).not.toContain("Math.random");
    }
  });
});
