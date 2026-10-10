import { LEAGUES } from "./data/leagues";
import { poolForLeague } from "./data/names";
import { valueFor, wageFor } from "./economy";
import { makeRng } from "./rng";
import type { CareerState, Player, Position } from "./types";
import { quoteContract, roundMoney } from "./economy-contracts";
import { developedPlayer, withDevelopmentBase } from "./attributes";
import { validPlayerSkills } from "./player-rating-inputs";
import {
  finiteAmount,
  financeLedgerFor,
  financialChange,
  validFinancialState,
} from "./financial-inputs";

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
export function generateMarket(
  seed: string,
  count = 12,
  economyRulesVersion?: 1 | 2,
): MarketEntry[] {
  const rnd = makeRng(`market-${seed}`);
  const entries: MarketEntry[] = [];
  const used = new Set<string>();

  for (let i = 0; i < count; i++) {
    const league = LEAGUES[Math.floor(rnd() * LEAGUES.length)]!;
    const pool = poolForLeague(league.id);
    let name: string;
    let guard = 0;
    do {
      name = `${pool.first[Math.floor(rnd() * pool.first.length)]} ${pool.last[Math.floor(rnd() * pool.last.length)]}`;
      guard++;
    } while (used.has(name) && guard < 40);
    used.add(name);

    const pos = POSITIONS[Math.floor(rnd() * POSITIONS.length)]!;
    const age = 17 + Math.floor(rnd() * 18);
    const ovr = 58 + Math.floor(rnd() * 30);
    const value = valueFor(ovr, age, { economyRulesVersion });
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
      price: roundMoney(value * (1.15 + rnd() * 0.6)),
      wage: Math.round(wageFor(ovr) * (1 + rnd() * 0.3)),
      fromLeague: league.name,
    });
  }

  return entries.sort((a, b) => b.ovr - a.ovr);
}

function nextNumber(players: Record<string, Player>, clubId: string): number {
  const used = new Set(
    Object.values(players)
      .filter((p) => p.clubId === clubId)
      .map((p) => p.number),
  );
  let n = 1;
  while (used.has(n)) n++;
  return n;
}

export function quoteSigning(state: CareerState, entry: MarketEntry) {
  return quoteContract(state, entry.price, entry.wage, roundMoney(entry.price * 0.03));
}

export function signPlayer(state: CareerState, entry: MarketEntry): CareerState {
  if (!validPlayerSkills(entry) || !entry.key || !entry.name.trim()) return state;
  if (
    !Number.isFinite(entry.price) ||
    entry.price < 0 ||
    !Number.isFinite(entry.wage) ||
    entry.wage < 0
  )
    return state;
  const quote = quoteSigning(state, entry);
  if (!quote.affordable) return state;
  const id = `free-${entry.key}`;
  if (state.players[id]) return state;

  const finances = financialChange(state, 0, quote.upfrontCost);
  if (!finances) return state;
  const player: Player = withDevelopmentBase(
    {
      id,
      clubId: state.clubId,
      name: entry.name,
      pos: entry.pos,
      age: entry.age,
      number: nextNumber(state.players, state.clubId),
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
      value: valueFor(entry.ovr, entry.age, { economyRulesVersion: state.economyRulesVersion }),
      yellows: 0,
      suspended: false,
      injuryWeeks: 0,
    },
    state.developmentRulesVersion === 2 ? 2 : 1,
  );

  return {
    ...state,
    players: { ...state.players, [id]: developedPlayer(player, state) },
    bench: [...state.bench, id],
    records: {
      ...(state.records ?? {}),
      biggestSigning: Math.max(state.records?.biggestSigning ?? 0, entry.price),
    },
    finances,
    financeLedger: [
      {
        id: `signing-${state.clubId}-${state.season}-${id}`,
        season: state.season,
        round: state.round,
        kind: "mercado" as const,
        label: `Contratação de ${entry.name}, comissão e luvas`,
        income: 0,
        expense: quote.upfrontCost,
      },
      ...financeLedgerFor(state),
    ].slice(0, 96),
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
  if (!validFinancialState(state)) return state;
  const player = state.players[playerId];
  if (!player || player.clubId !== state.clubId) return state;
  if (Object.values(state.players).filter((p) => p.clubId === state.clubId).length <= 16)
    return state;

  // compensação de rescisão: 20% do valor
  if (!finiteAmount(player.value)) return state;
  const fee = roundMoney(player.value * 0.2);
  const finances = financialChange(state, 0, fee);
  if (!finances || finances.budget < 0) return state;
  const players = { ...state.players };
  delete players[playerId];

  return {
    ...state,
    players,
    lineup: state.lineup.filter((id) => id !== playerId),
    bench: state.bench.filter((id) => id !== playerId),
    finances,
    financeLedger: [
      {
        id: `release-${state.clubId}-${state.season}-${state.round}-${playerId}`,
        season: state.season,
        round: state.round,
        kind: "mercado" as const,
        label: `Rescisão de ${player.name}`,
        income: 0,
        expense: fee,
      },
      ...financeLedgerFor(state),
    ].slice(0, 96),
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
