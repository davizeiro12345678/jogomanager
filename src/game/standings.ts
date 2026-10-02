import { countryRegulation, type TieCriterion } from "./competition-regulations";
import type { Fixture, TableRow } from "./types";
import { competitionScore } from "./competition-match";

/** Desempata grupos empatados; confronto direto usa uma minitabela, nunca comparações cíclicas. */
export function rankTable(rows: TableRow[], fixtures: Fixture[], country: string): TableRow[] {
  const criteria = countryRegulation(country).tieBreakers;
  const split = (group: TableRow[], remaining: TieCriterion[]): TableRow[] => {
    if (group.length < 2) return group;
    const criterion = remaining[0];
    if (!criterion) return [...group].sort((a, b) => a.clubId.localeCompare(b.clubId));
    const ids = new Set(group.map((r) => r.clubId));
    const head = new Map(group.map((r) => [r.clubId, 0]));
    if (criterion === "headToHead") {
      // A CBF só aplica confronto direto quando restam duas associações empatadas.
      if (country === "Brasil" && group.length !== 2) return split(group, remaining.slice(1));
      const meetings = fixtures.filter((f) => ids.has(f.home) && ids.has(f.away));
      if (!meetings.length || meetings.some((f) => f.homeGoals === null || f.awayGoals === null))
        return split(group, remaining.slice(1));
      for (const f of meetings) {
        head.set(
          f.home,
          head.get(f.home)! +
            (f.homeGoals! > f.awayGoals! ? 3 : f.homeGoals === f.awayGoals ? 1 : 0),
        );
        head.set(
          f.away,
          head.get(f.away)! +
            (f.awayGoals! > f.homeGoals! ? 3 : f.homeGoals === f.awayGoals ? 1 : 0),
        );
      }
    }
    const value = (r: TableRow): number =>
      criterion === "wins"
        ? r.w
        : criterion === "goalDifference"
          ? r.gf - r.ga
          : criterion === "goalsFor"
            ? r.gf
            : criterion === "headToHead"
              ? head.get(r.clubId)!
              : -fixtures.reduce(
                  (cards, f) =>
                    cards +
                    (f.events?.filter((e) => e.kind === "vermelho" && f[e.side] === r.clubId)
                      .length ?? 0),
                  0,
                );
    const buckets = new Map<number, TableRow[]>();
    for (const row of group) {
      const key = value(row);
      buckets.set(key, [...(buckets.get(key) ?? []), row]);
    }
    return [...buckets]
      .sort(([a], [b]) => b - a)
      .flatMap(([, bucket]) => split(bucket, remaining.slice(1)));
  };
  const points = new Map<number, TableRow[]>();
  for (const row of rows) points.set(row.pts, [...(points.get(row.pts) ?? []), row]);
  return [...points].sort(([a], [b]) => b - a).flatMap(([, group]) => split(group, criteria));
}

export function tableFromFixtures(
  clubIds: string[],
  fixtures: Fixture[],
  country: string,
): TableRow[] {
  const rows = new Map(
    clubIds.map((clubId) => [clubId, { clubId, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }]),
  );
  for (const f of fixtures) {
    if (f.homeGoals === null || f.awayGoals === null) continue;
    const h = rows.get(f.home),
      a = rows.get(f.away);
    if (!h || !a) continue;
    h.p++;
    a.p++;
    h.gf += f.homeGoals;
    h.ga += f.awayGoals;
    a.gf += f.awayGoals;
    a.ga += f.homeGoals;
    if (f.homeGoals > f.awayGoals) {
      h.w++;
      h.pts += 3;
      a.l++;
    } else if (f.homeGoals < f.awayGoals) {
      a.w++;
      a.pts += 3;
      h.l++;
    } else {
      h.d++;
      a.d++;
      h.pts++;
      a.pts++;
    }
  }
  return rankTable([...rows.values()], fixtures, country);
}

export function tableDetails(fixtures: Fixture[], clubId: string) {
  const played = fixtures
    .filter(
      (f) =>
        (f.home === clubId || f.away === clubId) && f.homeGoals !== null && f.awayGoals !== null,
    )
    .sort((a, b) => a.round - b.round);
  const points = (f: Fixture) => {
    const gf = f.home === clubId ? f.homeGoals! : f.awayGoals!,
      ga = f.home === clubId ? f.awayGoals! : f.homeGoals!;
    return gf > ga ? 3 : gf === ga ? 1 : 0;
  };
  const home = played.filter((f) => f.home === clubId),
    away = played.filter((f) => f.away === clubId);
  return {
    form: played
      .slice(-5)
      .map((f) => ({ result: points(f) === 3 ? "V" : points(f) === 1 ? "E" : "D", fixture: f })),
    homePoints: home.reduce((sum, f) => sum + points(f), 0),
    awayPoints: away.reduce((sum, f) => sum + points(f), 0),
    next: fixtures
      .filter((f) => (f.home === clubId || f.away === clubId) && f.homeGoals === null)
      .sort((a, b) => a.round - b.round)[0],
  };
}

export function simulateDivisionTable(
  clubIds: string[],
  country: string,
  seed: string,
): TableRow[] {
  const fixtures: Fixture[] = [];
  for (let i = 0; i < clubIds.length; i++)
    for (let j = i + 1; j < clubIds.length; j++) {
      for (const [home, away] of [
        [clubIds[i]!, clubIds[j]!],
        [clubIds[j]!, clubIds[i]!],
      ] as const) {
        const { hg, ag } = competitionScore(home, away, `${seed}-${home}-${away}`);
        fixtures.push({ round: fixtures.length + 1, home, away, homeGoals: hg, awayGoals: ag });
      }
    }
  return tableFromFixtures(clubIds, fixtures, country);
}
