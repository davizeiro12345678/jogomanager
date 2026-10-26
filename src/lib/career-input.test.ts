import { describe, expect, it } from "vitest";
import { parseCareerInput } from "./career-input";

const validCareer = () => ({
  state: {
    leagueId: "brasileirao",
    clubId: "fla",
    managerName: "Treinador",
    season: 1,
    round: 1,
    fixtures: [],
    results: [],
  },
});

describe("career sync JSON validation", () => {
  it("omits optional undefined fields preserved by IndexedDB without losing saves", () => {
    const saved = {
      state: {
        ...validCareer().state,
        financeSettledThrough: undefined,
        options: { optional: undefined, available: true },
      },
    };
    const parsed = parseCareerInput(saved);
    expect(parsed.state).not.toHaveProperty("financeSettledThrough");
    expect(parsed.state).toHaveProperty("options", { available: true });
  });

  it("still rejects non-JSON array entries and unsafe career fields", () => {
    const career = validCareer();
    expect(() => parseCareerInput({ state: { ...career.state, fixtures: [undefined] } })).toThrow();
    expect(() =>
      parseCareerInput({ state: { ...career.state, round: Number.POSITIVE_INFINITY } }),
    ).toThrow();
    const malicious = JSON.parse(
      '{"state":{"leagueId":"brasileirao","clubId":"fla","managerName":"Treinador","season":1,"round":1,"fixtures":[],"results":[],"__proto__":{}}}',
    ) as unknown;
    expect(() => parseCareerInput(malicious)).toThrow();
  });
});
