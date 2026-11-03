import { CLUBS, getLeague } from "./data/leagues";
import { countryRegulation } from "./competition-regulations";
import { addMoney } from "./financial-inputs";
import { createCups, cupPrize, inGroupStage, nextPhaseName, playCupStage, stageName } from "./cup";
import type { CareerState, CupState, NewsItem } from "./types";

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
  const trophies = [...state.trophies];
  let budget = state.finances.budget;
  let income = state.finances.income;

  const updated = cups.map((cup) => {
    if (cup.winner || (!finish && round % cup.everyRounds !== 0)) return cup;
    const wasGroupStage = inGroupStage(cup);
    const res = playCupStage(cup, state);
    if (res.userPlayed) {
      const opp = res.opponentId ? CLUBS[res.opponentId]?.name : "adversário";
      const newsId = `cup-${cup.id}-${state.season}-${wasGroupStage ? `g${cup.groupRound ?? 0}` : cup.stage}`;
      if (wasGroupStage) {
        // Na fase de grupos um tropeço não elimina: só a classificação final decide.
        news.push({
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
        budget = addMoney(budget, prize);
        income = addMoney(income, prize);
        news.push({
          id: newsId,
          season: state.season,
          round,
          kind: "premio",
          title: `${cup.name}: classificado! (${res.userScore} contra ${opp})`,
          body: `Avanço garantido — ${stageName(res.cup.stage)} pela frente. Premiação de €${prize}M.`,
        });
      } else {
        news.push({
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
      trophies.push({ season: state.season, name: res.cup.name });
      const prize = cupPrize(cup.id, 4);
      budget = addMoney(budget, prize);
      income = addMoney(income, prize);
      news.push({
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
    ...state,
    cups: updated,
    trophies,
    finances: { ...state.finances, budget, income },
    news: [...news, ...state.news].slice(0, 60),
  };
}

/* ------------------------------------------------- diretoria & mercado */
