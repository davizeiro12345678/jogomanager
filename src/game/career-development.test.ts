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
  it("retains a __proto__ player ID as an own record without prototype mutation", () => {
    const { state, player } = fixture();
    const untrusted = Object.create(null) as Record<string, typeof player>;
    Object.defineProperty(untrusted, "__proto__", {
      value: { ...player, clubId: "unrelated-club" },
      enumerable: true,
      writable: true,
      configurable: true,
    });
    const result = applyWeeklyDevelopment(
      untrusted,
      state,
      null,
      "untrusted-id",
      new Set(),
      false,
      0,
    );
    expect(Object.hasOwn(result.players, "__proto__")).toBe(true);
    expect(Object.getPrototypeOf(result.players)).toBeNull();
  });

  it("keeps a legacy roster key separate from the profile ID used to read gains", () => {
    const state = initCareer("bra", "fla", "Legacy roster");
    const [first, second] = Object.values(state.players);
    const players = {
      "visita/07": { ...first!, id: "perfil A", age: 19 },
      reserva: { ...second!, id: "visita/07", age: 28 },
    };
    const attrDeltas = { "perfil A": { passing: 0.75 }, "visita/07": { finishing: 1.5 } };
    const next = applyWeeklyDevelopment(
      players,
      { ...state, players, attrDeltas },
      null,
      "4",
      new Set(),
      false,
      0,
    );
    const gain = next.attrDeltas["visita/07"]!;
    expect(gain.pace).toBeGreaterThan(0);
    expect(gain.passing).toBe(0.75);
    expect(next.players["visita/07"]!.developmentDelta).toEqual(attrDeltas["perfil A"]);
    expect(next.players["reserva"]!.developmentDelta).toEqual(gain);
    expect(attrDeltas["visita/07"]).toEqual({ finishing: 1.5 });
  });

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
