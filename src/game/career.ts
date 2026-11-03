import { CLUBS, getLeague } from "./data/leagues";
import { valueFor, wageFor } from "./economy";
import { checkSacking, defaultStaff, pressureDelta, runWeeklyEvents } from "./events";
import { customPlayersFor, toGamePlayer } from "@/lib/customData";
import { realSquadFor } from "@/lib/realSquads";
import { applyImportedSquad } from "./squad-import";
import { FORMATIONS } from "./formations";
import { makeRng } from "./rng";
import { expectedGoals, regulationScore, type MatchConditions } from "./match-probability";
import { selectionRating } from "./match-readiness";
import { recordWorldTransition, withCareerWorld } from "./career-world";
import { withDevelopmentBase } from "./attributes";
import {
  effectivePlayer,
  withDevelopmentSeasonStart,
  type AttributeSource,
} from "./player-development";
import { settleWeeklyFinance } from "./finance-forecast";

import { computeTable, generateFixtures } from "./season";
import { evaluateAchievements } from "./achievements";
import { buildSquad } from "./squad";
import type {
  CareerState,
  Fixture,
  FixtureEvent,
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

/**
 * Ordem de improvisação por posição: um volante rende mais na zaga do que um
 * centroavante, e um ponta rende mais no meio do que um zagueiro no ataque.
 */
const COVER_ORDER: Record<Position, Position[]> = {
  GK: ["GK"],
  DF: ["DF", "MF", "FW"],
  MF: ["MF", "DF", "FW"],
  FW: ["FW", "MF", "DF"],
};

export function pickLineup(players: Player[], formation: FormationKey, source?: AttributeSource) {
  // Formação desconhecida (save antigo, tática corrompida): cai no 4-3-3 em vez
  // de estourar e derrubar a tela inteira.
  const slots = FORMATIONS[formation] ?? FORMATIONS["4-3-3"];
  const available = [...players]
    .filter((p) => !p.suspended && p.injuryWeeks === 0)
    .sort(
      (a, b) => selectionRating(b, source) - selectionRating(a, source) || a.id.localeCompare(b.id),
    );
  const taken = new Set<string>();
  const picks: Player[] = new Array(slots.length).fill(undefined);

  // 1) Goleiro primeiro. A simulação procura `pos === "GK"` para defender o
  // chute: sem goleiro, todo chute é gol. Por isso a posição é preenchida
  // antes de qualquer outra e nunca por um jogador de linha enquanto houver
  // um goleiro disponível.
  const keepers = available.filter((p) => p.pos === "GK");
  let keeperCursor = 0;
  slots.forEach((slot, i) => {
    if (slot.pos !== "GK") return;
    const keeper = keepers[keeperCursor++];
    if (!keeper) return;
    taken.add(keeper.id);
    picks[i] = keeper;
  });

  // 2) Linha: posição exata, depois a ordem de improvisação mais parecida.
  // Goleiro nunca é gasto em vaga de linha.
  const cover = (pos: Position): Player | undefined => {
    for (const candidatePos of COVER_ORDER[pos] ?? ["DF", "MF", "FW"]) {
      const found = available.find((p) => !taken.has(p.id) && p.pos === candidatePos);
      if (found) return found;
    }
    return undefined;
  };
  slots.forEach((slot, i) => {
    if (slot.pos === "GK" || picks[i]) return;
    const found =
      cover(slot.pos) ??
      available.find((p) => !taken.has(p.id) && p.pos !== "GK") ??
      available.find((p) => !taken.has(p.id));
    if (!found) return;
    taken.add(found.id);
    picks[i] = found;
  });

  // 4) Elenco curto ou goleiros indisponíveis: completa as vagas que sobraram
  // com qualquer jogador livre, jogador de linha primeiro. É melhor um time com
  // 11 atletas (mesmo com um improviso no gol) do que um time com 10.
  slots.forEach((slot, i) => {
    if (picks[i]) return;
    const found =
      available.find((p) => !taken.has(p.id) && p.pos !== "GK") ??
      available.find((p) => !taken.has(p.id));
    if (!found) return;
    taken.add(found.id);
    picks[i] = found;
    void slot;
  });

  const lineup = picks.filter(Boolean).map((p) => p.id);

  // 3) Banco: melhores restantes, mas sempre com um goleiro. Sem reserva, uma
  // lesão na camisa 1 deixa o time sem ninguém na posição até o fim do jogo.
  const rest = available.filter((p) => !taken.has(p.id));
  const benchIds = rest.slice(0, 7).map((p) => p.id);
  if (!benchIds.some((id) => rest.find((p) => p.id === id)?.pos === "GK")) {
    const spareKeeper = rest.find((p) => p.pos === "GK");
    if (spareKeeper) {
      const weakestOutfield = [...benchIds].reverse().find((id) => {
        const p = rest.find((q) => q.id === id);
        return Boolean(p) && p!.pos !== "GK";
      });
      if (weakestOutfield) {
        benchIds.splice(benchIds.indexOf(weakestOutfield), 1);
        benchIds.unshift(spareKeeper.id);
      }
    }
  }
  return { lineup, bench: benchIds };
}

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

/** Contexto opcional do jogo: forma/moral (0–100) e cansaço dos dois lados. */
export type QuickSimContext = MatchConditions;

export type QuickSimEvent = FixtureEvent;

/**
 * Simulação rápida (sem 3D) para as outras partidas da rodada.
 * A diferença de força é comprimida (tanh) para evitar goleadas demais, e uma
 * correção de Dixon-Coles aproxima a frequência real de empates.
 */
export function quickSimulate(
  homeId: string,
  awayId: string,
  seed: string,
  ctx: QuickSimContext = {},
) {
  const rnd = makeRng(seed);
  const h = CLUBS[homeId]?.strength ?? 70;
  const a = CLUBS[awayId]?.strength ?? 70;
  const { hg, ag } = regulationScore(expectedGoals(h, a, seed, ctx), rnd);
  return { hg, ag, events: quickEvents(hg, ag, rnd) };
}

/** Use the saved squad for the managed club, including transfers and availability. */
export function careerMatchContext(
  state: CareerState,
  home: string,
  away: string,
): QuickSimContext {
  const ctx: QuickSimContext = {
    homeForm: recentForm(state.fixtures, home, state.round),
    awayForm: recentForm(state.fixtures, away, state.round),
    homeFatigue: squadFatigue(state.fixtures, home, state.round),
    awayFatigue: squadFatigue(state.fixtures, away, state.round),
  };
  if (home !== state.clubId && away !== state.clubId) return ctx;
  const squad = Object.values(state.players).filter((p) => p.clubId === state.clubId);
  let players = state.lineup
    .map((id) => state.players[id])
    .filter(
      (p): p is Player =>
        Boolean(p) && p!.clubId === state.clubId && !p!.suspended && p!.injuryWeeks === 0,
    );
  if (players.length < 11) {
    const { lineup } = pickLineup(squad, state.tactics.formation);
    players = lineup.map((id) => state.players[id]!).filter(Boolean);
  }
  const side = home === state.clubId ? "home" : "away";
  if (players.length) {
    const average = (read: (p: Player) => number) =>
      players.reduce((sum, p) => sum + read(p), 0) / players.length;
    // Club strength represents a normal XI at overall strength-2.
    ctx[`${side}Strength`] =
      average((p) => effectivePlayer(p, state).ovr) + 2 - Math.max(0, 11 - players.length) * 2;
    ctx[`${side}Form`] = ctx[`${side}Form`]! * 0.7 + average((p) => p.form ?? 60) * 0.3;
    ctx[`${side}Fatigue`] = average((p) => 100 - p.condition);
  }
  ctx[`${side}Tactics`] = state.tactics;
  return ctx;
}

/** Forma recente 0–100 pelos pontos nos últimos 5 jogos (60 = neutra). */
/**
 * Cansaço estimado (0–100) de um clube controlado pelo computador: o desgaste
 * cresce ao longo da temporada e cada expulsão nas duas últimas rodadas pesa
 * (elenco desfalcado roda menos). Determinístico, sem estado extra.
 */
export function squadFatigue(fixtures: Fixture[], clubId: string, beforeRound: number): number {
  const lastRound = fixtures.reduce((m, f) => Math.max(m, f.round), 1);
  let reds = 0;
  for (const f of fixtures) {
    if (f.round >= beforeRound || f.round < beforeRound - 2 || !f.events) continue;
    const side = f.home === clubId ? "home" : f.away === clubId ? "away" : null;
    if (!side) continue;
    reds += f.events.filter((e) => e.kind === "vermelho" && e.side === side).length;
  }
  return Math.min(100, 12 + 20 * (beforeRound / lastRound) + 12 * reds);
}

export function recentForm(fixtures: Fixture[], clubId: string, beforeRound: number): number {
  const last = fixtures
    .filter(
      (f) =>
        f.round < beforeRound && f.homeGoals !== null && (f.home === clubId || f.away === clubId),
    )
    .sort((a, b) => b.round - a.round)
    .slice(0, 5);
  if (!last.length) return 60;
  let pts = 0;
  for (const f of last) {
    const mine = f.home === clubId ? f.homeGoals! : f.awayGoals!;
    const theirs = f.home === clubId ? f.awayGoals! : f.homeGoals!;
    pts += mine > theirs ? 3 : mine === theirs ? 1 : 0;
  }
  return Math.round(20 + (pts / (last.length * 3)) * 80);
}

/** Minutos dos gols, pênaltis, gols contra e expulsões, com viradas plausíveis. */
function quickEvents(hg: number, ag: number, rnd: () => number): QuickSimEvent[] {
  const ev: QuickSimEvent[] = [];
  const minute = () => {
    // mais gols no fim de cada tempo
    const r = rnd();
    const m =
      r < 0.47
        ? 1 + Math.floor(Math.pow(rnd(), 0.8) * 45)
        : 46 + Math.floor(Math.pow(rnd(), 0.75) * 45);
    return Math.min(90, m);
  };
  const push = (side: "home" | "away", n: number) => {
    for (let i = 0; i < n; i++) {
      const r = rnd();
      ev.push({
        minute: minute(),
        side,
        kind: r < 0.1 ? "penalti" : r < 0.13 ? "gol_contra" : "gol",
      });
    }
  };
  push("home", hg);
  push("away", ag);
  if (rnd() < 0.12)
    ev.push({
      minute: 30 + Math.floor(rnd() * 60),
      side: rnd() < 0.55 ? "away" : "home",
      kind: "vermelho",
    });
  return ev.sort((x, y) => x.minute - y.minute);
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
