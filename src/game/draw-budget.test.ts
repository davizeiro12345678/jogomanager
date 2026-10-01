import { describe, expect, it } from "vitest";

import {
  allocateHeroes,
  HERO_MESH_COST,
  heroCapFor,
  nonHeroDraws,
  replayHeroCapFor,
} from "./draw-budget";
import { GRAPHICS_PROFILES } from "./contracts/graphics-profile";

describe("draw budget", () => {
  it("prices a full rig at the measured merged mesh count", () => {
    expect(HERO_MESH_COST).toBeGreaterThan(20);
    expect(HERO_MESH_COST).toBeLessThan(80);
  });

  it("derives the hero count from what is left of the tier budget", () => {
    const maxDraws = GRAPHICS_PROFILES.alta.maxDrawCalls;
    // The detailed anatomy includes accessories and shadows; reserve enough
    // room for the complete 34-draw variant instead of pricing only the base.
    const roomy = allocateHeroes(maxDraws, 60, 6, 1);
    expect(roomy.count).toBe(5);
    expect(roomy.reason).toBe("orçamento");

    // Medium and crowded scenes also retain the profile's headroom.
    expect(allocateHeroes(maxDraws, 120, 6, 1).count).toBe(3);
    expect(allocateHeroes(maxDraws, 180, 6, 1).count).toBe(1);

    // Cinema allows more detailed players while preserving the same margin.
    const cinema = allocateHeroes(GRAPHICS_PROFILES.cinema.maxDrawCalls, 60, 8, 1);
    expect(cinema.count).toBe(7);
    expect(cinema.reason).toBe("orçamento");
  });

  it("respects the floor and the cap", () => {
    const starved = allocateHeroes(GRAPHICS_PROFILES.alta.maxDrawCalls, 1000, 6, 1);
    expect(starved.count).toBe(1);
    expect(starved.reason).toBe("mínimo");
    expect(allocateHeroes(90, 0, 0, 0).count).toBe(0);
    // teto nunca é ultrapassado, mesmo com cena vazia
    expect(allocateHeroes(1000, 0, 6, 1).count).toBe(6);
  });

  it("respects the floor and the cap", () => {
    const starved = allocateHeroes(GRAPHICS_PROFILES.alta.maxDrawCalls, 1000, 6, 1);
    expect(starved.count).toBe(1);
    expect(starved.reason).toBe("mínimo");
    expect(allocateHeroes(90, 0, 0, 0).count).toBe(0);
    // teto nunca é ultrapassado, mesmo com cena vazia
    expect(allocateHeroes(1000, 0, 6, 1).count).toBe(6);
  });

  it("subtracts the mounted heroes from the measured total", () => {
    expect(nonHeroDraws(500, 4)).toBe(500 - 4 * HERO_MESH_COST);
    expect(nonHeroDraws(100, 10)).toBe(0);
  });

  it("keeps the low tier hero-free and lets replays go further", () => {
    expect(heroCapFor("baixa")).toBe(0);
    expect(heroCapFor("alta")).toBe(6);
    expect(heroCapFor("cinema")).toBe(8);
    expect(replayHeroCapFor("alta")).toBe(10);
    expect(replayHeroCapFor("cinema")).toBe(12);
  });
});
