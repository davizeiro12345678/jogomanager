import { describe, expect, it } from "vitest";
import { buildTeamSetup } from "./quickMatch";
import { validMatchCommand } from "./match-command-validation";

describe("untrusted match command boundary", () => {
  const home = buildTeamSetup("fla"),
    away = buildTeamSetup("pal");
  const start = { id: 1, type: "startLive", home, away, seed: "safe-fixture" };
  it("accepts the real fixture without rewriting attributes, lineup or seed", () => {
    const before = structuredClone(start);
    expect(validMatchCommand(start)).toBe(true);
    expect(start).toEqual(before);
    expect(validMatchCommand({ ...start, weather: "heat", compact: true })).toBe(true);
  });
  it.each([
    null,
    "destroy",
    { id: 1, type: "destroy" },
    { ...start, seed: "s".repeat(4097) },
    { ...start, home: { ...home, players: Array(65).fill(home.players[0]) } },
    { ...start, home: { ...home, bench: [home.players[0]] } },
    { ...start, home: { ...home, players: [{ ...home.players[0], pace: Infinity }] } },
    { ...start, home: { ...home, tactics: { ...home.tactics, formation: "__proto__" } } },
    { id: 9, type: "pauseLive", paused: "false" },
    { id: 9, type: "tacticsLive", side: "destroy", tactics: home.tactics },
    { id: 9, type: "speedLive", speed: NaN },
    { id: 9, type: "talkLive", side: "away", kind: "__proto__" },
    {
      id: 9,
      type: "substituteLive",
      side: "away",
      outPid: "constructor",
      incoming: away.players[0],
    },
  ])("rejects malformed data without invoking a simulation", (message) => {
    expect(validMatchCommand(message)).toBe(false);
  });
  it("does not censor a harmless player name containing the word destroy", () => {
    expect(
      validMatchCommand({
        ...start,
        home: { ...home, players: [{ ...home.players[0], name: "Destroy United" }] },
      }),
    ).toBe(true);
  });
  it("refuses sparse roster and career arrays without throwing", () => {
    for (const key of ["players", "bench"] as const) {
      const message = { ...start, home: { ...home, [key]: Array(1) } };
      expect(() => validMatchCommand(message)).not.toThrow();
      expect(validMatchCommand(message)).toBe(false);
    }
    const career = {
      clubId: "fla",
      season: 1,
      round: 1,
      players: {},
      fixtures: [],
      lineup: [],
      finances: { budget: 10, spent: 0, income: 0 },
    };
    const command = {
      id: 1,
      type: "autoSeason",
      career,
      maxWeeks: 1,
      evaluatedAt: 1_800_000_000_000,
    };
    for (const key of ["fixtures", "lineup"] as const) {
      const sparse = { ...command, career: { ...career, [key]: Array(1) } };
      expect(() => validMatchCommand(sparse)).not.toThrow();
      expect(validMatchCommand(sparse)).toBe(false);
    }
    const advance = {
      id: 2,
      type: "advance",
      career,
      evaluatedAt: command.evaluatedAt,
      result: { hg: 0, ag: 0 },
      performances: Array(1),
    };
    expect(() => validMatchCommand(advance)).not.toThrow();
    expect(validMatchCommand(advance)).toBe(false);
  });
  it("accepts bounded control expiry and refuses missing, invalid or distant deadlines", () => {
    const command = {
      id: 9,
      type: "tacticsLive",
      side: "home",
      tactics: home.tactics,
      expiresAt: Date.now() + 2_000,
    };
    expect(validMatchCommand(command)).toBe(true);
    for (const expiresAt of [undefined, NaN, Infinity, -1, 1.5, Date.now() + 30_000])
      expect(validMatchCommand({ ...command, expiresAt })).toBe(false);
  });
  it("validates expensive career limits and performance fields before work begins", () => {
    const career = {
      clubId: "fla",
      season: 1,
      round: 1,
      players: {},
      fixtures: [],
      lineup: [],
      finances: { budget: 10, spent: 0, income: 0 },
    };
    const command = {
      id: 1,
      type: "autoSeason",
      career,
      maxWeeks: 60,
      evaluatedAt: 1_800_000_000_000,
    };
    expect(validMatchCommand(command)).toBe(true);
    for (const maxWeeks of [0, 1.5, Infinity, 61])
      expect(validMatchCommand({ ...command, maxWeeks })).toBe(false);
    const advance = {
      id: 2,
      type: "advance",
      evaluatedAt: command.evaluatedAt,
      career,
      result: { hg: 1, ag: 0 },
      performances: [{ pid: "fla-1", goals: 1, assists: 0, played: true }],
    };
    expect(validMatchCommand(advance)).toBe(true);
    expect(
      validMatchCommand({
        ...advance,
        performances: [{ ...advance.performances[0], minutes: Infinity }],
      }),
    ).toBe(false);
    for (const evaluatedAt of [undefined, -1, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER]) {
      expect(validMatchCommand({ ...command, evaluatedAt })).toBe(false);
      expect(validMatchCommand({ ...advance, evaluatedAt })).toBe(false);
    }
  });
});
