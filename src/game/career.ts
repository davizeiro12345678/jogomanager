import { CLUBS, getLeague } from "./data/leagues";
import { seasonPrize, valueFor, wageFor, weeklyIncome } from "./economy";
import { FORMATIONS } from "./formations";
import { makeRng } from "./rng";
import { computeTable, generateFixtures } from "./season";
import { buildSquad } from "./squad";
import type {
  CareerState,
  FormationKey,
  NewsItem,
  Player,
  Position,
  TrainingFocus,
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

function enrichPlayer(p: Player): Player {
  return {
    ...p,
    wage: p.wage > 0 ? p.wage : wageFor(p.ovr),
    value: p.value > 0 ? p.value : valueFor(p.ovr, p.age),
    yellows: p.yellows ?? 0,
    suspended: p.suspended ?? false,
    injuryWeeks: p.injuryWeeks ?? 0,
  };
}

export function initCareer(
  leagueId: string,
  clubId: string,
  managerName: string,
): CareerState {
  const club = CLUBS[clubId]!;
  const squad = buildSquad(clubId).map(enrichPlayer);
  const formation: FormationKey = "4-3-3";
  const { lineup, bench } = pickLineup(squad, formation);
  const objective = Math.max(1, Math.min(15, Math.round((96 - club.strength) / 4)));

  return {
    version: 2,
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
      budget: Math.round(club.strength * 0.9 * 10) / 10,
      spent: 0,
      income: 0,
    },
    approval: 62,
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
  };
}

/** Migra estados antigos (v1) para o formato atual. */
export function migrateCareer(raw: unknown): CareerState {
  const s = raw as CareerState & { version?: number };
  if (s && s.version === 2) return s;
  const club = CLUBS[s.clubId];
  const players: Record<string, Player> = {};
  for (const [id, p] of Object.entries(s.players ?? {})) {
    players[id] = enrichPlayer(p as Player);
  }
  return {
    ...s,
    version: 2,
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
  const condRegen = state.training === "fisico" ? 16 : state.training === "equilibrado" ? 12 : 9;

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
    if (q.age <= 23 && rnd() < 0.16) {
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
      if (rnd() < 0.045) {
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
  const players: Record<string, Player> = {};
  for (const [id, p] of Object.entries(state.players)) {
    players[id] = {
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

  const squad = Object.values(players);
  const { lineup, bench } = pickLineup(squad, state.tactics.formation);

  return {
    ...state,
    season: state.season + 1,
    round: 1,
    fixtures: generateFixtures(state.leagueId, `${state.clubId}-${state.managerName}-s${state.season + 1}`),
    players,
    lineup,
    bench,
    results: [],
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

export function advanceRound(state: CareerState, userResult: { hg: number; ag: number }) {
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

  // mecânicas semanais sobre o elenco
  const { players, news } = applyWeeklyDevelopment(
    state.players,
    state,
    won,
    `${state.clubId}-${round}-dev`,
  );

  // finanças semanais
  const table = computeTable({ ...state, fixtures });
  const position = table.findIndex((r) => r.clubId === state.clubId) + 1;
  const income = weeklyIncome(CLUBS[state.clubId]?.strength ?? 70, position || 10, won);
  const wages = Object.values(players).reduce((s, p) => s + p.wage, 0) / 1000;
  const budget = Math.round((state.finances.budget + income - wages) * 100) / 100;

  // aprovação da diretoria
  const approval = Math.max(
    5,
    Math.min(100, state.approval + (won ? 2.5 : draw ? 0.5 : -2.5)),
  );

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

  let next: CareerState = {
    ...state,
    fixtures,
    players,
    round: round + 1,
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
    news: [headline, ...news, ...state.news].slice(0, 60),
  };

  if (next.round > totalRounds(next)) {
    next = endSeason(next);
  }

  return next;
}
