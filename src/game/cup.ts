import { CLUBS, LEAGUES, getLeague } from "./data/leagues";
import { makeRng } from "./rng";
import { competitionScore } from "./competition-match";
import { expectedGoals, poissonGoals, strengthEdge } from "./match-probability";
import { shootoutWinner, solvePenalty, type ShootoutKick } from "./sim-rules";
import {
  calendarYear,
  CONTINENTAL_NAMES,
  SECONDARY_NAMES,
  countryRegulation,
  type Confederation,
} from "./competition-regulations";
import {
  countryOfClub,
  sameClub,
  primaryCompetitionId,
  secondaryCompetitionId,
  nationalCompetitionId,
  seasonTables,
  resolveQualifications,
} from "./competition-season";
import { simulateDivisionTable } from "./standings";
import { intercontinentalField, worldCupField } from "./competition-fields";
import type { CareerState, CupGroup, CupGroupMatch, CupState, CupTie } from "./types";
export { CLUB_WORLD_CUP_QUOTA } from "./competition-fields";

function shuffled<T>(list: T[], rnd: () => number): T[] {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}
function makeTies(ids: string[], round: number): CupTie[] {
  const ties: CupTie[] = [];
  for (let i = 0; i + 1 < ids.length; i += 2)
    ties.push({ round, home: ids[i]!, away: ids[i + 1]!, hg: null, ag: null });
  return ties;
}

/** O sorteio só inscreve quem obteve uma vaga; os outros continentes continuam a ser simulados. */
export function createCups(state: CareerState): CupState[] {
  const country = countryOfClub(state.clubId) ?? getLeague(state.leagueId).country;
  const rnd = makeRng(`cup-${state.season}`);
  const hasCurrent = state.qualifications?.some((e) => e.season === state.season);
  const entries = hasCurrent
    ? state.qualifications!.filter((e) => e.season === state.season)
    : (() => {
        const actual = simulateDivisionTable(
          getLeague(state.leagueId).clubs.map((c) => c.id),
          country,
          `season-${state.season - 1}-${state.leagueId}`,
        );
        const prior = { ...state, season: state.season - 1, calendarYear: calendarYear(state) };
        return resolveQualifications(
          prior,
          seasonTables(prior, actual),
          [],
          state.leagueClubs,
          state.season,
        );
      })();
  const pool = (id: string) => {
    const ids: string[] = [];
    for (const e of entries.filter((e) => e.competitionId === id)) {
      const club = sameClub(e.clubId, state.clubId) ? state.clubId : e.clubId;
      if (!ids.some((other) => sameClub(other, club))) ids.push(club);
    }
    return ids;
  };
  const cups: CupState[] = [];
  const maxRound = Math.max(8, ...state.fixtures.map((f) => f.round));
  const knockout = (
    id: CupState["id"],
    competitionId: string,
    name: string,
    ids: string[],
    note: string,
  ) => {
    if (ids.length < 2) return;
    const shuffledIds = shuffled(ids, rnd);
    let size = 2;
    while (size < shuffledIds.length) size *= 2;
    const byes = size - shuffledIds.length;
    const automaticEntrants = shuffledIds.slice(0, byes);
    const stage = 4 - Math.log2(size);
    cups.push({
      id,
      competitionId,
      name,
      entered: ids.includes(state.clubId),
      stage,
      ties: makeTies(shuffledIds.slice(byes), stage),
      automaticEntrants,
      out: !ids.includes(state.clubId),
      winner: null,
      everyRounds: Math.max(1, Math.floor(maxRound / Math.log2(size))),
      formatNote: note,
    });
  };

  for (const cupCountry of new Set(LEAGUES.map((l) => l.country))) {
    const nationalRules = countryRegulation(cupCountry, calendarYear(state));
    if (nationalRules.domesticCup)
      knockout(
        "national",
        nationalCompetitionId(cupCountry),
        nationalRules.domesticCup,
        pool(nationalCompetitionId(cupCountry)),
        "Participantes classificados pela divisão nacional e pelos estaduais do catálogo; calendário e número de fases adaptados.",
      );
  }

  for (const confed of Object.keys(CONTINENTAL_NAMES) as Confederation[]) {
    const id = primaryCompetitionId(confed),
      ids = pool(id);
    if (ids.length < 2) continue;
    // Inscrições preliminares são decididas antes do grupo; não entram automaticamente por força.
    const direct = ids.filter((club) =>
      entries.some(
        (e) => e.competitionId === id && sameClub(e.clubId, club) && e.phase === "principal",
      ),
    );
    const qualifying = shuffled(
      ids.filter((club) => !direct.includes(club)),
      rnd,
    );
    const target = confed === "UEFA" || confed === "CONMEBOL" ? 32 : 16;
    const qualifyingTies: CupTie[] = [];
    const qualified = qualifying;
    while (qualified.length > Math.max(0, target - direct.length)) {
      const a = qualified.shift(),
        b = qualified.pop();
      if (!a || !b) {
        if (a) qualified.push(a);
        break;
      }
      const tie = playTie(
        { round: -3, home: a, away: b, hg: null, ag: null },
        `qualifier-${state.season}-${id}-${a}-${b}`,
      );
      qualifyingTies.push(tie);
      qualified.push(tie.hg! > tie.ag! ? a : b);
    }
    const field = shuffled([...direct, ...qualified], rnd);
    // Com poucos representantes (OFC), usar mata-mata em vez de inventar adversários.
    if (field.length < 8) {
      knockout(
        "continental",
        id,
        CONTINENTAL_NAMES[confed],
        field,
        "Campo adaptado às associações presentes no catálogo.",
      );
      continue;
    }
    let groupSize = 8;
    while (groupSize * 2 <= Math.min(target, field.length)) groupSize *= 2;
    const selected = field.slice(0, groupSize);
    // Nenhuma inscrição é apagada: extras disputam qualificatória antes da entrada nos grupos.
    const spare = field.slice(groupSize);
    for (const extra of spare) {
      const defender = selected.pop()!;
      const tie = playTie(
        { round: -3, home: extra, away: defender, hg: null, ag: null },
        `qualifier-extra-${state.season}-${id}-${extra}`,
      );
      qualifyingTies.push(tie);
      selected.push(tie.hg! > tie.ag! ? extra : defender);
    }
    const entered = ids.includes(state.clubId);
    cups.push({
      id: "continental",
      competitionId: id,
      name: CONTINENTAL_NAMES[confed],
      entered,
      stage: 4 - Math.log2(groupSize / 2),
      ties: qualifyingTies,
      out: !selected.includes(state.clubId),
      winner: null,
      everyRounds: Math.max(1, Math.floor(maxRound / 7)),
      groups: makeGroups(selected),
      groupRound: 0,
      formatNote: `Vagas por associação; grupos e mata-mata em formato adaptado de ${groupSize} clubes. ${!hasCurrent ? "Primeira edição usa uma temporada anterior simulada." : ""}`,
    });
  }
  for (const confed of Object.keys(SECONDARY_NAMES) as Confederation[]) {
    const id = secondaryCompetitionId(confed),
      name = SECONDARY_NAMES[confed];
    if (name)
      knockout(
        "continental_secondary",
        id,
        name,
        pool(id),
        "Inscrição por classificação nacional; fases adaptadas ao calendário da carreira.",
      );
  }
  knockout(
    "conference",
    "conference:UEFA",
    "Conference League",
    pool("conference:UEFA"),
    "Vaga nacional após Champions e Europa League; fases adaptadas.",
  );
  knockout(
    "regional_path",
    "regional_path:CONCACAF",
    "Classificatórias da América Central e Caribe",
    pool("regional_path:CONCACAF"),
    "Torneios regionais adaptados: seis classificados da América Central e três do Caribe alimentam a Champions Cup.",
  );
  const champions = intercontinentalField(state);
  if (Object.keys(champions).length === 6) {
    const field = Object.values(champions) as string[];
    cups.push({
      id: "intercontinental",
      competitionId: "world:intercontinental",
      name: "Copa Intercontinental",
      entered: field.includes(state.clubId),
      out: !field.includes(state.clubId),
      stage: 0,
      ties: makeTies([champions.AFC!, champions.OFC!], 0),
      winner: null,
      everyRounds: Math.max(1, Math.floor(maxRound / 4)),
      intercontinentalChampions: champions,
      formatNote:
        "Seis campeões continentais; campeão UEFA entra na final. Calendário deslocado para a temporada seguinte do save.",
    });
  }
  const world = worldCupField(state);
  if (world.length === 32)
    cups.push({
      id: "club_world_cup",
      competitionId: "world:club_world_cup",
      name: "Mundial de Clubes",
      entered: world.includes(state.clubId),
      out: !world.includes(state.clubId),
      stage: 0,
      ties: [],
      winner: null,
      everyRounds: Math.max(1, Math.floor(maxRound / 7)),
      groups: makeGroups(shuffled(world, rnd)),
      groupRound: 0,
      formatNote:
        "32 clubes; campeões e pontos continentais de quatro anos. Cotas FIFA da edição de 2025; sede EUA e calendário futuro adaptados.",
    });
  return cups;
}
/** Rodadas de um grupo de quatro: todos contra todos, turno único. */
const GROUP_PAIRS: [number, number][][] = [
  [
    [0, 1],
    [2, 3],
  ],
  [
    [0, 2],
    [1, 3],
  ],
  [
    [0, 3],
    [1, 2],
  ],
];

export const GROUP_ROUNDS = GROUP_PAIRS.length;

function makeGroups(ids: string[]): CupGroup[] {
  const labels = ["A", "B", "C", "D", "E", "F", "G", "H"];
  const groups: CupGroup[] = [];
  for (let g = 0; g * 4 + 4 <= ids.length && g < labels.length; g++) {
    const clubIds = ids.slice(g * 4, g * 4 + 4);
    const matches: CupGroupMatch[] = GROUP_PAIRS.flatMap((pairs, round) =>
      pairs.map(([a, b]) => ({ round, home: clubIds[a]!, away: clubIds[b]!, hg: null, ag: null })),
    );
    groups.push({ label: labels[g]!, clubIds, matches });
  }
  return groups;
}

export interface GroupRow {
  clubId: string;
  p: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  pts: number;
}

/** Classificação de um grupo: pontos, saldo e gols marcados. */
export function groupTable(group: CupGroup): GroupRow[] {
  const rows = new Map<string, GroupRow>(
    group.clubIds.map((id) => [id, { clubId: id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }]),
  );
  for (const m of group.matches) {
    if (m.hg === null || m.ag === null) continue;
    const home = rows.get(m.home);
    const away = rows.get(m.away);
    if (!home || !away) continue;
    home.p++;
    away.p++;
    home.gf += m.hg;
    home.ga += m.ag;
    away.gf += m.ag;
    away.ga += m.hg;
    if (m.hg > m.ag) {
      home.w++;
      home.pts += 3;
      away.l++;
    } else if (m.hg < m.ag) {
      away.w++;
      away.pts += 3;
      home.l++;
    } else {
      home.d++;
      away.d++;
      home.pts++;
      away.pts++;
    }
  }
  return [...rows.values()].sort(
    (a, b) => b.pts - a.pts || b.gf - b.ga - (a.gf - a.ga) || b.gf - a.gf,
  );
}

const STAGE_NAMES = ["Oitavas de final", "Quartas de final", "Semifinal", "Final"];

export function stageName(stage: number): string {
  return STAGE_NAMES[stage] ?? (stage < 0 ? `Fase de ${2 ** (4 - stage)} clubes` : "Fase");
}

/** A fase de grupos ainda está em andamento? */
export function inGroupStage(cup: CupState): boolean {
  return Boolean(cup.groups?.length) && (cup.groupRound ?? GROUP_ROUNDS) < GROUP_ROUNDS;
}

/** Nome da próxima fase, considerando os grupos. */
export function nextPhaseName(cup: CupState): string {
  if (inGroupStage(cup)) return `Fase de grupos · rodada ${(cup.groupRound ?? 0) + 1}`;
  return stageName(cup.stage);
}

/** Confrontos ainda por jogar na fase atual. */
export function currentTies(cup: CupState): CupTie[] {
  return cup.ties.filter((t) => t.round === cup.stage);
}

export interface CupResult {
  cup: CupState;
  /** true se o clube do usuário jogou nesta fase */
  userPlayed: boolean;
  userWon: boolean;
  userScore: string | null;
  opponentId: string | null;
  champion: string | null;
}

function playTie(tie: CupTie, seed: string): CupTie {
  const rnd = makeRng(`${seed}-extra`);
  const h = CLUBS[tie.home]?.strength ?? 70;
  const a = CLUBS[tie.away]?.strength ?? 70;
  const diff = strengthEdge(h, a) * 5;
  let { hg, ag } = competitionScore(tie.home, tie.away, seed);
  let pens: string | undefined;
  if (hg === ag) {
    // Thirty extra minutes use the same quality model as regulation time.
    const rates = expectedGoals(h, a, `${seed}-extra`);
    hg += poissonGoals(rates.home / 3, rnd);
    ag += poissonGoals(rates.away / 3, rnd);
  }
  if (hg === ag) {
    // disputa de pênaltis de verdade; o gol extra marca o vencedor no placar
    const rndS = makeRng(`${seed}-pens`);
    const kicks: ShootoutKick[] = [];
    let turn: "home" | "away" = "home";
    let guard = 0;
    while (!shootoutWinner(kicks) && guard++ < 30) {
      const homeKick: boolean = turn === "home";
      const out = solvePenalty({
        taker: 72 + (homeKick ? diff : -diff),
        gk: 74,
        pressure: 0.5,
        rnd: rndS,
      });
      kicks.push({ side: turn, name: "", scored: out.scored });
      turn = homeKick ? "away" : "home";
    }
    const winner = shootoutWinner(kicks) ?? (rndS() < 0.5 ? "home" : "away");
    const hs = kicks.filter((k) => k.side === "home" && k.scored).length;
    const as = kicks.filter((k) => k.side === "away" && k.scored).length;
    pens = `${hs}x${as}`;
    if (winner === "home") hg += 1;
    else ag += 1;
  }
  return { ...tie, hg, ag, ...(pens ? { pens } : {}) };
}

/** Placar de um jogo de grupo: pode terminar empatado. */
function playGroupMatch(match: CupGroupMatch, seed: string): CupGroupMatch {
  return { ...match, ...competitionScore(match.home, match.away, seed) };
}
/** Joga a próxima rodada da fase de grupos. */
function playGroupRound(cup: CupState, state: CareerState): CupResult {
  const round = cup.groupRound ?? 0;
  const groups = (cup.groups ?? []).map((g) => ({
    ...g,
    matches: g.matches.map((m) =>
      m.round === round && m.hg === null
        ? playGroupMatch(m, `${cup.id}-${state.clubId}-${state.season}-g${round}-${m.home}`)
        : m,
    ),
  }));

  let userWon = false;
  let userScore: string | null = null;
  let opponentId: string | null = null;
  let userPlayed = false;
  for (const g of groups) {
    const m = g.matches.find(
      (x) => x.round === round && (x.home === state.clubId || x.away === state.clubId),
    );
    if (!m) continue;
    userPlayed = true;
    const isHome = m.home === state.clubId;
    opponentId = isHome ? m.away : m.home;
    const gf = isHome ? m.hg! : m.ag!;
    const ga = isHome ? m.ag! : m.hg!;
    userScore = `${gf}x${ga}`;
    userWon = gf > ga;
  }

  const nextRound = round + 1;
  const finished = nextRound >= GROUP_ROUNDS;

  // Fase encerrada: os dois primeiros de cada grupo vão às quartas.
  let ties = cup.ties;
  let out = cup.out;
  if (finished) {
    const qualified = groups.flatMap((g) =>
      groupTable(g)
        .slice(0, 2)
        .map((r) => r.clubId),
    );
    out = !qualified.includes(state.clubId);
    ties = makeTies(qualified, cup.stage);
  }

  return {
    cup: { ...cup, groups, groupRound: nextRound, ties, out },
    userPlayed,
    userWon,
    userScore,
    opponentId,
    champion: null,
  };
}

/** Joga a fase atual da copa e devolve o novo estado dela. */
export function playCupStage(cup: CupState, state: CareerState): CupResult {
  if (cup.winner)
    return {
      cup,
      userPlayed: false,
      userWon: false,
      userScore: null,
      opponentId: null,
      champion: cup.winner,
    };

  if (inGroupStage(cup)) return playGroupRound(cup, state);

  const ties = cup.ties.map((t) =>
    t.round === cup.stage && t.hg === null
      ? playTie(t, `${cup.id}-${state.clubId}-${state.season}-${cup.stage}-${t.home}`)
      : t,
  );
  const played = ties.filter((t) => t.round === cup.stage);
  const userTie = played.find((t) => t.home === state.clubId || t.away === state.clubId);
  const winners = [
    ...(cup.automaticEntrants ?? []),
    ...played.map((t) => ((t.hg ?? 0) > (t.ag ?? 0) ? t.home : t.away)),
  ];

  let userWon = false;
  let userScore: string | null = null;
  let opponentId: string | null = null;
  if (userTie) {
    const isHome = userTie.home === state.clubId;
    opponentId = isHome ? userTie.away : userTie.home;
    const gf = isHome ? userTie.hg! : userTie.ag!;
    const ga = isHome ? userTie.ag! : userTie.hg!;
    userScore = `${gf}x${ga}`;
    userWon = gf > ga;
  }

  const out = Boolean(userTie) && !userWon;
  const isFinal = winners.length === 1 && (!cup.intercontinentalChampions || cup.stage === 3);
  const nextStage = cup.stage + 1;
  let nextIds = winners;
  if (cup.intercontinentalChampions) {
    const c = cup.intercontinentalChampions;
    if (cup.stage === 0) nextIds = [winners[0]!, c.CAF!, c.CONMEBOL!, c.CONCACAF!];
    if (cup.stage === 2) nextIds = [winners[0]!, c.UEFA!];
  }
  const oddBye = !isFinal && nextIds.length % 2 === 1 ? nextIds.slice(0, 1) : [];
  const nextTies = isFinal ? ties : [...ties, ...makeTies(nextIds.slice(oddBye.length), nextStage)];

  return {
    cup: {
      ...cup,
      ties: nextTies,
      stage: isFinal ? cup.stage : nextStage,
      out: out || cup.out,
      winner: isFinal ? winners[0]! : null,
      automaticEntrants: oddBye,
      ...(isFinal ? { finalists: played.flatMap((t) => [t.home, t.away]) } : {}),
    },
    userPlayed: Boolean(userTie),
    userWon,
    userScore,
    opponentId,
    champion: isFinal ? winners[0]! : null,
  };
}

/** Premiação por avançar de fase (M€). */
export function cupPrize(cupId: string, stage: number): number {
  const base =
    cupId === "club_world_cup"
      ? 8
      : cupId === "intercontinental"
        ? 6
        : cupId === "continental"
          ? 4
          : 1.6;
  return Math.round(base * (stage < 0 ? 1 / 2 ** -stage : stage + 1) * 10) / 10;
}
