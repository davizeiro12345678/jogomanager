import { CLUBS, LEAGUES } from "./data/leagues";
import { makeRng } from "./rng";
import type { CareerState, CupGroup, CupGroupMatch, CupState, CupTie } from "./types";

/** Nomes de copa por país (fallback genérico). */
const CUP_NAMES: Record<string, string> = {
  Brasil: "Copa do Brasil",
  Inglaterra: "FA Cup",
  Espanha: "Copa del Rey",
  Itália: "Coppa Italia",
  Alemanha: "DFB-Pokal",
  França: "Coupe de France",
  Portugal: "Taça de Portugal",
  Holanda: "KNVB Beker",
  Argentina: "Copa Argentina",
  México: "Copa MX",
  "Estados Unidos": "US Open Cup",
};

/** Competição continental por país. */
const CONTINENTAL: Record<string, string> = {
  Brasil: "Copa Libertadores",
  Argentina: "Copa Libertadores",
  Uruguai: "Copa Libertadores",
  Chile: "Copa Libertadores",
  Colômbia: "Copa Libertadores",
  Peru: "Copa Libertadores",
  Equador: "Copa Libertadores",
  Paraguai: "Copa Libertadores",
  Bolívia: "Copa Libertadores",
  Venezuela: "Copa Libertadores",
};

const EUROPE = new Set([
  "Inglaterra",
  "Espanha",
  "Itália",
  "Alemanha",
  "França",
  "Portugal",
  "Holanda",
  "Bélgica",
  "Turquia",
  "Escócia",
  "Grécia",
  "Suíça",
  "Áustria",
  "Dinamarca",
  "Noruega",
  "Suécia",
  "Polônia",
  "Ucrânia",
  "Croácia",
  "Sérvia",
  "Tchéquia",
  "Romênia",
  "Rússia",
  "Israel",
  "Hungria",
  "Bulgária",
  "Eslováquia",
  "Eslovênia",
  "Chipre",
  "Irlanda",
  "Finlândia",
  "Islândia",
]);

const AFRICA = new Set(["Egito", "Nigéria", "África do Sul", "Marrocos", "Argélia", "Tunísia", "Gana", "Quênia", "Angola"]);

function clubCountry(clubId: string): string {
  const club = CLUBS[clubId];
  const league = LEAGUES.find((l) => l.id === club?.league);
  return league?.country ?? "Brasil";
}

function continentalName(country: string): string {
  if (CONTINENTAL[country]) return CONTINENTAL[country]!;
  if (EUROPE.has(country)) return "Champions League";
  if (AFRICA.has(country)) return "CAF Champions League";
  if (country === "Estados Unidos" || country === "México" || country === "Canadá" || country === "Costa Rica")
    return "CONCACAF Champions Cup";
  return "AFC Champions League";
}

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
  for (let i = 0; i < ids.length; i += 2) {
    ties.push({ round, home: ids[i]!, away: ids[i + 1]!, hg: null, ag: null });
  }
  return ties;
}

/** Cria a copa nacional e o torneio continental da temporada. */
export function createCups(state: CareerState): CupState[] {
  const country = clubCountry(state.clubId);
  const rnd = makeRng(`cup-${state.clubId}-${state.season}`);

  // Copa nacional: 16 clubes do mesmo país
  const national = LEAGUES.filter((l) => l.country === country).flatMap((l) => l.clubs);
  const natPool = shuffled(
    national.filter((c) => c.id !== state.clubId),
    rnd,
  )
    .slice(0, 15)
    .map((c) => c.id);
  const nationalIds = shuffled([state.clubId, ...natPool], rnd);

  // Continental: 16 clubes fortes do continente
  const contName = continentalName(country);
  const sameGroup = LEAGUES.filter((l) => continentalName(l.country) === contName).flatMap((l) => l.clubs);
  const contPool = shuffled(
    sameGroup.filter((c) => c.id !== state.clubId).sort((a, b) => b.strength - a.strength).slice(0, 40),
    rnd,
  )
    .slice(0, 15)
    .map((c) => c.id);
  const contIds = shuffled([state.clubId, ...contPool], rnd);

  return [
    {
      id: "national",
      name: CUP_NAMES[country] ?? `Copa ${country}`,
      stage: 0,
      ties: makeTies(nationalIds, 0),
      out: false,
      winner: null,
      everyRounds: 4,
    },
    {
      id: "continental",
      name: contName,
      // O continental começa na fase de grupos e entra no mata-mata nas quartas.
      stage: 1,
      ties: [],
      out: false,
      winner: null,
      everyRounds: 6,
      groups: makeGroups(contIds),
      groupRound: 0,
    },
  ];
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
  return STAGE_NAMES[stage] ?? "Fase";
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
  const rnd = makeRng(seed);
  const h = (CLUBS[tie.home]?.strength ?? 70) + 3;
  const a = CLUBS[tie.away]?.strength ?? 70;
  const diff = (h - a) / 10;
  const goals = (exp: number) => {
    let k = 0;
    let p = 1;
    const l = Math.exp(-Math.max(0.2, exp));
    do {
      k++;
      p *= rnd();
    } while (p > l && k < 10);
    return k - 1;
  };
  let hg = goals(1.3 + diff * 0.4);
  let ag = goals(1.15 - diff * 0.4);
  if (hg === ag) {
    // decisão nos pênaltis: um gol extra para o vencedor
    if (rnd() < 0.5 + diff * 0.05) hg += 1;
    else ag += 1;
  }
  return { ...tie, hg, ag };
}

/** Placar de um jogo de grupo: pode terminar empatado. */
function playGroupMatch(match: CupGroupMatch, seed: string): CupGroupMatch {
  const tie = playTie({ round: match.round, home: match.home, away: match.away, hg: null, ag: null }, seed);
  const rnd = makeRng(`${seed}-draw`);
  // playTie desempata sempre; no grupo devolvemos o empate em parte dos jogos.
  if (Math.abs((tie.hg ?? 0) - (tie.ag ?? 0)) === 1 && rnd() < 0.3) {
    const level = Math.min(tie.hg ?? 0, tie.ag ?? 0);
    return { ...match, hg: level, ag: level };
  }
  return { ...match, hg: tie.hg, ag: tie.ag };
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
    const qualified = groups.flatMap((g) => groupTable(g).slice(0, 2).map((r) => r.clubId));
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
  if (cup.out || cup.winner) return { cup, userPlayed: false, userWon: false, userScore: null, opponentId: null, champion: cup.winner };

  if (inGroupStage(cup)) return playGroupRound(cup, state);


  const ties = cup.ties.map((t) =>
    t.round === cup.stage && t.hg === null
      ? playTie(t, `${cup.id}-${state.clubId}-${state.season}-${cup.stage}-${t.home}`)
      : t,
  );
  const played = ties.filter((t) => t.round === cup.stage);
  const userTie = played.find((t) => t.home === state.clubId || t.away === state.clubId);
  const winners = played.map((t) => ((t.hg ?? 0) > (t.ag ?? 0) ? t.home : t.away));

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
  const isFinal = winners.length === 1;
  const nextStage = cup.stage + 1;
  const nextTies = isFinal ? ties : [...ties, ...makeTies(winners, nextStage)];

  return {
    cup: {
      ...cup,
      ties: nextTies,
      stage: isFinal ? cup.stage : nextStage,
      out: out || cup.out,
      winner: isFinal ? winners[0]! : null,
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
  const base = cupId === "continental" ? 4 : 1.6;
  return Math.round(base * (stage + 1) * 10) / 10;
}
