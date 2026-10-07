import type { Bench } from "tinybench";

import { competitionScore } from "../competition-match";
import { LEAGUES } from "../data/leagues";
import { makeRng } from "../rng";
import { generateFixtures } from "../season";
import { simulateDivisionTable, tableFromFixtures } from "../standings";
import type { Fixture } from "../types";

export function registerSeasonBenchmarks(bench: Bench) {
  const league = LEAGUES.reduce((largest, current) =>
    current.clubs.length > largest.clubs.length ? current : largest,
  );
  const clubIds = league.clubs.map((club) => club.id);
  const country = league.country;
  const playedFixtures: Fixture[] = generateFixtures(league.id, "bench-season", clubIds).map(
    (fixture) => {
      const { hg, ag } = competitionScore(fixture.home, fixture.away, `bench-${fixture.round}`);
      return { ...fixture, homeGoals: hg, awayGoals: ag };
    },
  );

  bench
    .add("season: generateFixtures", () => {
      generateFixtures(league.id, "bench-season", clubIds);
    })
    .add("season: tableFromFixtures", () => {
      tableFromFixtures(clubIds, playedFixtures, country);
    })
    .add("season: simulateDivisionTable", () => {
      simulateDivisionTable(clubIds, country, "bench-division");
    })
    .add("rng: makeRng 10k draws", () => {
      const rnd = makeRng("bench-rng");
      let total = 0;
      for (let index = 0; index < 10_000; index += 1) total += rnd();
      return total;
    });
}
