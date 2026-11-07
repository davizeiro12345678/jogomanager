import { describe, expect, it } from "vitest";
import { parseTutorialLessons, practicedCareerLessons, tutorialProgress } from "./career-tutorial";

describe("resumable career tutorial", () => {
  const unplayed = {
    lineup: [],
    players: {},
    matchLog: [],
    round: 1,
    season: 1,
    results: [],
    clubId: "club",
    scoutReports: [],
  };
  it("does not count a newly created or merely opened career as practice", () => {
    expect([...practicedCareerLessons(unplayed)]).toEqual([]);
  });
  it("recognizes the first completed match and its preparation from stored results", () => {
    expect([
      ...practicedCareerLessons({
        ...unplayed,
        results: [{ round: 1, home: "club", away: "opponent", hg: 1, ag: 0 }],
      }),
    ]).toEqual(["prematch", "match"]);
  });
  it("recognizes the weekly budget lesson only from a committed weekly operation", () => {
    expect(
      practicedCareerLessons({
        ...unplayed,
        financeLedger: [
          {
            id: "signing-club-1-player",
            season: 1,
            round: 1,
            kind: "mercado",
            label: "Contratação",
            income: 0,
            expense: 2,
          },
        ],
      }),
    ).not.toContain("weekly-budget");
    expect(
      practicedCareerLessons({
        ...unplayed,
        financeLedger: [
          {
            id: "operations-club-1-1",
            season: 1,
            round: 1,
            kind: "operacao",
            label: "Operação semanal e jogo em casa",
            income: 3,
            expense: 1,
          },
        ],
      }),
    ).toContain("weekly-budget");
  });
  it("resumes at the next unpracticed lesson across chapters", () => {
    const progress = tutorialProgress(new Set(["club", "objectives"]));
    expect(progress.completed).toBe(2);
    expect(progress.total).toBe(19);
    expect(progress.next?.id).toBe("squad");
  });
  it("does not accept unknown or invalid stored lesson identifiers", () => {
    expect([...parseTutorialLessons(["club", "reward", 5, null])]).toEqual(["club"]);
    expect(parseTutorialLessons({ completed: true }).size).toBe(0);
  });
});
