import { describe, expect, it } from "vitest";
import { parseTutorialLessons, tutorialProgress } from "./career-tutorial";

describe("resumable career tutorial", () => {
  it("resumes at the next unpracticed lesson across four chapters", () => {
    const progress = tutorialProgress(new Set(["club", "objectives"]));
    expect(progress.completed).toBe(2);
    expect(progress.total).toBe(10);
    expect(progress.next?.id).toBe("squad");
  });
  it("does not accept unknown or invalid stored lesson identifiers", () => {
    expect([...parseTutorialLessons(["club", "reward", 5, null])]).toEqual(["club"]);
    expect(parseTutorialLessons({ completed: true }).size).toBe(0);
  });
});
