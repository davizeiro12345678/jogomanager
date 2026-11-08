import { describe, expect, it } from "vitest";
import { DUST_POOL_CAPACITY } from "./Atmosphere";
import { FLASH_POOL_CAPACITY } from "./CrowdReaction";
import { GOAL_FX_POOL_CAPACITY } from "./StadiumGoalFx";
import {
  createStadiumCosmeticRng,
  createWeatherDrops,
  poolVisibleCount,
  stadiumFixtureKey,
  WEATHER_POOL_CAPACITY,
} from "./stadium-cosmetics";

describe("stadium cosmetic randomness", () => {
  it("recreates the same independent stream for one fixture, channel and beat", () => {
    const first = createStadiumCosmeticRng("fla|pal", "goal-fx", 3);
    const second = createStadiumCosmeticRng("fla|pal", "goal-fx", 3);
    expect(Array.from({ length: 8 }, () => first())).toEqual(
      Array.from({ length: 8 }, () => second()),
    );
  });

  it("separates fixture and visual channels without touching a shared simulation stream", () => {
    const fixture = stadiumFixtureKey("fla", "pal");
    const otherFixture = stadiumFixtureKey("fla", "bot");
    const weather = createStadiumCosmeticRng(fixture, "weather-drop", 0, 0)();
    const dust = createStadiumCosmeticRng(fixture, "dust-mote", 0)();
    const other = createStadiumCosmeticRng(otherFixture, "weather-drop", 0, 0)();
    expect(new Set([weather, dust, other]).size).toBe(3);
  });

  it("keeps weather storage at pool capacity while smaller views reuse the same prefix", () => {
    const full = createWeatherDrops("fla|pal");
    const reduced = createWeatherDrops("fla|pal", 96);
    expect(full).toHaveLength(WEATHER_POOL_CAPACITY);
    expect(reduced).toEqual(full.slice(0, 96));
    expect(createWeatherDrops("fla|pal")).toEqual(full);
    expect(createWeatherDrops("pal|fla")).not.toEqual(full);
  });

  it("clamps visible work without changing the preallocated pool", () => {
    expect(poolVisibleCount(-2, 10)).toBe(0);
    expect(poolVisibleCount(4.9, 10)).toBe(4);
    expect(poolVisibleCount(99, 10)).toBe(10);
    expect(DUST_POOL_CAPACITY).toBe(420);
    expect(FLASH_POOL_CAPACITY).toBe(240);
    expect(GOAL_FX_POOL_CAPACITY).toBe(320);
  });
});
