import { describe, expect, it } from "vitest";
import { withDevelopmentBase } from "./attributes";
import { buildReadySquad, pickLineup } from "./career";
import { matchAttributes, selectionRating } from "./match-readiness";
import { effectivePlayer } from "./player-effective";
import { normalizedPlayerRatings } from "./player-rating-inputs";
import { bounded, teamDay } from "./match-probability";
import { completeSquad, MIN_GOALKEEPERS, SQUAD_SIZE } from "./squad";
import type { Player } from "./types";

describe("match setup boundaries", () => {
  it("recalculates a lineup when player availability changes", () => {
    const squad = buildReadySquad("fla");
    const original = pickLineup(squad, "4-3-3");
    const player = squad.find((item) => item.id === original.lineup[1])!;
    player.suspended = true;
    expect(pickLineup(squad, "4-3-3").lineup).not.toContain(player.id);
    player.suspended = false;
    expect(pickLineup(squad, "4-3-3")).toEqual(original);
  });

  it("preserves readiness normalization for invalid values and development deltas", () => {
    const player = buildReadySquad("fla")[0]!;
    const source = { attrDeltas: { [player.id]: { passing: 4, anticipation: -3 } } };
    for (const input of [
      { ...player, ovr: Number.NaN, condition: Number.POSITIVE_INFINITY },
      { ...player, ovr: -5, condition: -10, form: 200 },
      { ...player, ovr: 150, condition: 130, form: -20 },
      withDevelopmentBase(player, 2),
    ]) {
      const normalized = normalizedPlayerRatings(effectivePlayer(input, source));
      const expected =
        normalized.ovr +
        (bounded(normalized.form, 60, 0, 100) - 60) * 0.035 -
        Math.max(0, 85 - bounded(normalized.condition, 100, 0, 100)) * 0.18;
      expect(selectionRating(input, source)).toBe(expected);
    }
  });

  it("produces identical match attributes with a shared team-day value", () => {
    const squad = buildReadySquad("pal");
    for (const side of ["home", "away"] as const) {
      const variation = teamDay("same-match", side);
      for (const player of squad) {
        expect(matchAttributes(player, "same-match", side, undefined, variation)).toEqual(
          matchAttributes(player, "same-match", side),
        );
      }
    }
  });

  it("completes partial squads deterministically without changing their input", () => {
    const input = buildReadySquad("pal")
      .filter((player) => player.pos !== "GK")
      .slice(0, 7);
    const original = structuredClone(input);
    const result = completeSquad("pal", input);
    expect(result).toEqual(completeSquad("pal", input));
    expect(input).toEqual(original);
    expect(result).toHaveLength(SQUAD_SIZE);
    expect(result.filter((player) => player.pos === "GK").length).toBeGreaterThanOrEqual(
      MIN_GOALKEEPERS,
    );
    expect(new Set(result.map((player) => player.number)).size).toBe(result.length);
  });

  it("stops safely when all 99 shirt numbers are occupied", () => {
    const template = buildReadySquad("fla")[0]!;
    const full: Player[] = Array.from({ length: 99 }, (_, index) => ({
      ...template,
      id: `existing-${index}`,
      number: index + 1,
    }));
    expect(completeSquad("fla", full, 100)).toEqual(full);
  });
});
