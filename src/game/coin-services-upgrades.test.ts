import { describe, expect, it } from "vitest";
import { CAREER_SERVICES } from "@/lib/wallet-rules";
import { applyStadiumUpgrade, applyYouthBoost, canUpgradeStadium } from "./coin-services";
import type { CareerState, Player } from "./types";

const player = (id: string, age: number, potential: number): Player =>
  ({ id, clubId: "c1", age, ovr: 60, potential, name: id }) as Player;

const career = (extra: Partial<CareerState> = {}) =>
  ({
    clubId: "c1",
    capacity: 40000,
    players: { young: player("young", 19, 80), old: player("old", 25, 80), top: player("top", 18, 98) },
    ...extra,
  }) as CareerState;

describe("coin service prices", () => {
  it("charges 300 coins, 2 per week, to boost a youth", () => {
    expect(CAREER_SERVICES.youth_boost).toEqual({ cost: 300, weeklyLimit: 2 });
  });
  it("charges 500 coins, 1 per week, to upgrade the stadium", () => {
    expect(CAREER_SERVICES.stadium_upgrade).toEqual({ cost: 500, weeklyLimit: 1 });
  });
});

describe("youth boost", () => {
  it("adds 2 potential to a player up to 21", () => {
    expect(applyYouthBoost(career(), "young").players["young"]?.potential).toBe(82);
  });
  it("ignores players older than 21", () => {
    expect(applyYouthBoost(career(), "old").players["old"]?.potential).toBe(80);
  });
  it("never exceeds 99", () => {
    expect(applyYouthBoost(career(), "top").players["top"]?.potential).toBe(99);
  });
});

describe("stadium upgrade", () => {
  it("adds 5% capacity per level", () => {
    const next = applyStadiumUpgrade(career());
    expect(next.capacity).toBe(42000);
    expect(next.stadiumUpgrades).toBe(1);
  });
  it("stops at level 5", () => {
    const maxed = career({ stadiumUpgrades: 5 });
    expect(canUpgradeStadium(maxed)).toBe(false);
    expect(applyStadiumUpgrade(maxed).capacity).toBe(40000);
  });
});
