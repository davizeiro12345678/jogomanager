import { CLUBS, LEAGUES, getLeague } from "./data/leagues";
import { SERIE_D_IDS } from "./data/serie-d";
import {
  calendarYear,
  CONTINENTAL_NAMES,
  countryRegulation,
  SECONDARY_NAMES,
  type Confederation,
} from "./competition-regulations";
import { leagueClubIds, REGIONAL_LINKS, type PyramidMove } from "./pyramid";
import { simulateDivisionTable } from "./standings";
import { competitionPlayoff } from "./competition-match";
import type {
  CareerState,
  CompetitionQualification,
  CompetitionSeasonRecord,
  CupState,
  TableRow,
} from "./types";

export const primaryCompetitionId = (confederation: Confederation) =>
  `continental:${confederation}`;
export const secondaryCompetitionId = (confederation: Confederation) =>
  `secondary:${confederation}`;
export const nationalCompetitionId = (country: string) => `national:${country}`;
let catalogIndex:
  | {
      countries: Map<string, string>;
      topLeagues: Map<string, (typeof LEAGUES)[number]>;
    }
  | undefined;
function competitionCatalog() {
  if (!catalogIndex) {
    const countries = new Map<string, string>();
    const topLeagues = new Map<string, (typeof LEAGUES)[number]>();
    for (const league of LEAGUES) {
      if (!topLeagues.has(league.country)) topLeagues.set(league.country, league);
      for (const club of league.clubs) countries.set(club.id, league.country);
    }
    catalogIndex = { countries, topLeagues };
  }
  return catalogIndex;
}
const NORMAL_NAMES = new Map<string, string>();
export function countryOfClub(id: string): string | undefined {
  return (
    competitionCatalog().countries.get(id) ??
    (CLUBS[id] ? getLeague(CLUBS[id]!.league).country : undefined)
  );
}
export function topLeague(country: string) {
  return competitionCatalog().topLeagues.get(country);
}

/** Identidade física de clubes importados em mais de um campeonato; IDs dos saves são preservados. */
export function sameClub(a: string, b: string): boolean {
  if (a === b) return true;
  if (countryOfClub(a) !== countryOfClub(b)) return false;
  const source = (id: string) => CLUBS[id]?.sourceTeamId ?? id.match(/_(\d{5,})$/)?.[1];
  if (source(a) && source(a) === source(b)) return true;
  const normalize = (id: string) => {
    const cached = NORMAL_NAMES.get(id);
    if (cached) return cached;
    const normalized = (CLUBS[id]?.name ?? id)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/gi, "")
      .toLowerCase();
    NORMAL_NAMES.set(id, normalized);
    return normalized;
  };
  return normalize(a) === normalize(b);
}

/** Uma única fotografia: tabelas reais do jogador e temporadas determinísticas dos demais clubes. */
export function seasonTables(state: CareerState, actual: TableRow[]): Record<string, TableRow[]> {
  const country = getLeague(state.leagueId).country;
  const selected = LEAGUES.filter(
    (l) => l.country === country || topLeague(l.country)?.id === l.id,
  );
  return Object.fromEntries(
    selected.map((l) => [
      l.id,
      l.id === state.leagueId
        ? actual
        : simulateDivisionTable(
            leagueClubIds(state, l.id),
            l.country,
            `season-${state.season}-${l.id}`,
          ),
    ]),
  );
}

export function leagueQualificationPreview(
  state: CareerState,
  table: TableRow[],
): CompetitionQualification[] {
  const league = getLeague(state.leagueId);
  if (REGIONAL_LINKS[league.id]) return [];
  if (topLeague(league.country)?.id !== league.id) return [];
  return resolveQualifications(
    state,
    { [league.id]: table },
    state.cups ?? [],
    state.leagueClubs,
    state.season + 1,
  );
}

/** Sem entradas duplicadas: vaga pela copa passa ao próximo colocado quando necessário. */
export function resolveQualifications(
  state: CareerState,
  tables: Record<string, TableRow[]>,
  cups: CupState[],
  composition = state.leagueClubs,
  season = state.season + 1,
): CompetitionQualification[] {
  const entries: CompetitionQualification[] = [];
  const year = calendarYear(state);
  const add = (
    clubId: string | undefined,
    competitionId: string,
    name: string,
    phase: CompetitionQualification["phase"],
    reason: string,
  ) => {
    if (
      !clubId ||
      !CLUBS[clubId] ||
      entries.some((e) => e.competitionId === competitionId && sameClub(e.clubId, clubId))
    )
      return;
    entries.push({ clubId, competitionId, name, phase, reason, season });
  };
  const champion = (id: string) => cups.find((c) => c.competitionId === id)?.winner ?? undefined;
  const eps = new Map<string, { points: number; clubs: Set<string> }>();
  if (year > 2026)
    for (const cup of cups.filter(
      (c) =>
        c.competitionId === "continental:UEFA" ||
        c.competitionId === "secondary:UEFA" ||
        c.competitionId === "conference:UEFA",
    )) {
      const score = (id: string, points: number) => {
        const country = countryOfClub(id);
        if (!country) return;
        const row = eps.get(country) ?? { points: 0, clubs: new Set<string>() };
        row.points += points;
        row.clubs.add(id);
        eps.set(country, row);
      };
      for (const group of cup.groups ?? [])
        for (const m of group.matches)
          if (m.hg !== null && m.ag !== null) {
            score(m.home, m.hg > m.ag ? 3 : m.hg === m.ag ? 1 : 0);
            score(m.away, m.ag > m.hg ? 3 : m.hg === m.ag ? 1 : 0);
          }
      for (const t of cup.ties)
        if (t.hg !== null && t.ag !== null) {
          score(t.home, t.hg > t.ag ? 3 : 0);
          score(t.away, t.ag > t.hg ? 3 : 0);
        }
    }
  const epsCountries = [...eps]
    .sort(
      ([a, x], [b, y]) => y.points / y.clubs.size - x.points / x.clubs.size || a.localeCompare(b),
    )
    .slice(0, 2)
    .map(([country]) => country);
  for (const league of LEAGUES) {
    if (topLeague(league.country)?.id !== league.id || !tables[league.id]) continue;
    const rules = countryRegulation(league.country, year),
      confed = rules.confederation;
    if (epsCountries.includes(league.country)) {
      rules.primary++;
      rules.primaryDirect++;
    }
    if (!confed) continue;
    const primary = primaryCompetitionId(confed),
      name = CONTINENTAL_NAMES[confed];
    const ranks = tables[league.id]!.map((r) => r.clubId);
    const nextTop = composition?.[league.id] ?? league.clubs.map((c) => c.id);
    const eligible = (id: string) => nextTop.some((other) => sameClub(id, other));
    const cup = cups.find((c) => c.competitionId === nationalCompetitionId(league.country));
    const cupWinners = [
      cup?.winner,
      ...(rules.cupBerths > 1 ? (cup?.finalists ?? []).filter((id) => id !== cup?.winner) : []),
    ].filter((id): id is string => Boolean(id));
    if (confed === "CONMEBOL") {
      // O campeão e o vice da Copa do Brasil precisam disputar a Série A seguinte.
      for (const [index, id] of cupWinners.entries())
        if (eligible(id))
          add(
            id,
            primary,
            name,
            index === 0 || !cupWinners[0] || !eligible(cupWinners[0]) ? "principal" : "preliminar",
            `${index === 0 ? "Campeão" : "Vice"} da ${rules.domesticCup}`,
          );
      for (const id of [champion(primary), champion(secondaryCompetitionId(confed))])
        if (id && countryOfClub(id) === league.country && eligible(id))
          add(id, primary, name, "principal", "Campeão continental da temporada anterior");
    }
    if (confed === "UEFA")
      for (const id of [champion(primary), champion(secondaryCompetitionId(confed))])
        if (id && countryOfClub(id) === league.country)
          add(id, primary, name, "principal", "Campeão continental da temporada anterior");
    // Reservar a vaga da copa não exige que a copa já tenha terminado: a zona da liga continua legível.
    const titleHolders = [
      ...new Set(
        [champion(primary), champion(secondaryCompetitionId(confed))].filter(
          (id): id is string => Boolean(id) && countryOfClub(id!) === league.country,
        ),
      ),
    ];
    const extraChampions =
      confed === "CONMEBOL"
        ? titleHolders.filter(eligible).length
        : confed === "UEFA"
          ? titleHolders.filter(
              (id) => !ranks.slice(0, rules.primary).some((club) => sameClub(club, id)),
            ).length
          : 0;
    const cupAvailable = rules.cupBerths && confed === "CONMEBOL";
    const primaryLeagueQuota = Math.max(0, rules.primary - (cupAvailable ? rules.cupBerths : 0));
    const desired =
      cupAvailable && cup?.winner
        ? rules.primary + extraChampions
        : primaryLeagueQuota + extraChampions;
    const directQuota =
      rules.primaryDirect - (cupAvailable && !cup?.winner ? 1 : 0) + extraChampions;
    for (const id of ranks) {
      if (
        entries.filter(
          (e) => e.competitionId === primary && countryOfClub(e.clubId) === league.country,
        ).length >= desired
      )
        break;
      if (eligible(id))
        add(
          id,
          primary,
          name,
          entries.filter(
            (e) =>
              e.competitionId === primary &&
              countryOfClub(e.clubId) === league.country &&
              e.phase === "principal",
          ).length < directQuota
            ? "principal"
            : "preliminar",
          `${ranks.indexOf(id) + 1}º na ${league.name}`,
        );
    }
    const secondary = secondaryCompetitionId(confed),
      secondaryName = SECONDARY_NAMES[confed];
    const primaryIds = entries.filter((e) => e.competitionId === primary).map((e) => e.clubId);
    const free = (id: string) => eligible(id) && !primaryIds.some((other) => sameClub(id, other));
    if (secondaryName && rules.secondary) {
      if (
        confed !== "CONMEBOL" &&
        cup?.winner &&
        (confed === "UEFA" ? !primaryIds.some((id) => sameClub(id, cup.winner!)) : free(cup.winner))
      )
        add(cup.winner, secondary, secondaryName, "principal", `Campeão da ${rules.domesticCup}`);
      for (const id of ranks) {
        if (
          entries.filter(
            (e) => e.competitionId === secondary && countryOfClub(e.clubId) === league.country,
          ).length >= rules.secondary
        )
          break;
        if (free(id))
          add(
            id,
            secondary,
            secondaryName,
            "principal",
            `${ranks.indexOf(id) + 1}º na ${league.name}`,
          );
      }
    }
    if (confed === "UEFA" && rules.primary) {
      const id = ranks.find(
        (id) =>
          free(id) && !entries.some((e) => e.competitionId === secondary && sameClub(id, e.clubId)),
      );
      add(
        id,
        "conference:UEFA",
        "Conference League",
        "preliminar",
        "Próximo colocado elegível na liga",
      );
    }
    if (confed === "CONCACAF") {
      if (rules.cupBerths && cup?.winner)
        add(cup.winner, primary, name, "preliminar", `Campeão da ${rules.domesticCup}`);
      if (rules.primary === 0)
        for (const id of ranks.slice(0, league.country === "Costa Rica" ? 4 : 3))
          add(
            id,
            "regional_path:CONCACAF",
            league.country === "Jamaica" ? "Copa do Caribe" : "Copa Centro-Americana",
            "principal",
            "Classificação nacional para torneio regional",
          );
    }
    if (rules.domesticCup)
      for (const id of nextTop)
        add(
          id,
          nationalCompetitionId(league.country),
          rules.domesticCup,
          "principal",
          "Participante da primeira divisão nacional",
        );
  }
  // Classificação regional CONCACAF: resultados do torneio, sem vagas diretas fictícias pela liga local.
  const regionalPath = cups.find((c) => c.competitionId === "regional_path:CONCACAF");
  if (regionalPath?.winner) {
    const ordered = [
      regionalPath.winner,
      ...(regionalPath.finalists ?? []),
      ...[...regionalPath.ties].sort((a, b) => b.round - a.round).flatMap((t) => [t.home, t.away]),
    ].filter((id, i, all) => all.indexOf(id) === i);
    let central = 0,
      caribbean = 0;
    for (const id of ordered) {
      const isCaribbean = countryOfClub(id) === "Jamaica";
      if (isCaribbean ? caribbean >= 3 : central >= 6) continue;
      add(
        id,
        primaryCompetitionId("CONCACAF"),
        CONTINENTAL_NAMES.CONCACAF,
        "preliminar",
        "Classificado no torneio regional CONCACAF",
      );
      if (isCaribbean) caribbean++;
      else central++;
    }
  }
  for (const [leagueId, link] of Object.entries(REGIONAL_LINKS)) {
    const ranks = tables[leagueId]?.map((r) => r.clubId) ?? [];
    const stateCup = cups.find((c) => c.competitionId === `regional:${leagueId}`);
    const ordered = [
      ...(stateCup?.winner ? [stateCup.winner] : []),
      ...(stateCup?.finalists ?? []).filter((id) => id !== stateCup?.winner),
      ...ranks,
    ].filter((id, i, all) => all.indexOf(id) === i);
    const higher = ["bra", "bra2", "bra3"].flatMap(
      (id) => composition?.[id] ?? getLeague(id).clubs.map((c) => c.id),
    );
    const eligible = ordered.filter((id) => !higher.some((other) => sameClub(id, other)));
    for (const id of eligible.slice(0, link.slots))
      add(
        id,
        `league:${link.national}`,
        "Brasileirão Série D",
        "principal",
        `Classificação no ${getLeague(leagueId).name}`,
      );
    for (const id of ordered.slice(0, link.cupSlots))
      add(
        id,
        nationalCompetitionId("Brasil"),
        "Copa do Brasil",
        "principal",
        `Finalista do ${getLeague(leagueId).name}`,
      );
  }
  return entries;
}

/** Mata-mata dos estaduais após a liga. O Capixaba classifica oito e decide em ida/volta. */
export function regionalFinals(
  state: CareerState,
  tables: Record<string, TableRow[]>,
): { cups: CupState[]; playoffs: NonNullable<CompetitionSeasonRecord["playoffs"]> } {
  const cups: CupState[] = [],
    playoffs: NonNullable<CompetitionSeasonRecord["playoffs"]> = [];
  for (const id of Object.keys(REGIONAL_LINKS)) {
    const rows = tables[id];
    if (!rows?.length) continue;
    let contenders = rows.slice(0, id === "x5686" ? 8 : 4).map((r) => r.clubId);
    let finalists: string[] = [];
    while (contenders.length > 1) {
      if (contenders.length === 2) finalists = [...contenders];
      const next: string[] = [];
      for (let i = 0; i < Math.floor(contenders.length / 2); i++) {
        const a = contenders[i]!,
          b = contenders[contenders.length - 1 - i]!;
        const result = competitionPlayoff(
          a,
          b,
          `state-${state.season}-${id}-${contenders.length}-${a}`,
        );
        if (id === "x5686" && contenders.length === 8 && result.penalties) {
          result.winner = a;
          result.penalties = false;
        }
        playoffs.push(result);
        next.push(result.winner);
      }
      if (contenders.length % 2) next.push(contenders[Math.floor(contenders.length / 2)]!);
      contenders = next;
    }
    cups.push({
      id: "regional",
      competitionId: `regional:${id}`,
      name: getLeague(id).name,
      stage: 3,
      ties: [],
      out: contenders[0] !== state.clubId,
      winner: contenders[0]!,
      finalists,
      everyRounds: 1,
    });
  }
  return { cups, playoffs };
}

/** Preenche a Série D a partir dos estaduais sem remover o clube do estadual paralelo. */
export function applyRegionalEntries(
  state: CareerState,
  composition: Record<string, string[]>,
  entries: CompetitionQualification[],
  tables: Record<string, TableRow[]>,
): { leagueId: string; leagueClubs: Record<string, string[]>; admitted: string[] } {
  const leagueClubs = Object.fromEntries(
    Object.entries(composition).map(([id, clubs]) => [id, [...clubs]]),
  );
  const nationals = ["bra", "bra2", "bra3", ...SERIE_D_IDS];
  const active = () => nationals.flatMap((id) => leagueClubs[id] ?? leagueClubIds(state, id));
  const admitted: string[] = [];
  let leagueId = state.leagueId;
  for (const entry of entries.filter((e) => e.competitionId.startsWith("league:y5079"))) {
    const target = entry.competitionId.slice("league:".length);
    const existing = active().find((id) => sameClub(id, entry.clubId));
    if (existing) {
      if (entry.clubId === state.clubId && REGIONAL_LINKS[state.leagueId])
        leagueId =
          nationals.find((id) =>
            (leagueClubs[id] ?? leagueClubIds(state, id)).includes(existing),
          ) ?? leagueId;
      // Usar o ID do save do treinador evita trocar a identidade dele por um alias do catálogo.
      if (existing !== entry.clubId && entry.clubId === state.clubId)
        for (const id of nationals)
          if (leagueClubs[id]?.includes(existing))
            leagueClubs[id] = leagueClubs[id]!.map((club) =>
              club === existing ? entry.clubId : club,
            );
      continue;
    }
    const clubs = leagueClubs[target] ?? leagueClubIds(state, target);
    const capacity = getLeague(target).clubs.length;
    if (clubs.length >= capacity) {
      const order = tables[target]?.map((r) => r.clubId) ?? clubs;
      const remove = [...order]
        .reverse()
        .find(
          (id) =>
            clubs.includes(id) &&
            !admitted.includes(id) &&
            (id !== state.clubId || Boolean(state.regionalLeagueId)),
        );
      if (!remove) continue;
      leagueClubs[target] = clubs.filter((id) => id !== remove);
    } else leagueClubs[target] = [...clubs];
    leagueClubs[target]!.push(entry.clubId);
    admitted.push(entry.clubId);
    if (entry.clubId === state.clubId) leagueId = target;
  }
  if (
    !REGIONAL_LINKS[state.leagueId] &&
    nationals.slice(3).includes(state.leagueId) &&
    !active().includes(state.clubId) &&
    state.regionalLeagueId
  )
    leagueId = state.regionalLeagueId;
  // A expansão regulamentada da Série C abre lugares na D: recompor só com clubes elegíveis dos estaduais.
  const reserve = Object.keys(REGIONAL_LINKS).flatMap(
    (id) => tables[id]?.map((r) => r.clubId) ?? [],
  );
  for (const id of nationals.slice(3)) {
    const clubs = leagueClubs[id] ?? leagueClubIds(state, id);
    while (clubs.length < getLeague(id).clubs.length) {
      const candidate = reserve.find(
        (club) => !active().some((other) => sameClub(club, other)) && !clubs.includes(club),
      );
      if (!candidate) break;
      clubs.push(candidate);
      admitted.push(candidate);
    }
    leagueClubs[id] = clubs;
  }
  return { leagueId, leagueClubs, admitted };
}

export function seasonCompetitionRecord(
  state: CareerState,
  tables: Record<string, TableRow[]>,
  cups: CupState[],
  move: PyramidMove | null,
  regionalPlayoffs: NonNullable<CompetitionSeasonRecord["playoffs"]>,
): CompetitionSeasonRecord {
  const continentalPoints: Record<string, number> = {};
  for (const cup of cups.filter((c) => c.id === "continental")) {
    for (const g of cup.groups ?? [])
      for (const m of g.matches) {
        if (m.hg === null || m.ag === null) continue;
        continentalPoints[m.home] =
          (continentalPoints[m.home] ?? 0) + (m.hg > m.ag ? 3 : m.hg === m.ag ? 1 : 0);
        continentalPoints[m.away] =
          (continentalPoints[m.away] ?? 0) + (m.ag > m.hg ? 3 : m.hg === m.ag ? 1 : 0);
      }
    for (const t of cup.ties)
      if (t.hg !== null && t.ag !== null) {
        const winner = t.hg > t.ag ? t.home : t.away;
        continentalPoints[winner] = (continentalPoints[winner] ?? 0) + 3;
      }
    if (cup.winner) continentalPoints[cup.winner] = (continentalPoints[cup.winner] ?? 0) + 5;
  }
  return {
    season: state.season,
    year: calendarYear(state),
    champions: {
      ...Object.fromEntries(
        Object.entries(tables)
          .filter(([, rows]) => rows.length)
          .map(([id, rows]) => [`league:${id}`, rows[0]!.clubId]),
      ),
      ...Object.fromEntries(
        cups.filter((c) => c.winner).map((c) => [c.competitionId ?? c.id, c.winner!]),
      ),
    },
    continentalPoints,
    tables: Object.fromEntries(
      Object.entries(tables).filter(
        ([id]) => getLeague(id).country === getLeague(state.leagueId).country,
      ),
    ),
    playoffs: [...(move?.playoffs ?? []), ...regionalPlayoffs],
  };
}
