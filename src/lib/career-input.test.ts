import { describe, expect, it } from "vitest";
import { parseCareerInput } from "./career-input";

const valid = () => ({
  state: {
    leagueId: "league",
    clubId: "club",
    managerName: "Treinador",
    season: 1,
    round: 1,
    fixtures: [],
    results: [],
  },
});

describe("career sync input", () => {
  it("accepts a valid career and rejects an oversized nested string", () => {
    expect(parseCareerInput(valid()).state.clubId).toBe("club");
    expect(() => parseCareerInput({ ...valid(), note: "a".repeat(8_000_001) })).toThrow(/limites/);
  });

  it("rejects prototype-pollution keys and accessors without executing them", () => {
    const poisoned = JSON.parse('{"state":{"__proto__":{"polluted":true}}}');
    expect(() => parseCareerInput(poisoned)).toThrow(/inválido/);
    let called = false;
    const value = Object.defineProperty(valid(), "hostile", {
      enumerable: true,
      get() {
        called = true;
        return "unsafe";
      },
    });
    expect(() => parseCareerInput(value)).toThrow(/inválido/);
    expect(called).toBe(false);
  });
});
