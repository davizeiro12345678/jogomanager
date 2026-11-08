import { CLUBS, getLeague } from "./data/leagues";
import { countryRegulation } from "./competition-regulations";
import { applyFinanceEvent } from "./career-finances";
import { createCups, cupPrize, inGroupStage, nextPhaseName, playCupStage, stageName } from "./cup";
import type { CareerState, CupState, NewsItem } from "./types";

function legacyCupEventBelongsToCurrentClub(state: CareerState, season: number): boolean {
  const history = state.managerHistory;
  if (!Array.isArray(history) || history.length === 0) return true;
  const currentClubHeldTheSeason = history.some(
    (spell) =>
      spell.clubId === state.clubId &&
      spell.from <= season &&
      (spell.to === null || spell.to >= season),
  );
  const anotherClubHeldTheSeason = history.some(
    (spell) =>
      spell.clubId !== state.clubId &&
      spell.from <= season &&
      (spell.to === null || spell.to >= season),
  );
  return currentClubHeldTheSeason && !anotherClubHeldTheSeason;
}

function hasFinanceEvent(state: CareerState, id: string): boolean {
  return (
    state.financeAppliedEventIds?.includes(id) === true ||
    state.financeLedger?.some((entry) => entry.id === id) === true
  );
}

function applyCupFinanceEvent(
  state: CareerState,
  event: Parameters<typeof applyFinanceEvent>[1],
  legacyId: string,
): CareerState {
  if (legacyCupEventBelongsToCurrentClub(state, event.season) && hasFinanceEvent(state, legacyId))
    return state;
  return applyFinanceEvent(state, event);
}

/** Roda as fases de copa que caem nesta rodada. */
export function processCups(state: CareerState, round: number, finish = false): CareerState {
  const country = getLeague(state.leagueId).country;
  const confed = countryRegulation(country).confederation;
  const cups: CupState[] = (state.cups?.length ? state.cups : createCups(state)).map((c) =>
    c.competitionId
      ? c
      : {
          ...c,
          entered: true,
          competitionId:
            c.id === "national"
              ? `national:${country}`
              : c.id === "continental"
                ? `continental:${confed}`
                : `world:${c.id}`,
        },
  );
  const news: NewsItem[] = [];
  const existingNewsIds = new Set(state.news.map((item) => item.id));
  const pushNews = (item: NewsItem) => {
    if (existingNewsIds.has(item.id) || news.some((entry) => entry.id === item.id)) return;
    news.push(item);
  };
  const trophies = [...state.trophies];
  let financialState = state;

  const updated = cups.map((cup) => {
    if (cup.winner || (!finish && round % cup.everyRounds !== 0)) return cup;
    const wasGroupStage = inGroupStage(cup);
    const res = playCupStage(cup, state);
    if (res.userPlayed) {
      const opp = res.opponentId ? CLUBS[res.opponentId]?.name : "adversário";
      const newsId = `cup-${cup.id}-${state.season}-${wasGroupStage ? `g${cup.groupRound ?? 0}` : cup.stage}`;
      if (wasGroupStage) {
        // Na fase de grupos um tropeço não elimina: só a classificação final decide.
        pushNews({
          id: newsId,
          season: state.season,
          round,
          kind: "resultado",
          title: `${cup.name}: ${res.userScore} contra ${opp}`,
          body: res.cup.out
            ? `Fim de caminhada ainda na fase de grupos.`
            : `${nextPhaseName(res.cup)} pela frente.`,
        });
      } else if (res.userWon) {
        const prize = cupPrize(cup.id, cup.stage);
        const competitionId = cup.competitionId ?? cup.id;
        const id = `cup-prize-${competitionId}-${state.clubId}-${state.season}-${cup.stage}`;
        financialState = applyCupFinanceEvent(
          financialState,
          {
            id,
            season: state.season,
            round,
            kind: "premio",
            label: `Premiação · ${cup.name} · ${stageName(cup.stage)}`,
            income: prize,
            expense: 0,
          },
          `cup-prize-${competitionId}-${state.season}-${cup.stage}`,
        );
        pushNews({
          id: newsId,
          season: state.season,
          round,
          kind: "premio",
          title: `${cup.name}: classificado! (${res.userScore} contra ${opp})`,
          body: `Avanço garantido — ${stageName(res.cup.stage)} pela frente. Premiação de €${prize}M.`,
        });
      } else {
        pushNews({
          id: newsId,
          season: state.season,
          round,
          kind: "resultado",
          title: `${cup.name}: eliminado (${res.userScore} contra ${opp})`,
          body: `Fim de caminhada na ${stageName(cup.stage)}.`,
        });
      }
    }
    if (res.champion === state.clubId) {
      if (
        !trophies.some((trophy) => trophy.season === state.season && trophy.name === res.cup.name)
      )
        trophies.push({ season: state.season, name: res.cup.name });
      const prize = cupPrize(cup.id, 4);
      const competitionId = cup.competitionId ?? cup.id;
      const id = `cup-champion-prize-${competitionId}-${state.clubId}-${state.season}`;
      financialState = applyCupFinanceEvent(
        financialState,
        {
          id,
          season: state.season,
          round,
          kind: "premio",
          label: `Premiação · campeão da ${res.cup.name}`,
          income: prize,
          expense: 0,
        },
        `cup-champion-prize-${competitionId}-${state.season}`,
      );
      pushNews({
        id: `cup-win-${cup.id}-${state.season}`,
        season: state.season,
        round,
        kind: "premio",
        title: `🏆 Campeão da ${res.cup.name}!`,
        body: `Título conquistado na temporada ${state.season}. Premiação de €${prize}M.`,
      });
    }
    return res.cup;
  });

  return {
    ...financialState,
    cups: updated,
    trophies,
    news: [...news, ...state.news].slice(0, 60),
  };
}

/* ------------------------------------------------- diretoria & mercado */
