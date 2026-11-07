import { evaluateAchievements } from "./achievements";
import { processCups } from "./career-cups";
import { applyWeeklyDevelopment } from "./career-development";
import { careerMatchContext, quickSimulate } from "./career-quick-sim";
import { endSeason } from "./career-season-end";
import { recordWorldTransition } from "./career-world";
import { CLUBS } from "./data/leagues";
import { checkSacking, pressureDelta, runWeeklyEvents } from "./events";
import { settleWeeklyFinance } from "./finance-forecast";
import { withDevelopmentSeasonStart } from "./player-development";
import { computeTable } from "./season";
import type { CareerState, NewsItem } from "./types";

function totalRounds(state: CareerState): number {
  return state.fixtures.reduce((m, f) => Math.max(m, f.round), 0);
}

/* ------------------------------------------------------------ mecânicas */

/** Desempenho individual de uma partida (jogadores do clube do usuário). */
export interface MatchPerformance {
  pid: string;
  goals: number;
  assists: number;
  played: boolean;
  /** minutos em campo (padrão 90 quando ausente) */
  minutes?: number;
  /** nota da partida 0-10 */
  rating?: number;
  /** amarelos na partida ao vivo (acumulam para suspensão) */
  yellow?: number;
  /** expulso na partida ao vivo (suspenso na próxima) */
  red?: boolean;
  /** semanas de lesão diagnosticadas no lance */
  injuryWeeks?: number;
}

export function advanceRound(
  state: CareerState,
  userResult: { hg: number; ag: number } | null,
  performances: MatchPerformance[] = [],
  comp = "Liga",
  evaluatedAt: number | string = Date.now(),
) {
  const evaluationTime =
    typeof evaluatedAt === "number" ? evaluatedAt : new Date(evaluatedAt).getTime();
  if (
    !Number.isSafeInteger(evaluationTime) ||
    evaluationTime < 0 ||
    evaluationTime > 8_640_000_000_000_000
  )
    throw new Error("Instante de avaliação da carreira inválido.");
  state = withDevelopmentSeasonStart(state);
  const round = state.round;
  const played = state.fixtures.find(
    (f) => f.round === round && (f.home === state.clubId || f.away === state.clubId),
  );
  if (played && !userResult) throw new Error("O resultado da partida do clube é obrigatório.");
  const matchResult = played ? userResult : null;
  const fixtures = state.fixtures.map((f) => {
    if (f.round !== round || f.homeGoals !== null) return f;
    if (f.home === state.clubId || f.away === state.clubId) {
      return matchResult ? { ...f, homeGoals: matchResult.hg, awayGoals: matchResult.ag } : f;
    }
    const { hg, ag, events } = quickSimulate(
      f.home,
      f.away,
      `${state.clubId}-${state.season}-${round}-${f.home}`,
      careerMatchContext(state, f.home, f.away),
    );
    return { ...f, homeGoals: hg, awayGoals: ag, events };
  });

  const userHome = played ? played.home === state.clubId : true;
  const gf = matchResult ? (userHome ? matchResult.hg : matchResult.ag) : 0;
  const ga = matchResult ? (userHome ? matchResult.ag : matchResult.hg) : 0;
  const won = matchResult !== null && gf > ga;
  const draw = matchResult !== null && gf === ga;

  // estatísticas individuais da partida (jogos, gols, assistências, cartões, lesões)
  let squadAfterMatch = state.players;
  const liveNews: NewsItem[] = [];
  if (performances.length) {
    squadAfterMatch = { ...state.players };
    for (const perf of performances) {
      const p = squadAfterMatch[perf.pid];
      if (!p) continue;
      const q = {
        ...p,
        apps: (p.apps ?? 0) + (perf.played ? 1 : 0),
        goals: (p.goals ?? 0) + perf.goals,
        assists: (p.assists ?? 0) + perf.assists,
        yellows: (p.yellows ?? 0) + (perf.yellow ?? 0),
        suspended: p.suspended,
        injuryWeeks: Math.max(p.injuryWeeks ?? 0, perf.injuryWeeks ?? 0),
      };
      // vermelho direto suspende; 3 amarelos acumulados também
      if (perf.red) {
        q.suspended = true;
        liveNews.push({
          id: `sentoff-${perf.pid}-${round}`,
          season: state.season,
          round,
          kind: "cartao",
          title: `${q.name} expulso`,
          body: `${q.name} foi expulso e desfalca o time na próxima rodada.`,
        });
      } else if (q.yellows >= 3) {
        q.yellows = 0;
        q.suspended = true;
        liveNews.push({
          id: `susp-${perf.pid}-${round}`,
          season: state.season,
          round,
          kind: "cartao",
          title: `${q.name} suspenso`,
          body: `Terceiro cartão amarelo: ${q.name} desfalca o time na próxima rodada.`,
        });
      }
      if ((perf.injuryWeeks ?? 0) > 0 && (p.injuryWeeks ?? 0) === 0) {
        liveNews.push({
          id: `inj-${perf.pid}-${round}`,
          season: state.season,
          round,
          kind: "lesao",
          title: `${q.name} se lesiona`,
          body: `${q.name} será desfalque por aproximadamente ${perf.injuryWeeks} rodada(s).`,
        });
      }
      squadAfterMatch[perf.pid] = q;
    }
  }

  // mecânicas semanais sobre o elenco (quem tem dado ao vivo não entra no sorteio)
  const livePids = new Set(performances.map((p) => p.pid));
  const { players, news, attrDeltas } = applyWeeklyDevelopment(
    squadAfterMatch,
    state,
    matchResult ? won : null,
    `${state.clubId}-${round}-dev`,
    livePids,
    matchResult !== null,
    evaluatedAt,
  );
  news.unshift(...liveNews);

  // Finanças por rodada: a projeção separa receitas, custos e investimentos
  // recorrentes. O lançamento tem uma chave estável para não ser cobrado duas
  // vezes quando uma reconexão reprocessa a mesma rodada.
  const table = computeTable({ ...state, fixtures });
  const position = table.findIndex((r) => r.clubId === state.clubId) + 1;
  const homeGame = played ? played.home === state.clubId : false;
  const finance = settleWeeklyFinance(
    { ...state, players },
    { position: position || 10, won, homeGame, played: Boolean(played) },
  );

  // aprovação da diretoria e da torcida
  const approval = matchResult
    ? Math.max(5, Math.min(100, state.approval + (won ? 2.5 : draw ? 0.5 : -2.5)))
    : state.approval;
  const fanApproval = matchResult
    ? Math.max(
        5,
        Math.min(
          100,
          (state.fanApproval ?? 60) + (won ? 3 : draw ? 0 : -3) - (state.ticketPrice - 45) / 25,
        ),
      )
    : state.fanApproval;
  const pressure = matchResult
    ? Math.max(
        0,
        Math.min(
          100,
          (state.pressure ?? 25) + pressureDelta(won, draw, position || 10, state.objective),
        ),
      )
    : state.pressure;
  const streak = !matchResult
    ? (state.streak ?? 0)
    : won
      ? Math.max(1, (state.streak ?? 0) + 1)
      : draw
        ? 0
        : Math.min(-1, (state.streak ?? 0) - 1);

  const headline: NewsItem | null = matchResult
    ? {
        id: `res-${round}-${state.season}`,
        season: state.season,
        round,
        kind: "resultado",
        title: won
          ? `Vitória por ${gf}x${ga}!`
          : draw
            ? `Empate em ${gf}x${ga}`
            : `Derrota por ${gf}x${ga}`,
        body: played
          ? `${CLUBS[played.home]?.name} ${matchResult.hg} x ${matchResult.ag} ${CLUBS[played.away]?.name} — Rodada ${round}.`
          : "",
      }
    : null;

  // histórico partida a partida
  const logEntry =
    played && matchResult
      ? {
          season: state.season,
          round,
          clubId: state.clubId,
          comp,
          opponentId: played.home === state.clubId ? played.away : played.home,
          home: userHome,
          gf,
          ga,
          players: performances.map((p) => ({
            pid: p.pid,
            goals: p.goals,
            assists: p.assists,
            minutes: p.minutes ?? 90,
            rating: Math.round((p.rating ?? 6 + p.goals * 1.2 + p.assists * 0.7) * 10) / 10,
          })),
        }
      : null;

  let next: CareerState = {
    ...finance.state,
    fixtures,
    players,
    round: round + 1,
    attrDeltas,
    ...(logEntry ? { matchLog: [logEntry, ...(state.matchLog ?? [])].slice(0, 400) } : {}),
    results:
      played && matchResult
        ? [
            ...state.results,
            { round, home: played.home, away: played.away, hg: matchResult.hg, ag: matchResult.ag },
          ]
        : state.results,
    approval: Math.round(approval),
    fanApproval: Math.round(fanApproval),
    pressure: Math.round(pressure),
    streak,
    news: [...(headline ? [headline] : []), ...news, ...state.news].slice(0, 60),
  };

  // eventos dinâmicos: bastidores, propostas por jogadores, sondagens por você
  const ev = runWeeklyEvents(next);
  next = {
    ...next,
    players: ev.players,
    offers: [...(next.offers ?? []).filter((o) => o.expiresRound >= next.round), ...ev.offers],
    jobOffers: [
      ...(next.jobOffers ?? []).filter((j) => j.expiresRound >= next.round),
      ...ev.jobOffers,
    ],
    news: [...ev.news, ...next.news].slice(0, 60),
  };

  // copas: fases intercaladas com o calendário da liga
  next = processCups(next, round);

  if (next.round > totalRounds(next)) {
    next = endSeason(next);
  }

  next = recordWorldTransition(state, next);
  if (matchResult || next.season !== state.season) next = checkSacking(next);

  const newlyUnlocked = evaluateAchievements(next);
  if (newlyUnlocked.length) {
    const now = new Date(evaluationTime).toISOString();
    next = {
      ...next,
      achievements: [...(next.achievements ?? []), ...newlyUnlocked],
      achievementsUnlockedAt: {
        ...(next.achievementsUnlockedAt ?? {}),
        ...Object.fromEntries(newlyUnlocked.map((id) => [id, now])),
      },
    };
  }

  return next;
}
