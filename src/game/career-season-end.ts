import { CLUBS, getLeague } from "./data/leagues";
import { seasonPrize } from "./economy";
import { updatedSeasonComposition } from "./catalog-season";
import { makeRng } from "./rng";
import { applyRegens } from "./regen";
import { checkSeasonIntegrity } from "./season-integrity";
import { applyPyramid, leagueClubIds, REGIONAL_LINKS } from "./pyramid";
import {
  applyRegionalEntries,
  resolveQualifications,
  regionalFinals,
  seasonTables,
  seasonCompetitionRecord,
  topLeague,
} from "./competition-season";
import { calendarYear } from "./competition-regulations";
import { developedPlayer, evolveSeason, evolveSeasonV2, withDevelopmentBase } from "./attributes";
import { applyFinanceEvent } from "./career-finances";
import { computeTable, generateFixtures } from "./season";
import type { CareerState, NewsItem, Player } from "./types";
import { pickLineup } from "./career";
import { processCups } from "./career-cups";

export function endSeason(state: CareerState): CareerState {
  // As copas precisam ter campeão mesmo depois da eliminação do treinador ou em ligas curtas.
  for (let step = 0; step < 16 && (state.cups ?? []).some((c) => !c.winner); step++)
    state = processCups(state, state.round, true);
  const club = CLUBS[state.clubId]!;
  const table = computeTable(state);
  const tables = seasonTables(state, table);
  const regional = regionalFinals(state, tables);
  const closingCups = [...(state.cups ?? []), ...regional.cups];
  const position = table.findIndex((r) => r.clubId === state.clubId) + 1;
  const row = table[position - 1]!;
  const championId =
    regional.cups.find((c) => c.competitionId === `regional:${state.leagueId}`)?.winner ??
    table[0]!.clubId;
  const champion = CLUBS[championId]!;
  const league = getLeague(state.leagueId);

  const prize = seasonPrize(position, club.strength);
  const metObjective = position <= state.objective;
  const approval = Math.max(
    5,
    Math.min(100, state.approval + (metObjective ? 18 : -14) + (position === 1 ? 10 : 0)),
  );

  const news: NewsItem[] = [
    {
      id: `season-end-${state.season}`,
      season: state.season,
      round: state.round,
      kind: "premio",
      title: `Fim da temporada ${state.season}: ${position}º lugar`,
      body: `${champion.name} conquistou a ${league.name}. Premiação de €${prize}M. ${metObjective ? "A diretoria aprova o trabalho!" : "A diretoria esperava mais..."}`,
    },
  ];
  if (championId === state.clubId) {
    news.push({
      id: `champion-${state.season}`,
      season: state.season,
      round: state.round,
      kind: "premio",
      title: `🏆 ${club.name} é CAMPEÃO!`,
      body: `Temporada histórica! O título da ${league.name} veio na temporada ${state.season}.`,
    });
  }

  // envelhecimento e reset de estatísticas
  const rnd = makeRng(`age-${state.clubId}-${state.season}`);
  const aged: Record<string, Player> = {};
  for (const [id, p] of Object.entries(state.players)) {
    aged[id] = {
      ...p,
      age: p.age + 1,
      goals: 0,
      assists: 0,
      apps: 0,
      yellows: 0,
      suspended: false,
      condition: 88 + Math.floor(rnd() * 10),
      morale: Math.max(45, Math.min(90, p.morale)),
    };
  }

  // aposentadorias e garotos da base
  const regen = applyRegens(aged, state.clubId, state.season, state.round);
  const players = Object.fromEntries(
    Object.entries(regen.players).map(([id, p]) => [
      id,
      withDevelopmentBase(p, state.developmentRulesVersion === 2 ? 2 : 1),
    ]),
  );
  news.push(...regen.news);

  const squad = Object.values(players);

  // Evolução dos 46 atributos: fica guardada na carreira e vale para sempre.
  const attrDeltas =
    state.developmentRulesVersion === 2
      ? evolveSeasonV2(squad, state)
      : evolveSeason(squad, state.season, state.attrDeltas ?? {});
  for (const p of squad) players[p.id] = developedPlayer(p, { ...state, attrDeltas });
  const { lineup, bench } = pickLineup(Object.values(players), state.tactics.formation, {
    ...state,
    attrDeltas,
  });

  // acesso e rebaixamento entre as divisões do país
  const pyramidLeague = REGIONAL_LINKS[state.leagueId]
    ? topLeague(getLeague(state.leagueId).country)!.id
    : state.leagueId;
  const movement = applyPyramid(
    { ...state, leagueId: pyramidLeague },
    tables[pyramidLeague] ?? table,
    state.pyramidSlots,
    tables,
  );
  const move =
    movement && pyramidLeague !== state.leagueId && !movement.moved
      ? { ...movement, leagueId: state.leagueId }
      : movement;
  const nationalComposition = { ...(state.leagueClubs ?? {}), ...move?.leagueClubs };
  const qualifications = resolveQualifications(state, tables, closingCups, nationalComposition);
  const admission =
    getLeague(state.leagueId).country === "Brasil"
      ? applyRegionalEntries(
          { ...state, leagueId: move?.leagueId ?? state.leagueId },
          nationalComposition,
          qualifications,
          tables,
        )
      : null;
  const competitionRecord = seasonCompetitionRecord(
    state,
    tables,
    closingCups,
    move,
    regional.playoffs,
  );

  // Checagem de integridade da temporada que terminou. Não bloqueia a carreira:
  // registra no noticiário para que qualquer inconsistência fique visível.
  const issues = checkSeasonIntegrity({
    clubIds: leagueClubIds(state),
    fixtures: state.fixtures,
    table,
    ...(state.leagueId === "x5686" &&
    state.fixtures.length === (table.length * (table.length - 1)) / 2
      ? { expectedGamesPerClub: table.length - 1 }
      : {}),
  });
  if (issues.length) {
    console.warn("[season-integrity]", state.season, issues);
    news.push({
      id: `integrity-${state.season}`,
      season: state.season,
      round: state.round,
      kind: "sistema",
      title: "Relatório de integridade da temporada",
      body: `Foram encontradas ${issues.length} inconsistência(s) e a temporada foi fechada com a tabela oficial. Ex.: ${issues[0]}`,
    });
  }
  const nextLeagueId = admission?.leagueId ?? move?.leagueId ?? state.leagueId;
  const nextLeagueClubs = updatedSeasonComposition(
    state,
    admission?.leagueClubs ?? (move ? nationalComposition : state.leagueClubs),
    nextLeagueId,
    [...(move?.promoted ?? []), ...(move?.relegated ?? [])],
  );
  for (const entry of qualifications.filter((e) => e.clubId === state.clubId))
    news.push({
      id: `qualification-${state.season}-${entry.competitionId}`,
      season: state.season,
      round: state.round,
      kind: "sistema",
      title: `Vaga conquistada: ${entry.name}`,
      body: `${entry.reason}. Inscrição na próxima temporada (${entry.phase === "preliminar" ? "fase preliminar" : "fase principal"}).`,
    });
  if (move) {
    for (const change of move.movements) {
      const upper = getLeague(change.to).name;
      const lower = getLeague(change.from).name;
      news.push({
        id: `pyramid-${state.season}-${change.from}-${change.to}`,
        season: state.season,
        round: state.round,
        kind: "sistema",
        title: `Subiram / Caíram · ${upper} ↔ ${lower}`,
        body: `Subiram: ${change.promoted.map((id) => CLUBS[id]?.name ?? id).join(", ")}. Caíram: ${change.relegated.map((id) => CLUBS[id]?.name ?? id).join(", ")}.`,
      });
    }
  }
  if (move?.moved) {
    const up = move.moved === "subiu";
    news.push({
      id: `${move.moved}-${state.season}`,
      season: state.season,
      round: state.round,
      kind: "premio",
      title: up ? `⬆️ ${club.name} conquista o acesso!` : `⬇️ ${club.name} é rebaixado`,
      body: up
        ? `Com o ${position}º lugar, o clube sobe para a ${getLeague(move.leagueId).name} na próxima temporada.`
        : `O ${position}º lugar levou o clube para a ${getLeague(move.leagueId).name} na próxima temporada.`,
    });
  }

  const financialState = applyFinanceEvent(state, {
    id: `season-prize-${state.clubId}-${state.season}`,
    season: state.season,
    round: state.round,
    kind: "premio",
    label: `Premiação de fechamento · ${league.name}`,
    income: prize,
    expense: 0,
  });

  return {
    ...financialState,
    season: state.season + 1,
    calendarYear: calendarYear(state) + 1,
    competitionHistory: [...(state.competitionHistory ?? []), competitionRecord].slice(-4),
    qualifications,
    ...(regional.cups.some((c) => c.competitionId === `regional:${state.leagueId}`)
      ? { regionalLeagueId: state.leagueId }
      : {}),
    round: 1,
    records: {
      ...(state.records ?? {}),
      promotions: (state.records?.promotions ?? 0) + (move?.moved === "subiu" ? 1 : 0),
      relegations: (state.records?.relegations ?? 0) + (move?.moved === "desceu" ? 1 : 0),
    },
    leagueId: nextLeagueId,
    catalogCalendarPending: false,
    ...(nextLeagueClubs ? { leagueClubs: nextLeagueClubs } : {}),
    fixtures: generateFixtures(
      nextLeagueId,
      `${state.clubId}-${state.managerName}-s${state.season + 1}`,
      nextLeagueClubs?.[nextLeagueId],
    ),
    players,
    attrDeltas,
    ...(state.developmentRulesVersion === 2
      ? {
          developmentSeasonStart: {
            season: state.season + 1,
            ratings: Object.fromEntries(Object.values(players).map((p) => [p.id, p.ovr])),
          },
        }
      : {}),
    lineup,
    bench,
    results: [],
    cups: [],
    finances: {
      budget: financialState.finances.budget,
      spent: 0,
      income: 0,
    },
    approval,
    trophies:
      championId === state.clubId
        ? [...state.trophies, { season: state.season, name: league.name }]
        : state.trophies,
    history: [
      ...state.history,
      {
        season: state.season,
        position,
        pts: row.pts,
        w: row.w,
        d: row.d,
        l: row.l,
        championId,
      },
    ],
    news: [...news.reverse(), ...state.news].slice(0, 60),
  };
}
