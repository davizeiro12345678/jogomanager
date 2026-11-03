import { describe, expect, it } from "vitest";
import { initCareer } from "./career";
import {
  HIGH_PRESSURE,
  RETURN_REMINDER_HOURS,
  nextObjectives,
  returnReminder,
} from "./next-objectives";
import { LEAGUES } from "./data/leagues";

const league = LEAGUES[0]!;
const fresh = () => initCareer(league.id, league.clubs[0]!.id, "Teste");

describe("next objectives", () => {
  it("lists at most three goals, including the board target and the next match", () => {
    const goals = nextObjectives(fresh());
    expect(goals.length).toBeLessThanOrEqual(3);
    expect(goals.map((g) => g.id)).toEqual(expect.arrayContaining(["board", "match"]));
  });
  it("puts board pressure first once it reaches 70", () => {
    const career = { ...fresh(), pressure: HIGH_PRESSURE };
    expect(nextObjectives(career)[0]!.id).toBe("pressure");
    expect(nextObjectives({ ...career, pressure: HIGH_PRESSURE - 1 })[0]!.id).not.toBe("pressure");
  });
});

describe("return reminder", () => {
  const now = Date.UTC(2026, 10, 3, 12);
  it("stays silent before 12 hours away", () => {
    expect(
      returnReminder(now - (RETURN_REMINDER_HOURS - 1) * 3_600_000, { season: 1, round: 5 }, now),
    ).toBeNull();
  });
  it("welcomes the player back after 12 hours, in days after two days", () => {
    expect(returnReminder(now - 12 * 3_600_000, { season: 1, round: 5 }, now)?.message).toContain(
      "12 horas",
    );
    expect(returnReminder(now - 72 * 3_600_000, { season: 2, round: 9 }, now)?.message).toContain(
      "3 dias",
    );
  });
  it("ignores missing or future timestamps", () => {
    expect(returnReminder(null, { season: 1, round: 1 }, now)).toBeNull();
    expect(returnReminder(now + 1000, { season: 1, round: 1 }, now)).toBeNull();
  });
});
