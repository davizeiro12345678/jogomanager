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
  it("rejects an ineligible startLive lineup at the worker command boundary", () => {
    const noGoalkeeper = {
      ...home,
      players: home.players.map((player) => ({
        ...player,
        pos: player.pos === "GK" ? "DF" : player.pos,
      })),
    };
    expect(validMatchCommand({ ...start, home: noGoalkeeper })).toBe(false);
  });
  it("rejects ineligible starters while allowing unavailable reserves", () => {
    const shortLineup = { ...home, players: home.players.slice(0, 10) };
    const injuredStarter = {
      ...home,
      players: home.players.map((player, index) =>
        index === 1 ? { ...player, injuryWeeks: 1 } : player,
      ),
    };
    const suspendedStarter = {
      ...home,
      players: home.players.map((player, index) =>
        index === 1 ? { ...player, suspended: true } : player,
      ),
    };
    const unavailableReserve = {
      ...home,
      bench: [
        {
          ...home.players[0]!,
          id: "fla-bench-fixture",
          pos: "FW",
          injuryWeeks: 1,
          suspended: true,
        },
      ],
    };
    expect(validMatchCommand({ ...start, home: shortLineup })).toBe(false);
    expect(validMatchCommand({ ...start, home: injuredStarter })).toBe(false);
    expect(validMatchCommand({ ...start, home: suspendedStarter })).toBe(false);
    expect(validMatchCommand({ ...start, home: unavailableReserve })).toBe(true);
  });
  it("rejects mismatched and reserved clubs through roster ownership checks", () => {
    const mismatchedClub = { ...home, clubId: "pal" };
    const reservedClub = {
      ...home,
      clubId: "constructor",
      players: home.players.map((player) => ({ ...player, clubId: "constructor" })),
    };
    expect(validMatchCommand({ ...start, home: mismatchedClub })).toBe(false);
    expect(validMatchCommand({ ...start, home: reservedClub })).toBe(false);
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
        home: {
          ...home,
          players: [{ ...home.players[0], name: "Destroy United" }, ...home.players.slice(1)],
        },
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
    const careerPlayers = Object.fromEntries(
      [...home.players, ...(home.bench ?? [])].map((player) => [player.id, player]),
    );
    const career = {
      clubId: "fla",
      season: 1,
      round: 1,
      players: careerPlayers,
      fixtures: [],
      lineup: home.players.map((player) => player.id),
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
    const firstId = career.lineup[0]!;
    const secondId = career.lineup[1]!;
    const goalkeeper = home.players.find((player) => player.pos === "GK")!;
    const unavailableCareer = {
      ...career,
      players: {
        ...careerPlayers,
        [secondId]: { ...careerPlayers[secondId]!, injuryWeeks: 1 },
      },
    };
    const suspendedCareer = {
      ...career,
      players: {
        ...careerPlayers,
        [secondId]: { ...careerPlayers[secondId]!, suspended: true },
      },
    };
    expect(validMatchCommand({ ...command, career: unavailableCareer })).toBe(true);
    expect(validMatchCommand({ ...command, career: suspendedCareer })).toBe(true);
    const missingPlayer = { ...careerPlayers };
    delete missingPlayer[firstId];
    const invalidCareers: unknown[] = [
      { ...career, lineup: career.lineup.slice(1) },
      { ...career, lineup: [...career.lineup.slice(0, -1), firstId] },
      { ...career, players: missingPlayer },
      {
        ...career,
        players: {
          ...careerPlayers,
          [secondId]: { ...careerPlayers[secondId]!, id: firstId },
        },
      },
      {
        ...career,
        players: {
          ...careerPlayers,
          [firstId]: { ...careerPlayers[firstId]!, id: "fla-key-divergent" },
        },
      },
      {
        ...career,
        players: { ...careerPlayers, [firstId]: { ...careerPlayers[firstId]!, id: " " } },
      },
      {
        ...career,
        players: { ...careerPlayers, [firstId]: { ...careerPlayers[firstId]!, clubId: "pal" } },
      },
      {
        ...career,
        players: { ...careerPlayers, [firstId]: { ...careerPlayers[firstId]!, injuryWeeks: -1 } },
      },
      {
        ...career,
        players: { ...careerPlayers, [firstId]: { ...careerPlayers[firstId]!, suspended: null } },
      },
      {
        ...career,
        players: {
          ...careerPlayers,
          [goalkeeper.id]: { ...careerPlayers[goalkeeper.id]!, pos: "DF" },
        },
      },
    ];
    const originalCareer = structuredClone(career);
    for (const invalidCareer of invalidCareers)
      expect(validMatchCommand({ ...command, career: invalidCareer })).toBe(false);
    expect(career).toEqual(originalCareer);
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
    expect(validMatchCommand({ ...advance, career: unavailableCareer })).toBe(false);
    expect(validMatchCommand({ ...advance, career: suspendedCareer })).toBe(false);
    const sparsePerformances = Array(1);
    expect(validMatchCommand({ ...advance, performances: sparsePerformances })).toBe(false);
    const reserve = home.bench?.[0];
    if (!reserve) throw new Error("fixture must include a reserve");
    const reservePerformance = { ...advance.performances[0]!, pid: reserve.id };
    expect(validMatchCommand({ ...advance, performances: [reservePerformance] })).toBe(true);
    expect(
      validMatchCommand({
        ...advance,
        performances: [
          { ...advance.performances[0]!, pid: reserve.id },
          { ...advance.performances[0]!, pid: reserve.id },
        ],
      }),
    ).toBe(false);
    expect(
      validMatchCommand({
        ...advance,
        performances: [{ ...advance.performances[0]!, pid: "fla-ghost" }],
      }),
    ).toBe(false);
    const divergentReserve = {
      ...career,
      players: {
        ...careerPlayers,
        [reserve.id]: { ...reserve, id: "fla-reserve-divergent" },
      },
    };
    expect(
      validMatchCommand({
        ...advance,
        career: divergentReserve,
        performances: [reservePerformance],
      }),
    ).toBe(false);
    const foreignReserve = {
      ...career,
      players: {
        ...careerPlayers,
        "pal-reserve": { ...reserve, id: "pal-reserve", clubId: "pal" },
      },
    };
    expect(
      validMatchCommand({
        ...advance,
        career: foreignReserve,
        performances: [{ ...reservePerformance, pid: "pal-reserve" }],
      }),
    ).toBe(false);
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
