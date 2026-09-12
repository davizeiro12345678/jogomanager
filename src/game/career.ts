import { CLUBS, getLeague } from "./data/leagues";
import { seasonPrize, valueFor, wageFor, weeklyIncome } from "./economy";
import {
  checkSacking,
  closeSpell,
  defaultStaff,
  gateIncome,
  pressureDelta,
  runWeeklyEvents,
  staffBill,
} from "./events";
import { customPlayersFor, toGamePlayer } from "@/lib/customData";
import { realSquadFor, type RealPlayer } from "@/lib/realSquads";
import { FORMATIONS } from "./formations";
import { makeRng } from "./rng";
import { applyRegens } from "./regen";
import { applyPyramid } from "./pyramid";

import { computeTable, generateFixtures } from "./season";
import { evaluateAchievements } from "./achievements";
import { createCups, cupPrize, inGroupStage, nextPhaseName, playCupStage, stageName } from "./cup";
import { buildSquad } from "./squad";
import type {
  CareerState,
  CupState,
  FormationKey,
  JobOffer,
  ManagerProfile,
  NewsItem,
  Player,
  Position,
  ScoutReport,
  TrainingFocus,
  TransferOffer,
} from "./types";


export function pickLineup(players: Player[], formation: FormationKey) {
  const slots = FORMATIONS[formation];
  const available = [...players]
    .filter((p) => !p.suspended && p.injuryWeeks === 0)
    .sort((a, b) => b.ovr - a.ovr);
  const taken = new Set<string>();
  const lineup: string[] = [];

  for (const slot of slots) {
    const exact = available.find((p) => !taken.has(p.id) && p.pos === slot.pos);
    const fallback = available.find((p) => !taken.has(p.id) && p.pos !== "GK");
    const chosen = exact ?? fallback;
    if (chosen) {
      taken.add(chosen.id);
      lineup.push(chosen.id);
    }
  }

  const bench = available.filter((p) => !taken.has(p.id)).slice(0, 7).map((p) => p.id);
  return { lineup, bench };
}

const PERSONALITIES = [
  "líder",
  "profissional",
  "ambicioso",
  "temperamental",
  "caseiro",
  "determinado",
] as const;

function enrichPlayer(p: Player): Player {
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
      Math.min(99, p.ovr + (p.age <= 20 ? 6 + Math.floor(rnd() * 8) : p.age <= 24 ? 3 + Math.floor(rnd() * 6) : Math.floor(rnd() * 3))),
    personality: p.personality ?? PERSONALITIES[Math.floor(rnd() * PERSONALITIES.length)]!,
    form: p.form ?? Math.round((p.morale + p.condition) / 2),
    contractYears: p.contractYears ?? 1 + Math.floor(rnd() * 4),
    releaseClause:
      p.releaseClause ??
      Math.round(valueFor(p.ovr, p.age) * (1.8 + rnd() * 1.4) * 10) / 10,
    unhappy: p.unhappy ?? false,
  };
}

function defaultV3(club: { strength: number } | undefined) {
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
function withCustomPlayers(clubId: string, squad: Player[]): Player[] {
  const custom = customPlayersFor(clubId);
  if (custom.length === 0) return squad;
  const list = [...squad];
  const usedNumbers = new Set(list.map((p) => p.number));

  custom.forEach((cp) => {
    let num = 2;
    while (usedNumbers.has(num) && num < 40) num++;
    usedNumbers.add(num);
    const player = enrichPlayer(toGamePlayer(cp, num));

    const samePos = list
      .filter((p) => p.pos === cp.pos)
      .sort((a, b) => a.ovr - b.ovr)[0];
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
function withRealPlayers(clubId: string, squad: Player[]): Player[] {
  const real = realSquadFor(clubId);
  if (real.length === 0) return squad;

  const byPos = new Map<string, RealPlayer[]>();
  real.forEach((r) => {
    const list = byPos.get(r.position) ?? [];
    list.push(r);
    byPos.set(r.position, list);
  });
  const spare = [...real];

  return squad.map((p) => {
    const pool = byPos.get(p.pos);
    const pick = pool && pool.length ? pool.shift()! : spare.shift();
    if (!pick) return p;
    const idx = spare.indexOf(pick);
    if (idx >= 0) spare.splice(idx, 1);
    return {
      ...p,
      name: pick.name,
      age: pick.age > 15 && pick.age < 45 ? pick.age : p.age,
      number: pick.shirt_number && pick.shirt_number > 0 ? pick.shirt_number : p.number,
      ...(pick.nationality ? { nationality: pick.nationality } : {}),
      ...(pick.photo_url ? { photo: pick.photo_url } : {}),
    };
  });
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
  );
  const formation: FormationKey = "4-3-3";
  const { lineup, bench } = pickLineup(squad, formation);
  const objective = Math.max(1, Math.min(15, Math.round((96 - club.strength) / 4)));
  const base = defaultV3(club);
  const rep = profile?.reputation ?? 3;
  const loved = profile?.favClub === clubId;
  const budget = Math.round(club.strength * 0.9 * (0.7 + rep * 0.12) * 10) / 10;
  const approval = Math.max(
    20,
    Math.min(95, (profile?.approval ?? 62) + (loved ? 8 : 0)),
  );

  return {
    version: 3,
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
  };
}


/** Migra estados antigos (v1/v2) para o formato atual. */
export function migrateCareer(raw: unknown): CareerState {
  const s = raw as CareerState & { version?: number };
  if (s && s.version === 3)
    return { ...s, achievements: s.achievements ?? [], achievementsUnlockedAt: s.achievementsUnlockedAt ?? {} };
  const club = CLUBS[s.clubId];
  const players: Record<string, Player> = {};
  for (const [id, p] of Object.entries(s.players ?? {})) {
    players[id] = enrichPlayer(p as Player);
  }
  const base = defaultV3(club);
  return {
    ...s,
    version: 3,
    season: s.season ?? 1,
    training: s.training ?? "equilibrado",
    finances: s.finances ?? {
      budget: Math.round((club?.strength ?? 70) * 0.9 * 10) / 10,
      spent: 0,
      income: 0,
    },
    approval: s.approval ?? 62,
    objective: s.objective ?? Math.max(1, Math.min(15, Math.round((96 - (club?.strength ?? 70)) / 4))),
    news: s.news ?? [],
    trophies: s.trophies ?? [],
    history: s.history ?? [],
    players,
    fanApproval: s.fanApproval ?? base.fanApproval,
    pressure: s.pressure ?? base.pressure,
    staff: s.staff ?? base.staff,
    sponsor: s.sponsor ?? base.sponsor,
    ticketPrice: s.ticketPrice ?? base.ticketPrice,
    capacity: s.capacity ?? base.capacity,
    streak: s.streak ?? 0,
    offers: s.offers ?? [],
    jobOffers: s.jobOffers ?? [],
    scoutReports: s.scoutReports ?? [],
    sacked: s.sacked ?? false,
    managerHistory:
      s.managerHistory ?? [{ clubId: s.clubId, from: s.season ?? 1, to: null, note: "Contratado" }],
    achievements: s.achievements ?? [],
    achievementsUnlockedAt: s.achievementsUnlockedAt ?? {},
  };
}


export function orderedPositions(): Position[] {
  return ["GK", "DF", "MF", "FW"];
}

/** Simulação rápida (sem 3D) para as outras partidas da rodada. */
export function quickSimulate(homeId: string, awayId: string, seed: string) {
  const rnd = makeRng(seed);
  const h = (CLUBS[homeId]?.strength ?? 70) + 4;
  const a = CLUBS[awayId]?.strength ?? 70;
  const diff = (h - a) / 10;
  const expH = Math.max(0.25, 1.35 + diff * 0.42);
  const expA = Math.max(0.2, 1.15 - diff * 0.42);
  return { hg: poisson(expH, rnd), ag: poisson(expA, rnd) };
}

function poisson(lambda: number, rnd: () => number) {
  const l = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rnd();
  } while (p > l && k < 12);
  return k - 1;
}

function totalRounds(state: CareerState): number {
  return state.fixtures.reduce((m, f) => Math.max(m, f.round), 0);
}

/* ------------------------------------------------------------ mecânicas */

function trainingAttr(focus: TrainingFocus): keyof Player {
  switch (focus) {
    case "ataque":
      return "shooting";
    case "defesa":
      return "defending";
    case "fisico":
      return "physical";
    case "tecnica":
      return "passing";
    default:
      return "pace";
  }
}

function applyWeeklyDevelopment(
  players: Record<string, Player>,
  state: CareerState,
  won: boolean,
  seed: string,
): { players: Record<string, Player>; news: NewsItem[] } {
  const rnd = makeRng(seed);
  const news: NewsItem[] = [];
  const attr = trainingAttr(state.training);
  const intensity = state.trainingIntensity ?? 1;
  const baseRegen = state.training === "fisico" ? 16 : state.training === "equilibrado" ? 12 : 9;
  // treino leve recupera mais e evolui menos; treino intenso é o contrário
  const condRegen = baseRegen + (intensity === 0 ? 5 : intensity === 2 ? -5 : 0);
  const growthMult = 0.75 + intensity * 0.3;
  const injuryMult = 0.7 + intensity * 0.4;

  const next: Record<string, Player> = {};
  for (const [id, p] of Object.entries(players)) {
    let q = { ...p };

    // recuperação de lesão e suspensão cumprida
    if (q.injuryWeeks > 0) {
      q.injuryWeeks = Math.max(0, q.injuryWeeks - 1);
      if (q.injuryWeeks === 0) {
        news.push({
          id: `heal-${id}-${state.round}`,
          season: state.season,
          round: state.round,
          kind: "lesao",
          title: `${q.name} recuperado`,
          body: `${q.name} está liberado pelo departamento médico e volta aos treinos.`,
        });
      }
    }
    if (q.suspended) q.suspended = false;

    // condição e moral
    q.condition = Math.max(45, Math.min(100, q.condition + condRegen - 4 + Math.floor(rnd() * 6)));
    q.morale = Math.max(
      30,
      Math.min(99, q.morale + (won ? 3 : -2) + Math.floor(rnd() * 5) - 2),
    );

    // desenvolvimento por idade
    if (q.age <= 23 && rnd() < 0.16 * growthMult) {
      (q as unknown as Record<string, number>)[attr] = Math.min(
        99,
        (q[attr] as number) + 1,
      );
      if (rnd() < 0.35) {
        q.ovr = Math.min(99, q.ovr + 1);
        news.push({
          id: `grow-${id}-${state.round}`,
          season: state.season,
          round: state.round,
          kind: "sistema",
          title: `${q.name} evolui para ${q.ovr}`,
          body: `O jovem talento respondeu bem ao treino focado em ${state.training}.`,
        });
      }
    } else if (q.age >= 33 && rnd() < 0.1) {
      q.ovr = Math.max(50, q.ovr - 1);
    }

    // cartões e lesões da rodada (somente quem jogou)
    const played = state.lineup.includes(id) || state.bench.slice(0, 3).includes(id);
    if (played) {
      if (rnd() < 0.11) {
        q.yellows += 1;
        if (q.yellows >= 3) {
          q.yellows = 0;
          q.suspended = true;
          news.push({
            id: `susp-${id}-${state.round}`,
            season: state.season,
            round: state.round,
            kind: "cartao",
            title: `${q.name} suspenso`,
            body: `Terceiro cartão amarelo: ${q.name} desfalca o time na próxima rodada.`,
          });
        }
      }
      if (rnd() < 0.045 * injuryMult) {
        q.injuryWeeks = 1 + Math.floor(rnd() * 4);
        news.push({
          id: `inj-${id}-${state.round}`,
          season: state.season,
          round: state.round,
          kind: "lesao",
          title: `${q.name} se lesiona`,
          body: `${q.name} será desfalque por aproximadamente ${q.injuryWeeks} rodada(s).`,
        });
      }
      q.condition = Math.max(40, q.condition - 8 - Math.floor(rnd() * 8));
    }

    q.value = valueFor(q.ovr, q.age);
    next[id] = q;
  }
  return { players: next, news };
}

function endSeason(state: CareerState): CareerState {
  const club = CLUBS[state.clubId]!;
  const table = computeTable(state);
  const position = table.findIndex((r) => r.clubId === state.clubId) + 1;
  const row = table[position - 1]!;
  const championId = table[0]!.clubId;
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
  if (position === 1) {
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
  const players = regen.players;
  news.push(...regen.news);

  const squad = Object.values(players);
  const { lineup, bench } = pickLineup(squad, state.tactics.formation);

  // acesso e rebaixamento entre as divisões do país
  const move = applyPyramid(state, table, state.pyramidSlots);
  const nextLeagueId = move?.leagueId ?? state.leagueId;
  const nextLeagueClubs = move ? { ...(state.leagueClubs ?? {}), ...move.leagueClubs } : state.leagueClubs;
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

  return {
    ...state,
    season: state.season + 1,
    round: 1,
    records: {
      ...(state.records ?? {}),
      promotions: (state.records?.promotions ?? 0) + (move?.moved === "subiu" ? 1 : 0),
      relegations: (state.records?.relegations ?? 0) + (move?.moved === "desceu" ? 1 : 0),
    },
    leagueId: nextLeagueId,
    ...(nextLeagueClubs ? { leagueClubs: nextLeagueClubs } : {}),
    fixtures: generateFixtures(
      nextLeagueId,
      `${state.clubId}-${state.managerName}-s${state.season + 1}`,
      nextLeagueClubs?.[nextLeagueId],
    ),
    players,
    lineup,
    bench,
    results: [],
    cups: [],
    finances: {
      budget: Math.round((state.finances.budget + prize) * 10) / 10,
      spent: 0,
      income: 0,
    },
    approval,
    trophies:
      position === 1
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
}

export function advanceRound(
  state: CareerState,
  userResult: { hg: number; ag: number },
  performances: MatchPerformance[] = [],
  comp = "Liga",
) {
  const round = state.round;
  const fixtures = state.fixtures.map((f) => {
    if (f.round !== round || f.homeGoals !== null) return f;
    if (f.home === state.clubId || f.away === state.clubId) {
      return { ...f, homeGoals: userResult.hg, awayGoals: userResult.ag };
    }
    const { hg, ag } = quickSimulate(f.home, f.away, `${state.clubId}-${round}-${f.home}`);
    return { ...f, homeGoals: hg, awayGoals: ag };
  });

  const played = state.fixtures.find(
    (f) => f.round === round && (f.home === state.clubId || f.away === state.clubId),
  );

  const userHome = played ? played.home === state.clubId : true;
  const gf = userHome ? userResult.hg : userResult.ag;
  const ga = userHome ? userResult.ag : userResult.hg;
  const won = gf > ga;
  const draw = gf === ga;

  // estatísticas individuais da partida (jogos, gols, assistências)
  let squadAfterMatch = state.players;
  if (performances.length) {
    squadAfterMatch = { ...state.players };
    for (const perf of performances) {
      const p = squadAfterMatch[perf.pid];
      if (!p) continue;
      squadAfterMatch[perf.pid] = {
        ...p,
        apps: (p.apps ?? 0) + (perf.played ? 1 : 0),
        goals: (p.goals ?? 0) + perf.goals,
        assists: (p.assists ?? 0) + perf.assists,
      };
    }
  }

  // mecânicas semanais sobre o elenco
  const { players, news } = applyWeeklyDevelopment(
    squadAfterMatch,
    state,
    won,
    `${state.clubId}-${round}-dev`,
  );



  // finanças semanais
  const table = computeTable({ ...state, fixtures });
  const position = table.findIndex((r) => r.clubId === state.clubId) + 1;
  const homeGame = played ? played.home === state.clubId : false;
  const gate = homeGame ? gateIncome(state) : 0;
  const income =
    weeklyIncome(CLUBS[state.clubId]?.strength ?? 70, position || 10, won) +
    (state.sponsor ?? 0) +
    gate;
  const wages = Object.values(players).reduce((s, p) => s + p.wage, 0) / 1000;
  const costs = wages + staffBill(state);
  const budget = Math.round((state.finances.budget + income - costs) * 100) / 100;

  // aprovação da diretoria e da torcida
  const approval = Math.max(
    5,
    Math.min(100, state.approval + (won ? 2.5 : draw ? 0.5 : -2.5)),
  );
  const fanApproval = Math.max(
    5,
    Math.min(100, (state.fanApproval ?? 60) + (won ? 3 : draw ? 0 : -3) - (state.ticketPrice - 45) / 25),
  );
  const pressure = Math.max(
    0,
    Math.min(
      100,
      (state.pressure ?? 25) + pressureDelta(won, draw, position || 10, state.objective),
    ),
  );
  const streak = won
    ? Math.max(1, (state.streak ?? 0) + 1)
    : draw
      ? 0
      : Math.min(-1, (state.streak ?? 0) - 1);

  const headline: NewsItem = {
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
      ? `${CLUBS[played.home]?.name} ${userResult.hg} x ${userResult.ag} ${CLUBS[played.away]?.name} — Rodada ${round}.`
      : "",
  };


  // histórico partida a partida
  const logEntry = played
    ? {
        season: state.season,
        round,
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
    ...state,
    fixtures,
    players,
    round: round + 1,
    ...(logEntry ? { matchLog: [logEntry, ...(state.matchLog ?? [])].slice(0, 400) } : {}),
    results: played
      ? [
          ...state.results,
          { round, home: played.home, away: played.away, hg: userResult.hg, ag: userResult.ag },
        ]
      : state.results,
    finances: {
      budget,
      spent: state.finances.spent,
      income: Math.round((state.finances.income + income) * 100) / 100,
    },
    approval: Math.round(approval),
    fanApproval: Math.round(fanApproval),
    pressure: Math.round(pressure),
    streak,
    news: [headline, ...news, ...state.news].slice(0, 60),
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

  next = checkSacking(next);

  const newlyUnlocked = evaluateAchievements(next);
  if (newlyUnlocked.length) {
    const now = new Date().toISOString();
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


/** Roda as fases de copa que caem nesta rodada. */
function processCups(state: CareerState, round: number): CareerState {
  const cups: CupState[] = state.cups?.length ? state.cups : createCups(state);
  const news: NewsItem[] = [];
  const trophies = [...state.trophies];
  let budget = state.finances.budget;
  let income = state.finances.income;

  const updated = cups.map((cup) => {
    if (cup.winner || round % cup.everyRounds !== 0) return cup;
    if (cup.out) return cup;
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
        budget = Math.round((budget + prize) * 10) / 10;
        income = Math.round((income + prize) * 10) / 10;
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
      budget = Math.round((budget + prize) * 10) / 10;
      income = Math.round((income + prize) * 10) / 10;
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

/** Aceita uma proposta por um dos seus jogadores. */
export function acceptOffer(state: CareerState, offerId: string): CareerState {
  const offer = (state.offers ?? []).find((o) => o.id === offerId);
  if (!offer) return state;
  const player = state.players[offer.playerId];
  if (!player) return state;
  const players = { ...state.players };
  delete players[offer.playerId];
  const club = CLUBS[offer.clubId];

  return {
    ...state,
    players,
    lineup: state.lineup.filter((id) => id !== offer.playerId),
    bench: state.bench.filter((id) => id !== offer.playerId),
    offers: (state.offers ?? []).filter((o) => o.id !== offerId),
    finances: {
      ...state.finances,
      budget: Math.round((state.finances.budget + offer.amount) * 10) / 10,
      income: Math.round((state.finances.income + offer.amount) * 10) / 10,
    },
    fanApproval: Math.max(5, (state.fanApproval ?? 60) - (player.ovr >= 80 ? 6 : 2)),
    news: [
      {
        id: `sold-${offer.id}`,
        season: state.season,
        round: state.round,
        kind: "mercado" as const,
        title: `${player.name} vendido ao ${club?.name ?? "exterior"}`,
        body: `Transferência fechada por €${offer.amount.toFixed(1)}M.`,
      },
      ...state.news,
    ].slice(0, 60),
  };
}

export function rejectOffer(state: CareerState, offerId: string): CareerState {
  return { ...state, offers: (state.offers ?? []).filter((o) => o.id !== offerId) };
}

/** Assume um novo clube (após demissão, pedido de demissão ou convite). */
export function takeJob(state: CareerState, jobId: string): CareerState {
  const job = (state.jobOffers ?? []).find((j) => j.id === jobId);
  if (!job) return state;
  const club = CLUBS[job.clubId]!;
  const squad = buildSquad(job.clubId).map(enrichPlayer);
  const { lineup, bench } = pickLineup(squad, state.tactics.formation);
  const history = state.sacked ? (state.managerHistory ?? []) : closeSpell(state, "Saiu do clube");

  return {
    ...state,
    leagueId: job.leagueId,
    clubId: job.clubId,
    round: 1,
    fixtures: generateFixtures(job.leagueId, `${job.clubId}-${state.managerName}-s${state.season}`),
    players: Object.fromEntries(squad.map((p) => [p.id, p])),
    lineup,
    bench,
    results: [],
    cups: [],
    finances: { budget: job.budget, spent: 0, income: 0 },
    approval: 60,
    objective: job.objective,
    ...defaultV3(club),
    fanApproval: 58,
    pressure: 20,
    offers: [],
    jobOffers: [],
    sacked: false,

    managerHistory: [...history, { clubId: job.clubId, from: state.season, to: null, note: "Contratado" }],
    news: [
      {
        id: `hire-${job.id}`,
        season: state.season,
        round: state.round,
        kind: "sistema" as const,
        title: `Novo desafio: ${club.name}`,
        body: `Você assinou com o ${club.name}. Objetivo: ${job.objective}º lugar ou melhor.`,
      },
      ...state.news,
    ].slice(0, 60),
  };
}

/** Pede demissão: fica sem clube e recebe convites. */
export function resign(state: CareerState): CareerState {
  const rnd = makeRng(`resign-${state.clubId}-${state.season}-${state.round}`);
  const offers = state.jobOffers?.length ? state.jobOffers : [];
  return {
    ...state,
    sacked: true,
    jobOffers: offers.length
      ? offers
      : [
          {
            id: `job-open-${state.season}-${state.round}`,
            clubId: pickRandomClubId(rnd, state.clubId),
            leagueId: state.leagueId,
            season: state.season,
            round: state.round,
            expiresRound: state.round + 99,
            budget: 20,
            objective: 10,
          },
        ],
    managerHistory: closeSpell(state, "Pediu demissão"),
    news: [
      {
        id: `resign-${state.season}-${state.round}`,
        season: state.season,
        round: state.round,
        kind: "sistema" as const,
        title: "Você pediu demissão",
        body: "Hora de buscar um novo projeto na sala da diretoria.",
      },
      ...state.news,
    ].slice(0, 60),
  };
}

function pickRandomClubId(rnd: () => number, exclude: string): string {
  const ids = Object.keys(CLUBS).filter((id) => id !== exclude);
  return ids[Math.floor(rnd() * ids.length)] ?? exclude;
}

/** Melhora um membro do staff (custo imediato em M€). */
export function upgradeStaff(state: CareerState, role: keyof ReturnType<typeof defaultStaff>): CareerState {
  const staff = state.staff ?? defaultStaff();
  const level = staff[role];
  if (level >= 5) return state;
  const cost = Math.round((level + 1) * 1.2 * 10) / 10;
  if (state.finances.budget < cost) return state;
  return {
    ...state,
    staff: { ...staff, [role]: level + 1 },
    finances: {
      ...state.finances,
      budget: Math.round((state.finances.budget - cost) * 10) / 10,
      spent: Math.round((state.finances.spent + cost) * 10) / 10,
    },
  };
}

/** Gera relatórios de olheiros conforme o nível do departamento. */
export function runScouting(state: CareerState): CareerState {
  const level = (state.staff ?? defaultStaff()).olheiro;
  const rnd = makeRng(`scout-${state.clubId}-${state.season}-${state.round}`);
  const ids = Object.keys(CLUBS).filter((id) => id !== state.clubId);
  const reports: ScoutReport[] = [];
  for (let i = 0; i < 3 + level; i++) {
    const clubId = ids[Math.floor(rnd() * ids.length)]!;
    const squad = buildSquad(clubId).map(enrichPlayer);
    const p = squad[Math.floor(rnd() * squad.length)];
    if (!p) continue;
    reports.push({
      id: `sc-${p.id}-${state.season}-${state.round}-${i}`,
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
  return { ...state, scoutReports: reports };
}

