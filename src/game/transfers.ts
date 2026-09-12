import { LEAGUES } from "./data/leagues";
import { poolForLeague } from "./data/names";
import { valueFor, wageFor } from "./economy";
import { makeRng } from "./rng";
import type { CareerState, Player, Position } from "./types";

export interface MarketEntry {
  key: string;
  name: string;
  pos: Position;
  age: number;
  ovr: number;
  pace: number;
  shooting: number;
  passing: number;
  defending: number;
  physical: number;
  /** preço pedido em M€ */
  price: number;
  /** salário semanal exigido em k€ */
  wage: number;
  fromLeague: string;
}

const POSITIONS: Position[] = ["GK", "DF", "DF", "MF", "MF", "FW"];

const j = (v: number, rnd: () => number) =>
  Math.max(35, Math.min(99, Math.round(v + (rnd() * 10 - 5))));

/** Gera o mercado da rodada de forma determinística. */
export function generateMarket(seed: string, count = 12): MarketEntry[] {
  const rnd = makeRng(`market-${seed}`);
  const entries: MarketEntry[] = [];
  const used = new Set<string>();

  for (let i = 0; i < count; i++) {
    const league = LEAGUES[Math.floor(rnd() * LEAGUES.length)]!;
    const pool = poolForLeague(league.id);
    let name = "";
    let guard = 0;
    do {
      name = `${pool.first[Math.floor(rnd() * pool.first.length)]} ${pool.last[Math.floor(rnd() * pool.last.length)]}`;
      guard++;
    } while (used.has(name) && guard < 40);
    used.add(name);

    const pos = POSITIONS[Math.floor(rnd() * POSITIONS.length)]!;
    const age = 17 + Math.floor(rnd() * 18);
    const ovr = 58 + Math.floor(rnd() * 30);
    const value = valueFor(ovr, age);
    entries.push({
      key: `${seed}-${i}`,
      name,
      pos,
      age,
      ovr,
      pace: j(ovr, rnd),
      shooting: j(ovr, rnd),
      passing: j(ovr, rnd),
      defending: j(ovr, rnd),
      physical: j(ovr, rnd),
      price: Math.round(value * (1.15 + rnd() * 0.6) * 10) / 10,
      wage: Math.round(wageFor(ovr) * (1 + rnd() * 0.3)),
      fromLeague: league.name,
    });
  }

  return entries.sort((a, b) => b.ovr - a.ovr);
}

function nextNumber(players: Record<string, Player>): number {
  const used = new Set(Object.values(players).map((p) => p.number));
  let n = 1;
  while (used.has(n)) n++;
  return n;
}

export function signPlayer(state: CareerState, entry: MarketEntry): CareerState {
  if (state.finances.budget < entry.price) return state;
  const id = `free-${entry.key}`;
  if (state.players[id]) return state;

  const player: Player = {
    id,
    clubId: state.clubId,
    name: entry.name,
    pos: entry.pos,
    age: entry.age,
    number: nextNumber(state.players),
    ovr: entry.ovr,
    pace: entry.pace,
    shooting: entry.shooting,
    passing: entry.passing,
    defending: entry.defending,
    physical: entry.physical,
    condition: 85,
    morale: 75,
    goals: 0,
    assists: 0,
    apps: 0,
    wage: entry.wage,
    value: valueFor(entry.ovr, entry.age),
    yellows: 0,
    suspended: false,
    injuryWeeks: 0,
  };

  return {
    ...state,
    players: { ...state.players, [id]: player },
    bench: [...state.bench, id],
    records: {
      ...(state.records ?? {}),
      biggestSigning: Math.max(state.records?.biggestSigning ?? 0, entry.price),
    },
    finances: {
      ...state.finances,
      budget: Math.round((state.finances.budget - entry.price) * 10) / 10,
      spent: Math.round((state.finances.spent + entry.price) * 10) / 10,
    },
    news: [
      {
        id: `sign-${id}`,
        season: state.season,
        round: state.round,
        kind: "mercado" as const,
        title: `${entry.name} é o novo reforço!`,
        body: `${entry.pos} de ${entry.age} anos (OVR ${entry.ovr}) chega por €${entry.price}M vindo da ${entry.fromLeague}.`,
      },
      ...state.news,
    ].slice(0, 60),
  };
}

export function releasePlayer(state: CareerState, playerId: string): CareerState {
  const player = state.players[playerId];
  if (!player) return state;
  if (Object.keys(state.players).length <= 16) return state;

  const players = { ...state.players };
  delete players[playerId];

  // compensação de rescisão: 20% do valor
  const fee = Math.round(player.value * 0.2 * 10) / 10;

  return {
    ...state,
    players,
    lineup: state.lineup.filter((id) => id !== playerId),
    bench: state.bench.filter((id) => id !== playerId),
    finances: {
      ...state.finances,
      budget: Math.round((state.finances.budget - fee) * 10) / 10,
    },
    news: [
      {
        id: `release-${playerId}-${state.round}`,
        season: state.season,
        round: state.round,
        kind: "mercado" as const,
        title: `${player.name} deixa o clube`,
        body: `Rescisão amigável com compensação de €${fee}M. O elenco agradece os serviços prestados.`,
      },
      ...state.news,
    ].slice(0, 60),
  };
}
