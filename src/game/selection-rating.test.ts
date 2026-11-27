import { describe, expect, it } from "vitest";
import { withDevelopmentBase } from "./attributes";
import { buildReadySquad } from "./career-squad";
import { bounded } from "./match-probability";
import { selectionRating } from "./match-readiness";
import type { AttributeSource } from "./player-development";
import { effectivePlayer } from "./player-effective";
import { normalizedPlayerRatings } from "./player-rating-inputs";
import type { Player } from "./types";

function baselineRating(player: Player, source?: AttributeSource): number {
  // Exact pre-optimization formula, sharing the canonical input normalization.
  const p = normalizedPlayerRatings(effectivePlayer(player, source));
  return (
    p.ovr +
    (bounded(p.form, 60, 0, 100) - 60) * 0.035 -
    Math.max(0, 85 - bounded(p.condition, 100, 0, 100)) * 0.18
  );
}

describe("selection rating projection", () => {
  it("does not read unrelated skill fields when no development projection is required", () => {
    const player = { ...buildReadySquad("fla")[0]! };
    const expected = baselineRating(player);
    Object.defineProperty(player, "pace", {
      enumerable: true,
      get: () => {
        throw new Error("Selection does not consume pace");
      },
    });
    expect(selectionRating(player)).toBe(expected);
  });

  it("matches exact baseline values at clamping boundaries and malformed hydrated ratings", () => {
    const player = buildReadySquad("fla")[0]!;
    const values = [
      undefined,
      null,
      Number.NEGATIVE_INFINITY,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      -1,
      0,
      19.999,
      20,
      60,
      99,
      100,
      100.1,
      "70",
      "invalid",
      70,
    ];
    for (const ovr of values)
      for (const condition of values)
        for (const form of values) {
          const input = { ...player, ovr, condition, form } as unknown as Player;
          expect(selectionRating(input)).toBe(baselineRating(input));
        }
  });

  it("preserves goalkeeper and outfield development with absent, empty and explicit sources", () => {
    const squad = buildReadySquad("fla");
    for (const pos of ["GK", "DF", "MF", "FW"] as const) {
      const player = withDevelopmentBase(
        squad.find((candidate) => candidate.pos === pos)!,
        2,
      );
      player.developmentDelta = { finishing: 4, reflexes: 7, passing: -2, marking: 3 };
      const before = structuredClone(player);
      const sources = [
        undefined,
        {},
        { attrDeltas: { [player.id]: { finishing: 20, reflexes: -4, passing: 8, marking: 3 } } },
      ];
      for (const source of sources) {
        expect(selectionRating(player, source)).toBe(baselineRating(player, source));
        expect(player).toEqual(before);
      }
    }
  });
});
