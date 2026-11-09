import { describe, expect, it } from "vitest";
import { advanceRound, initCareer } from "./career";
import { applyWeeklyDevelopment } from "./career-development";

function fixture() {
  const state = initCareer("bra", "fla", "Fixture break");
  const id = state.lineup[0]!;
  const player = { ...state.players[id]!, condition: 70, age: 27, suspended: false };
  return { state: { ...state, players: { [id]: player }, bench: [] }, player, id };
}

describe("weekly development match boundaries", () => {
  it("does not fatigue selected players when no match took place", () => {
    const { state, id } = fixture();
    const selected = applyWeeklyDevelopment(state.players, state, null, "bye", new Set(), false, 0);
    const unselected = applyWeeklyDevelopment(
      state.players,
      { ...state, lineup: [] },
      null,
      "bye",
      new Set(),
      false,
      0,
    );
    expect(selected.players[id]!.condition).toBe(unselected.players[id]!.condition);
    expect(selected.players[id]!.condition).toBeGreaterThan(state.players[id]!.condition);
  });

  it("does not serve a match suspension during a fixture-free week", () => {
    const { state, id, player } = fixture();
    const players = { [id]: { ...player, suspended: true } };
    const resting = applyWeeklyDevelopment(players, state, null, "bye", new Set(), false, 0);
    const served = applyWeeklyDevelopment(players, state, null, "bye", new Set(), true, 0);
    expect(resting.players[id]!.suspended).toBe(true);
    expect(served.players[id]!.suspended).toBe(false);
  });

  it("retains a suspension earned in the just-completed live match", () => {
    const { state, id, player } = fixture();
    const fromLive = { [id]: { ...player, suspended: true } };
    const next = applyWeeklyDevelopment(fromLive, state, false, "red-card", new Set([id]), true, 0);
    expect(next.players[id]!.suspended).toBe(true);
    expect(state.players[id]!.suspended).toBe(false);
  });

  it("carries a live red card through the complete round transition", () => {
    const state = initCareer("bra", "fla", "Live suspension");
    const id = state.lineup[0]!;
    const next = advanceRound(
      state,
      { hg: 1, ag: 0 },
      [{ pid: id, goals: 0, assists: 0, played: true, red: true }],
      "Liga",
      0,
    );
    expect(next.players[id]!.suspended).toBe(true);
    expect(next.news.some((item) => item.id === `sentoff-${id}-${state.round}`)).toBe(true);
  });
});
