import { pickLineup } from "./career-lineup";
import { careerMatchContext, quickSimulate } from "./career-quick-sim";
export { pickLineup } from "./career-lineup";
export {
  careerMatchContext,
  quickSimulate,
  recentForm,
  squadFatigue,
  type QuickSimContext,
  type QuickSimEvent,
} from "./career-quick-sim";
import { CLUBS, getLeague } from "./data/leagues";
import { valueFor, wageFor } from "./economy";
import { checkSacking, defaultStaff, pressureDelta, runWeeklyEvents } from "./events";
import { customPlayersFor, toGamePlayer } from "@/lib/customData";
import { realSquadFor } from "@/lib/realSquads";
import { applyImportedSquad } from "./squad-import";
import { makeRng } from "./rng";
import { recordWorldTransition, withCareerWorld } from "./career-world";
import { withDevelopmentBase } from "./attributes";
import { effectivePlayer, withDevelopmentSeasonStart } from "./player-development";
import { settleWeeklyFinance } from "./finance-forecast";

import { computeTable, generateFixtures } from "./season";
import { evaluateAchievements } from "./achievements";
import { buildSquad } from "./squad";
import type {
  CareerState,
  Fixture,
  FormationKey,
  JobOffer,
  ManagerProfile,
  NewsItem,
  Player,
  Position,
  ScoutReport,
  Tactics,
  TransferOffer,
} from "./types";
export { migrateCareer } from "./career-migration";
import { applyWeeklyDevelopment } from "./career-development";
import { endSeason } from "./career-season-end";
import { processCups } from "./career-cups";
export { acceptOffer, rejectOffer, takeJob, resign } from "./career-jobs";
export { upgradeStaff, runScouting } from "./career-staff";

const PERSONALITIES = [
  "líder",
  "profissional",
  "ambicioso",
  "temperamental",
  "caseiro",
  "determinado",
] as const;

/**
 * Elenco pronto para jogo: montado a partir do catálogo e já enriquecido com
 * salário, valor de mercado, potencial e personalidade. Sem esta etapa as telas
 * de partida rápida mostravam `€0` de valor e salário, porque `buildSquad`
 * entrega os campos zerados.
 */
export function buildReadySquad(clubId: string): Player[] {
  return buildSquad(clubId).map(enrichPlayer);
}

export function enrichPlayer(p: Player): Player {
  const rnd = makeRng(`pl-${p.id}`);
  return {
    ...p,
    wage: p.wage > 0 ? p.wage : wageFor(p.ovr),
    value: p.value > 0 ? p.value : valueFor(p.ovr, p.age),
    yellows: p.yellows ?? 0,
    suspended: p.suspended ?? false,
    injuryWeeks: p.injuryWeeks ?? 0,
    potential:
      p.potential ??
      Math.min(
        99,
        p.ovr +
          (p.age <= 20
            ? 6 + Math.floor(rnd() * 8)
            : p.age <= 24
              ? 3 + Math.floor(rnd() * 6)
              : Math.floor(rnd() * 3)),
      ),
    personality: p.personality ?? PERSONALITIES[Math.floor(rnd() * PERSONALITIES.length)]!,
    form: p.form ?? Math.round((p.morale + p.condition) / 2),
    contractYears: p.contractYears ?? 1 + Math.floor(rnd() * 4),
    releaseClause:
      p.releaseClause ?? Math.round(valueFor(p.ovr, p.age) * (1.8 + rnd() * 1.4) * 10) / 10,
    unhappy: p.unhappy ?? false,
  };
}

export function defaultV3(club: { strength: number } | undefined) {
  const s = club?.strength ?? 70;
  return {
    fanApproval: 62,
    pressure: 25,
    staff: defaultStaff(),
    sponsor: Math.round(s * 0.02 * 100) / 100,
    ticketPrice: 45,
    capacity: Math.round(12000 + s * 700),
    streak: 0,
    offers: [] as TransferOffer[],
    jobOffers: [] as JobOffer[],
    scoutReports: [] as ScoutReport[],
    sacked: false,
  };
}

/**
 * Junta os jogadores cadastrados pelo usuário ao elenco gerado.
 * Cada cadastro entra no lugar do jogador mais fraco da mesma posição
 * (ou simplesmente do mais fraco), mantendo o tamanho do plantel.
 */
export function withCustomPlayers(clubId: string, squad: Player[]): Player[] {
  const custom = customPlayersFor(clubId);
  if (custom.length === 0) return squad;
  const list = [...squad];
  const usedNumbers = new Set(list.map((p) => p.number));

  custom.forEach((cp) => {
    let num = 2;
    while (usedNumbers.has(num) && num < 40) num++;
    usedNumbers.add(num);
    const player = enrichPlayer(toGamePlayer(cp, num));

    const samePos = list.filter((p) => p.pos === cp.pos).sort((a, b) => a.ovr - b.ovr)[0];
    const weakest = [...list].sort((a, b) => a.ovr - b.ovr)[0];
    const target = samePos ?? weakest;
    const idx = target ? list.findIndex((p) => p.id === target.id) : -1;
    if (idx >= 0) list[idx] = player;
    else list.push(player);
  });

  return list;
}

/**
 * Aplica os nomes reais importados das APIs por cima do elenco gerado.
 * A força de cada jogador continua vindo do balanceamento do jogo; o que muda
 * é quem veste a camisa: nome, idade, número, nacionalidade e foto.
 */
export function withRealPlayers(clubId: string, squad: Player[]): Player[] {
  return applyImportedSquad(clubId, squad, realSquadFor(clubId)).map(enrichPlayer);
}

export function initCareer(
  leagueId: string,
  clubId: string,
  managerName: string,
  profile?: ManagerProfile,
): CareerState {
  const club = CLUBS[clubId]!;
  const squad = withCustomPlayers(
    clubId,
    withRealPlayers(clubId, buildSquad(clubId).map(enrichPlayer)),
  ).map((p) => {
    const frozen = withDevelopmentBase(p, 2);
    return {
      ...frozen,
      value: valueFor(p.ovr, p.age, {
        economyRulesVersion: 2,
        potential: p.potential,
        contractYears: p.contractYears,
      }),
    };
  });
  const formation: FormationKey = "4-3-3";
  const { lineup, bench } = pickLineup(squad, formation);
  const objective = Math.max(1, Math.min(15, Math.round((96 - club.strength) / 4)));
  const base = defaultV3(club);
  const rep = profile?.reputation ?? 3;
  const loved = profile?.favClub === clubId;
  const budget = Math.round(club.strength * 0.9 * (0.7 + rep * 0.12) * 10) / 10;
  const approval = Math.max(20, Math.min(95, (profile?.approval ?? 62) + (loved ? 8 : 0)));

  return withCareerWorld({
    version: 3,
    catalogRevision: 1,
    simulationRatingRevision: 1,
    economyRulesVersion: 2,
    developmentRulesVersion: 2,
    developmentSeasonStart: {
      season: 1,
      ratings: Object.fromEntries(squad.map((p) => [p.id, p.ovr])),
    },
    leagueId,
    clubId,
    managerName,
    season: 1,
    round: 1,
    tactics: { formation, mentality: 2, pressing: 1, width: 1, tempo: 1 },
    training: "equilibrado",
    lineup,
    bench,
    fixtures: generateFixtures(leagueId, `${clubId}-${managerName}`),
    players: Object.fromEntries(squad.map((p) => [p.id, p])),
    results: [],
    finances: {
      budget,
      spent: 0,
      income: 0,
    },
    approval,
    objective,
    news: [
      {
        id: "welcome",
        season: 1,
        round: 1,
        kind: "sistema",
        title: `${managerName} assume o ${club.name}!`,
        body: `A diretoria espera pelo menos a ${objective}ª posição na ${getLeague(leagueId).name}. Boa sorte, treinador!`,
      },
    ],
    trophies: [],
    history: [],
    ...base,
    fanApproval: Math.max(30, Math.min(95, base.fanApproval + (loved ? 12 : 0) + (rep - 3) * 4)),
    pressure: Math.max(5, base.pressure - (rep - 3) * 4 - (loved ? 5 : 0)),
    ...(profile ? { manager: profile } : {}),
    transferredIn: [],
    seenScenes: [],
    managerHistory: [{ clubId, from: 1, to: null, note: "Contratado" }],
  });
}

export function orderedPositions(): Position[] {
  return ["GK", "DF", "MF", "FW"];
}

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

/**
 * Relatório premium (comprado na loja ou do passe): mapeia jovens de até 23
 * anos com o maior potencial entre clubes sorteados e soma aos relatórios
 * existentes, sem repetir jogador.
 */
export function runPremiumScouting(state: CareerState, nonce: string, size = 5): CareerState {
  const rnd = makeRng(`premium-scout-${state.clubId}-${state.season}-${nonce}`);
  const ids = Object.keys(CLUBS).filter((id) => id !== state.clubId);
  const known = new Set(state.scoutReports.map((r) => r.playerId));
  const candidates: ScoutReport[] = [];
  for (let i = 0; i < size * 4 && ids.length > 0; i++) {
    const clubId = ids[Math.floor(rnd() * ids.length)]!;
    for (const p of buildSquad(clubId).map(enrichPlayer)) {
      if (p.age > 23 || known.has(p.id)) continue;
      candidates.push({
        id: `psc-${p.id}-${state.season}-${nonce}`,
        playerId: p.id,
        name: p.name,
        clubId,
        pos: p.pos,
        ovr: p.ovr,
        potential: p.potential ?? p.ovr,
        age: p.age,
        value: p.value,
        season: state.season,
      });
    }
  }
  const picked: ScoutReport[] = [];
  for (const r of candidates.sort((a, b) => b.potential - a.potential)) {
    if (picked.length >= size) break;
    if (picked.some((x) => x.playerId === r.playerId)) continue;
    picked.push(r);
  }
  return { ...state, scoutReports: [...picked, ...state.scoutReports].slice(0, 40) };
}
