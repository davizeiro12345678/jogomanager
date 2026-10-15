import { describe, expect, it, vi } from "vitest";
import { initCareer } from "./career";
import { autoSeason } from "./autoplay";
import { autoSeasonCooperative } from "./season-cooperative";

describe("sequential cooperative career fallback", () => {
  it("matches the worker algorithm and explicit operation time while yielding between weeks", async () => {
    const initial = initCareer("bra", "fla", "Compatibilidade");
    const before = structuredClone(initial);
    const clock = Date.UTC(2026, 9, 9, 12);
    const yieldTurn = vi.fn(async () => undefined);
    const result = await autoSeasonCooperative(initial, 8, clock, yieldTurn);
    expect(result).toEqual(autoSeason(initial, 8, clock));
    expect(initial).toEqual(before);
    expect(yieldTurn.mock.calls.length).toBe(result.weeks.length);
    expect(result.weeks.map((w) => w.round)).toEqual(
      Array.from({ length: result.weeks.length }, (_, i) => initial.round + i),
    );
  });
  it("rejects invalid clocks and unbounded work before advancing a career", async () => {
    const initial = initCareer("bra", "fla", "Limites");
    const yieldTurn = vi.fn(async () => undefined);
    for (const [weeks, clock] of [
      [61, 0],
      [-1, 0],
      [1.5, 0],
      [1, NaN],
      [1, Infinity],
      [1, -1],
    ])
      await expect(autoSeasonCooperative(initial, weeks, clock, yieldTurn)).rejects.toThrow(
        /inválidos/,
      );
    expect(yieldTurn).not.toHaveBeenCalled();
    expect(await autoSeasonCooperative(initial, 0, 0, yieldTurn)).toEqual({
      weeks: [],
      state: initial,
    });
  });
});
