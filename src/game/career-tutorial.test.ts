import { describe, expect, it } from "vitest";
import {
  parseReviewedTutorialLessons,
  parseTutorialLessons,
  practicedCareerLessons,
  tutorialProgress,
  verifiedCareerLessons,
} from "./career-tutorial";

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
      ...verifiedCareerLessons({
        ...unplayed,
        results: [{ round: 1, home: "club", away: "opponent", hg: 1, ag: 0 }],
      }),
    ]).toEqual(["prematch", "match"]);
  });
  it("recognizes the weekly budget lesson only from a committed weekly operation", () => {
    expect(
      verifiedCareerLessons({
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
      verifiedCareerLessons({
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
  it("treats legacy array marks as review only, never as verified evidence", () => {
    const reviewed = parseTutorialLessons(["coach-decisions", "reward"]);
    expect([...reviewed]).toEqual(["coach-decisions"]);

    const progress = tutorialProgress(new Set(), reviewed);
    expect(progress.reviewed).toBe(1);
    expect(progress.verified).toBe(0);
  });
  it("keeps verified evidence separate from manual review marks", () => {
    const verified = verifiedCareerLessons({
      ...unplayed,
      results: [{ round: 1, home: "club", away: "opponent", hg: 1, ag: 0 }],
    });
    const progress = tutorialProgress(verified, new Set(["club", "prematch"]));
    expect(progress.verified).toBe(2);
    expect(progress.reviewed).toBe(1);
    expect(progress.completed).toBe(3);
    expect(progress.next?.id).toBe("objectives");
  });
  it("resumes at the next incomplete lesson across chapters", () => {
    const progress = tutorialProgress(new Set(["club", "objectives"]));
    expect(progress.completed).toBe(2);
    expect(progress.total).toBe(19);
    expect(progress.next?.id).toBe("squad");
  });
  it("does not accept unknown or invalid manual review identifiers", () => {
    expect([...parseReviewedTutorialLessons(["club", "reward", 5, null])]).toEqual(["club"]);
    expect(parseReviewedTutorialLessons({ completed: true }).size).toBe(0);
    expect(parseTutorialLessons).toBe(parseReviewedTutorialLessons);
    expect(practicedCareerLessons).toBe(verifiedCareerLessons);
  });
});
