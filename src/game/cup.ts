import { CLUBS, LEAGUES } from "./data/leagues";
import { makeRng } from "./rng";
import type { CareerState, CupState, CupTie } from "./types";

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
      stage: 0,
      ties: makeTies(contIds, 0),
      out: false,
      winner: null,
      everyRounds: 6,
    },
  ];
}

const STAGE_NAMES = ["Oitavas de final", "Quartas de final", "Semifinal", "Final"];

export function stageName(stage: number): string {
  return STAGE_NAMES[stage] ?? "Fase";
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

/** Joga a fase atual da copa e devolve o novo estado dela. */
export function playCupStage(cup: CupState, state: CareerState): CupResult {
  if (cup.out || cup.winner) return { cup, userPlayed: false, userWon: false, userScore: null, opponentId: null, champion: cup.winner };

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
