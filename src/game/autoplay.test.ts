import { describe, expect, it } from "vitest";
import { autoSeason, autoWeek } from "./autoplay";
import { initCareer } from "./career";
import { getLeague } from "./data/leagues";
import { generateFixtures } from "./season";

function oddLeagueCareer() {
  const clubs = getLeague("bra")
    .clubs.slice(0, 5)
    .map((club) => club.id);
  const clubId = clubs[0]!;
  const fixtures = generateFixtures("bra", "autoplay-bye", clubs);
  const byeRound = Array.from({ length: 5 }, (_, index) => index + 1).find(
    (round) =>
      !fixtures.some(
        (fixture) =>
          fixture.round === round && (fixture.home === clubId || fixture.away === clubId),
      ),
  )!;
  const initial = initCareer("bra", clubId, "Teste");
  return {
    ...initial,
    leagueClubs: { ...initial.leagueClubs, bra: clubs },
    fixtures,
    round: byeRound,
    streak: 2,
  };
}

describe("automação de temporadas com bye", () => {
  it("avança a folga sem inventar resultado ou efeito de empate", () => {
    const state = oddLeagueCareer();
    const week = autoWeek(state)!;

    expect(week.kind).toBe("bye");
    expect(week.state.round).toBe(state.round + 1);
    expect(week.state.matchLog).toEqual(state.matchLog);
    expect(week.state.results).toEqual(state.results);
    expect(week.state.approval).toBe(state.approval);
    expect(week.state.fanApproval).toBe(state.fanApproval);
    expect(week.state.pressure).toBe(state.pressure);
    expect(week.state.streak).toBe(state.streak);
    expect(week.state.news.some((item) => item.id === `res-${state.round}-${state.season}`)).toBe(
      false,
    );
    expect(
      week.state.fixtures
        .filter((fixture) => fixture.round === state.round)
        .every((fixture) => fixture.homeGoals !== null && fixture.awayGoals !== null),
    ).toBe(true);
  });

  it("continua simulando a temporada depois da folga", () => {
    const { weeks, state } = autoSeason(oddLeagueCareer(), 2);

    expect(weeks.map((week) => week.kind)).toEqual(["bye", "match"]);
    expect(state.round).toBe(weeks[1]!.round + 1);
  });
});
