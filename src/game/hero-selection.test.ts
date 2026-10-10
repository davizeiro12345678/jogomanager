import { describe, expect, it } from "vitest";
import { HeroSelectionBuffer, stageHeroMembership, heroPriorityScore } from "./hero-selection";

describe("bounded hero selection", () => {
  it("prioritizes readable football moments while rejecting tiny actors", () => {
    const background = {
      retained: false,
      ballHolder: false,
      contact: false,
      keeperSave: false,
      scorer: false,
    };
    expect(heroPriorityScore(0.04, background)).toBeNull();
    expect(heroPriorityScore(0.02, { ...background, keeperSave: true })).toBeNull();
    expect(heroPriorityScore(0.04, { ...background, ballHolder: true })).toBeGreaterThan(0.06);
    expect(heroPriorityScore(0.055, { ...background, keeperSave: true })).toBeGreaterThan(
      heroPriorityScore(0.07, background)!,
    );
    expect(heroPriorityScore(0.04, { ...background, retained: true })).not.toBeNull();
  });
  it("stages mesh creation, preserves eligible rigs and drops the previous roster", () => {
    const desired = ["a", "b", "c"];
    let current = stageHeroMembership(new Set(), desired);
    expect([...current]).toEqual(["a"]);
    current = stageHeroMembership(current, desired);
    expect([...current]).toEqual(["a", "b"]);
    current = stageHeroMembership(current, desired);
    expect([...current]).toEqual(desired);
    expect([...stageHeroMembership(current, ["new-b", "c"])]).toEqual(["c", "new-b"]);
    expect(stageHeroMembership(current, []).size).toBe(0);
  });
  it("matches stable sorting for every hero budget while retaining storage", () => {
    const selection = new HeroSelectionBuffer();
    const indices = selection.indices;
    for (let sample = 0; sample < 30; sample += 1) {
      const candidates = Array.from({ length: 22 }, (_, index) => ({
        index,
        coverage: ((index * 17 + sample * 11) % 13) / 13,
      }));
      for (let limit = 0; limit <= 22; limit += 1) {
        selection.reset();
        for (const candidate of candidates)
          selection.add(candidate.index, candidate.coverage, limit);
        expect([...selection.indices.subarray(0, selection.count)]).toEqual(
          candidates
            .slice()
            .sort((a, b) => b.coverage - a.coverage)
            .slice(0, limit)
            .map(({ index }) => index),
        );
        expect(selection.indices).toBe(indices);
      }
    }
  });
  it("bounds capacity and ignores invalid scores", () => {
    const selection = new HeroSelectionBuffer(2);
    selection.add(0, 1, 8);
    selection.add(1, 3, 8);
    selection.add(2, Number.NaN, 8);
    selection.add(3, 2, 8);
    expect([...selection.indices]).toEqual([1, 3]);
    expect(selection.count).toBe(2);
    expect(() => new HeroSelectionBuffer(0)).toThrow(RangeError);
  });
});
