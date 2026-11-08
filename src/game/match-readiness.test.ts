import { describe, expect, it, vi } from "vitest";
import { isMatchEligible } from "./match-readiness";
import * as rng from "./rng";
import type { Player } from "./types";

const player = (index: number, overrides: Partial<Player> = {}): Player => ({
  id: `lineup-${index}`,
  clubId: "club-1",
  name: `Jogador ${index}`,
  pos: index === 0 ? "GK" : index < 5 ? "DF" : index < 8 ? "MF" : "FW",
  age: 24,
  number: index + 1,
  ovr: 72,
  pace: 72,
  shooting: 72,
  passing: 72,
  defending: 72,
  physical: 72,
  condition: 90,
  morale: 70,
  goals: 0,
  assists: 0,
  apps: 0,
  wage: 10,
  value: 1,
  yellows: 0,
  suspended: false,
  injuryWeeks: 0,
  ...overrides,
});

const validLineup = (): Player[] => Array.from({ length: 11 }, (_, index) => player(index));

describe("isMatchEligible", () => {
  it("accepts exactly eleven fit, unsuspended players with a goalkeeper", () => {
    const lineup = validLineup();
    const before = structuredClone(lineup);

    expect(isMatchEligible(lineup)).toBe(true);
    expect(lineup).toEqual(before);
  });

  it("does not construct an RNG for a valid lineup", () => {
    const makeRng = vi.spyOn(rng, "makeRng");

    expect(isMatchEligible(validLineup())).toBe(true);
    expect(makeRng).not.toHaveBeenCalled();

    makeRng.mockRestore();
  });

  it("rejects a lineup outside the expected club", () => {
    expect(isMatchEligible(validLineup(), "club-2")).toBe(false);
  });

  it.each([
    ["fewer than eleven starters", (lineup: Player[]) => lineup.slice(0, 10)],
    ["more than eleven starters", (lineup: Player[]) => [...lineup, player(11)]],
    ["no goalkeeper", (lineup: Player[]) => lineup.map((p) => ({ ...p, pos: "DF" as const }))],
    [
      "players from different clubs",
      (lineup: Player[]) =>
        lineup.map((p, index) => (index === 4 ? { ...p, clubId: "club-2" } : p)),
    ],
    [
      "duplicate player ids",
      (lineup: Player[]) =>
        lineup.map((p, index) => (index === 10 ? { ...p, id: lineup[0]!.id } : p)),
    ],
    [
      "an injured starter",
      (lineup: Player[]) => lineup.map((p, index) => (index === 4 ? { ...p, injuryWeeks: 1 } : p)),
    ],
    [
      "a suspended starter",
      (lineup: Player[]) => lineup.map((p, index) => (index === 4 ? { ...p, suspended: true } : p)),
    ],
  ] as const)("rejects %s", (_reason, mutate) => {
    expect(isMatchEligible(mutate(validLineup()))).toBe(false);
  });
});
