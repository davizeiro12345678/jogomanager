import { CLUBS, LEAGUES } from "./data/leagues";
import {
  calendarYear,
  confederationFor,
  CONTINENTAL_NAMES,
  type Confederation,
} from "./competition-regulations";
import { countryOfClub, sameClub, primaryCompetitionId } from "./competition-season";
import type { CareerState } from "./types";

export const CLUB_WORLD_CUP_QUOTA: Record<string, number> = {
  "Champions League": 12,
  "Copa Libertadores": 6,
  "CONCACAF Champions Cup": 4,
  "AFC Champions League Elite": 4,
  "CAF Champions League": 4,
  "OFC Champions League": 1,
};
/** O ranking é formado por pontos dos jogos continentais da carreira, não pela força do catálogo. */
export function worldCupField(state: CareerState): string[] {
  if ((calendarYear(state) - 2025) % 4 !== 0) return [];
  const recent = (state.competitionHistory ?? []).filter(
    (h) => h.year >= calendarYear(state) - 4 && h.year < calendarYear(state),
  );
  if (!recent.length) return [];
  const field: string[] = [];
  for (const confed of Object.keys(CONTINENTAL_NAMES) as Confederation[]) {
    const competitionId = primaryCompetitionId(confed),
      quota = CLUB_WORLD_CUP_QUOTA[CONTINENTAL_NAMES[confed]]!;
    const champions = recent
      .map((h) => h.champions[competitionId])
      .filter((id): id is string => Boolean(id));
    const ranking: Record<string, number> = {};
    for (const h of recent)
      for (const [id, points] of Object.entries(h.continentalPoints))
        ranking[id] = (ranking[id] ?? 0) + points;
    const candidates = Object.keys(ranking).filter(
      (id) => confederationFor(countryOfClub(id) ?? "") === confed,
    );
    const selected: string[] = [];
    const add = (id: string, champion: boolean) => {
      if (
        !CLUBS[id] ||
        selected.length >= quota ||
        selected.some((other) => sameClub(id, other)) ||
        field.some((other) => sameClub(id, other))
      )
        return;
      if (
        !champion &&
        selected.filter((other) => countryOfClub(id) === countryOfClub(other)).length >= 2
      )
        return;
      selected.push(id);
    };
    // OFC usa o campeão mais bem colocado no período; outras confederações dão prioridade a todos os campeões.
    for (const id of [...champions].sort(
      (a, b) => (ranking[b] ?? 0) - (ranking[a] ?? 0) || a.localeCompare(b),
    ))
      add(id, true);
    for (const id of candidates.sort(
      (a, b) => (ranking[b] ?? 0) - (ranking[a] ?? 0) || a.localeCompare(b),
    ))
      add(id, false);
    if (selected.length !== quota) return [];
    field.push(...selected);
  }
  // A sede futura ainda não foi escolhida pelo motor: EUA é a sede da edição adaptada do save.
  const hosts = state.competitionHistory?.at(-1)?.tables["usa"] ?? [];
  const hostChampion = state.competitionHistory?.at(-1)?.champions["league:usa"];
  const host =
    [
      ...(hostChampion ? [hostChampion] : []),
      ...hosts.map((r) => r.clubId),
      ...(LEAGUES.find((l) => l.id === "usa")?.clubs.map((c) => c.id) ?? []),
    ].find((id) => !field.some((other) => sameClub(id, other))) ??
    state.qualifications
      ?.filter((e) => e.competitionId === "national:Estados Unidos")
      .map((e) => e.clubId)
      .find((id) => !field.some((other) => sameClub(id, other)));
  if (!host) return [];
  return [...field, host];
}

export function intercontinentalField(state: CareerState): Partial<Record<Confederation, string>> {
  const history = state.competitionHistory?.find((h) => h.season === state.season - 1);
  return Object.fromEntries(
    (Object.keys(CONTINENTAL_NAMES) as Confederation[]).flatMap((confed) => {
      const champion = history?.champions[primaryCompetitionId(confed)];
      return champion ? [[confed, champion]] : [];
    }),
  );
}
