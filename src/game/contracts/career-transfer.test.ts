import { describe, expect, it } from "vitest";
import { exportCareerFile, importCareerFile, previewCareerFile } from "./career-transfer";
import { initCareer } from "@/game/career/setup";
import { CLUBS } from "@/game/data/leagues";

const fresh = () => initCareer(CLUBS["fla"]!.league, "fla", "Davi");

describe("career transfer contract", () => {
  it("bounds hostile JSON before migration or checksum processing", () => {
    expect(() => importCareerFile(" ".repeat(4 * 1024 * 1024 + 1))).toThrow(/4 MB/);
    expect(() => importCareerFile('{"career":{"__proto__":{"polluted":true}}}')).toThrow(
      /reservada/,
    );
    expect(() => importCareerFile("[".repeat(40) + "0" + "]".repeat(40))).toThrow(/complexo/);
    expect(() => importCareerFile("null")).toThrow(/compativel/);
  });
  it("rejects modified files", () => {
    const exported = exportCareerFile(fresh()).replace("Davi", "Outro");
    expect(() => importCareerFile(exported)).toThrow(/alterado/);
  });
  it("rejects an empty or lossy career before offering a downloadable file", () => {
    expect(() => exportCareerFile({ version: 3 } as never)).toThrow(/carreira|incomplet/i);
    const career = fresh();
    expect(() => exportCareerFile({ ...career, players: {} })).toThrow(/elenco|incomplet/i);
    expect(() =>
      exportCareerFile({ ...career, finances: { ...career.finances, budget: Number.NaN } }),
    ).toThrow(/inválido|finanç/i);
    expect(() =>
      exportCareerFile({ ...career, managerName: "x".repeat(4 * 1024 * 1024) }),
    ).toThrow();
  });
  it("previews the actual serialized club, season, round, timestamp and save version", () => {
    const career = { ...fresh(), season: 2, round: 4, calendarYear: 2027 };
    const file = exportCareerFile(career);
    expect(previewCareerFile(file)).toMatchObject({
      managerName: "Davi",
      clubId: "fla",
      clubName: "Flamengo",
      season: 2,
      round: 4,
      calendarYear: 2027,
      gameSaveVersion: 3,
      playerCount: Object.keys(career.players).length,
      fixtureCount: career.fixtures.length,
      historyCount: 0,
    });
    expect(previewCareerFile(file).exportedAt).toBe(JSON.parse(file).exportedAt);
    expect(previewCareerFile(file).checksum).toMatch(/^[\da-f]{8}$/);
  });
  it("round trips a progressed career without losing squad, finances, calendar or history", () => {
    const career = fresh();
    career.season = 2;
    career.round = 4;
    career.calendarYear = 2027;
    career.finances = { budget: 38.75, spent: 12.5, income: 7.25 };
    career.fixtures[0] = { ...career.fixtures[0]!, homeGoals: 2, awayGoals: 1 };
    const fixture = career.fixtures[0]!;
    career.results = [{ round: 1, home: fixture.home, away: fixture.away, hg: 2, ag: 1 }];
    career.history = [{ season: 1, position: 2, pts: 77, w: 23, d: 8, l: 7, championId: "fla" }];
    const parsed = JSON.parse(exportCareerFile(career)).career;
    const restored = importCareerFile(exportCareerFile(career));
    expect(restored.players).toEqual(parsed.players);
    expect(restored.lineup).toEqual(parsed.lineup);
    expect(restored.bench).toEqual(parsed.bench);
    expect(restored.finances).toEqual({ budget: 38.75, spent: 12.5, income: 7.25 });
    expect(restored.fixtures).toEqual(parsed.fixtures);
    expect(restored.results).toEqual(parsed.results);
    expect(restored.history).toEqual(parsed.history);
    expect(restored.managerHistory).toEqual(parsed.managerHistory);
    expect([restored.season, restored.round, restored.calendarYear]).toEqual([2, 4, 2027]);
  });
  it("rejects invalid or unsupported envelope metadata instead of attempting migration", () => {
    const parsed = JSON.parse(exportCareerFile(fresh()));
    expect(() =>
      importCareerFile(JSON.stringify({ ...parsed, exportedAt: "not-a-date" })),
    ).toThrow();
    expect(() => importCareerFile(JSON.stringify({ ...parsed, gameSaveVersion: 99 }))).toThrow();
    expect(() => importCareerFile('{"clubs":{},"players":[],"competitions":[]}')).toThrow(
      /carreira/,
    );
  });
});
