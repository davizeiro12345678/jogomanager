import { describe, expect, it } from "vitest";

import { buildPerformances, autoWeek } from "./autoplay";
import { advanceRound, careerMatchContext, initCareer, pickLineup, quickSimulate } from "./career";
import { getLeague } from "./data/leagues";
import { generateFixtures } from "./season";

const evaluatedAt = 1_700_000_000_000;

describe("career match-day regression", () => {
  it("keeps new suspensions and injuries for the following match", () => {
    const state = initCareer("bra", "fla", "Teste");
    const [sentOff, booked, injured] = state.lineup;
    state.players[booked!] = { ...state.players[booked!]!, yellows: 2 };
    const next = advanceRound(
      state,
      { hg: 1, ag: 0 },
      [
        { pid: sentOff!, played: true, goals: 0, assists: 0, red: true },
        { pid: booked!, played: true, goals: 0, assists: 0, yellow: 1 },
        { pid: injured!, played: true, goals: 0, assists: 0, injuryWeeks: 2 },
      ],
      "Liga",
      evaluatedAt,
    );
    expect(next.players[sentOff!]!.suspended).toBe(true);
    expect(next.players[booked!]!.suspended).toBe(true);
    expect(next.players[booked!]!.yellows).toBe(0);
    expect(next.players[injured!]!.injuryWeeks).toBe(2);

    const afterNext = advanceRound(next, { hg: 0, ag: 0 }, [], "Liga", evaluatedAt);
    expect(afterNext.players[sentOff!]!.suspended).toBe(false);
    expect(afterNext.players[booked!]!.suspended).toBe(false);
    expect(afterNext.players[injured!]!.injuryWeeks).toBe(1);
  });

  it("uses eligible replacement players for automated goals and appearances", () => {
    const state = initCareer("bra", "fla", "Teste");
    const [injured, suspended, transferred] = state.lineup;
    state.players[injured!] = { ...state.players[injured!]!, injuryWeeks: 2 };
    state.players[suspended!] = { ...state.players[suspended!]!, suspended: true };
    state.players[transferred!] = { ...state.players[transferred!]!, clubId: "pal" };
    const eligible = Object.values(state.players).filter(
      (player) => player.clubId === state.clubId,
    );
    const expected = pickLineup(eligible, state.tactics.formation).lineup;
    const performances = buildPerformances(state, 5, "replacement-test");
    expect(performances.map((p) => p.pid)).toEqual(expected);
    expect(performances.map((p) => p.pid)).not.toContain(injured);
    expect(performances.map((p) => p.pid)).not.toContain(suspended);
    expect(performances.map((p) => p.pid)).not.toContain(transferred);
    expect(performances.reduce((sum, p) => sum + p.goals, 0)).toBe(5);
  });

  it("does not consume a suspension or apply match fatigue during a bye", () => {
    const clubs = getLeague("bra")
      .clubs.slice(0, 5)
      .map((club) => club.id);
    const state = initCareer("bra", clubs[0]!, "Teste");
    const fixtures = generateFixtures("bra", "bye-regression", clubs);
    const round = [1, 2, 3, 4, 5].find(
      (r) =>
        !fixtures.some(
          (f) => f.round === r && (f.home === state.clubId || f.away === state.clubId),
        ),
    )!;
    const id = state.lineup[0]!;
    const before = {
      ...state,
      leagueClubs: { ...state.leagueClubs, bra: clubs },
      fixtures,
      round,
      players: {
        ...state.players,
        [id]: { ...state.players[id]!, condition: 90, suspended: true },
      },
    };
    const week = autoWeek(before, evaluatedAt)!;
    expect(week.kind).toBe("bye");
    expect(week.state.players[id]!.suspended).toBe(true);
    expect(week.state.players[id]!.condition).toBeGreaterThanOrEqual(90);
  });

  it("rejects invalid scores and a second result for an already completed fixture", () => {
    const state = initCareer("bra", "fla", "Teste");
    for (const score of [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => advanceRound(state, { hg: score, ag: 0 }, [], "Liga", evaluatedAt)).toThrow();
    }
    const fixtures = state.fixtures.map((fixture) =>
      fixture.round === state.round &&
      (fixture.home === state.clubId || fixture.away === state.clubId)
        ? { ...fixture, homeGoals: 1, awayGoals: 1 }
        : fixture,
    );
    expect(() =>
      advanceRound({ ...state, fixtures }, { hg: 2, ag: 0 }, [], "Liga", evaluatedAt),
    ).toThrow();
  });

  it("keeps every other match identical to the existing seeded simulation", () => {
    const initial = initCareer("bra", "fla", "Teste");
    const round = 16;
    const state = {
      ...initial,
      round,
      fixtures: initial.fixtures
        .map((fixture) => {
          if (fixture.round >= round) return fixture;
          const result = quickSimulate(
            fixture.home,
            fixture.away,
            `history-${fixture.round}-${fixture.home}`,
          );
          return { ...fixture, homeGoals: result.hg, awayGoals: result.ag, events: result.events };
        })
        .reverse(),
    };
    const matches = state.fixtures.filter(
      (fixture) =>
        fixture.round === round && fixture.home !== state.clubId && fixture.away !== state.clubId,
    );
    const expected = matches.map((fixture) => {
      const result = quickSimulate(
        fixture.home,
        fixture.away,
        `${state.clubId}-${state.season}-${round}-${fixture.home}`,
        careerMatchContext(state, fixture.home, fixture.away),
      );
      return { ...fixture, homeGoals: result.hg, awayGoals: result.ag, events: result.events };
    });
    const next = advanceRound(state, { hg: 1, ag: 1 }, [], "Liga", evaluatedAt);
    expect(
      next.fixtures.filter((fixture) =>
        matches.some((m) => m.home === fixture.home && m.away === fixture.away),
      ),
    ).toEqual(expected);
  });
});
