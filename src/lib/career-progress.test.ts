import { describe, expect, it } from "vitest";
import type { CareerState } from "@/game/types";
import { continuesVerifiedCareer, isStaleSave } from "./career-progress";

const base = (over: Partial<CareerState> = {}) =>
  ({
    leagueId: "l",
    clubId: "c",
    managerName: "m",
    season: 1,
    round: 1,
    results: [],
    history: [],
    ...over,
  }) as unknown as CareerState;
const r = (round: number) => ({ round, home: "c", away: "x", hg: 2, ag: 1 });

describe("career progress", () => {
  it("rejects an older save of the same career", () => {
    expect(isStaleSave(base({ round: 5 }), base({ round: 3 }))).toBe(true);
    expect(isStaleSave(base({ round: 5 }), base({ round: 6 }))).toBe(false);
    expect(isStaleSave(base({ round: 5 }), base({ round: 1, clubId: "other" }))).toBe(false);
  });
  it("attests legitimate append-only progress", () => {
    expect(continuesVerifiedCareer(base(), base({ round: 2, results: [r(1)] }), 20_000)).toBe(true);
  });
  it("rejects rewritten history and impossible speed", () => {
    const prev = base({ round: 2, results: [r(1)] });
    expect(
      continuesVerifiedCareer(
        prev,
        base({ round: 3, results: [{ ...r(1), hg: 9 }, r(2)] }),
        60_000,
      ),
    ).toBe(false);
    expect(continuesVerifiedCareer(base(), base({ round: 30 }), 1_000)).toBe(false);
  });
});
