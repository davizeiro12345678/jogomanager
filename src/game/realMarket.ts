/**
 * Mercado de transferências ligado aos clubes e jogadores reais do banco.
 * A negociação (proposta, contraproposta, salário, empréstimo) acontece aqui
 * e o resultado é gravado direto no estado da carreira.
 */
import { CLUBS } from "./data/leagues";
import { valueFor, wageFor } from "./economy";
import { makeRng } from "./rng";
import type { CareerState, Player, Position } from "./types";
import { ownsRealPlayer } from "./player-identity";
import { developedPlayer, withDevelopmentBase } from "./attributes";
import { effectivePlayer } from "./player-development";
import { quoteContract, roundMoney, type SigningQuote } from "./economy-contracts";
import {
  finiteAmount,
  financeLedgerFor,
  financialChange,
  validFinancialState,
} from "./financial-inputs";

export interface RealTarget {
  id: string;
  name: string;
  pos: Position;
  age: number;
  ovr: number;
  number: number | null;
  nationality: string | null;
  photo: string | null;
  clubId: string;
  source?: string | null;
  source_id?: string | null;
  birth_date?: string | null;
  identity_aliases?: string[];
}

export function toTarget(row: {
  id: string;
  name: string;
  position: string;
  age: number;
  overall: number;
  shirt_number: number | null;
  nationality: string | null;
  photo_url: string | null;
  club_id: string;
  source?: string | null;
  source_id?: string | null;
  birth_date?: string | null;
  identity_aliases?: string[];
}): RealTarget {
  const pos = (["GK", "DF", "MF", "FW"] as Position[]).includes(row.position as Position)
    ? (row.position as Position)
    : "MF";
  return {
    id: row.id,
    name: row.name,
    pos,
    age: row.age,
    ovr: row.overall,
    number: row.shirt_number,
    nationality: row.nationality,
    photo: row.photo_url,
    clubId: row.club_id,
    ...(row.source ? { source: row.source } : {}),
    ...(row.source_id ? { source_id: row.source_id } : {}),
    ...(row.birth_date ? { birth_date: row.birth_date } : {}),
    ...(row.identity_aliases ? { identity_aliases: row.identity_aliases } : {}),
  };
}

/** Preço pedido pelo clube dono (M€): valor de mercado + prêmio do clube. */
export function askingPrice(
  t: RealTarget,
  state?: Pick<CareerState, "economyRulesVersion">,
): number {
  const base = valueFor(t.ovr, t.age, { economyRulesVersion: state?.economyRulesVersion });
  const strength = CLUBS[t.clubId]?.strength ?? 70;
  const premium = 1.1 + Math.max(0, strength - 65) / 100;
  return roundMoney(base * premium);
}

/** Salário semanal exigido pelo jogador (k€). */
export function wageAsk(t: RealTarget): number {
  return Math.round(wageFor(t.ovr) * 1.1);
}

export type NegotiationStatus = "accepted" | "counter" | "rejected";

export interface NegotiationResult {
  status: NegotiationStatus;
  /** valor pedido na contraproposta (M€) */
  counter?: number;
  message: string;
}

/**
 * Resposta do clube vendedor a uma proposta.
 * O poder de negociação do treinador (atributo "market") ajuda.
 */
export function negotiate(
  state: CareerState,
  t: RealTarget,
  offer: number,
  attempt: number,
): NegotiationResult {
  const ask = askingPrice(t, state);
  if (!finiteAmount(offer) || !Number.isSafeInteger(attempt) || attempt < 0)
    return { status: "rejected", message: "Proposta financeira inválida." };
  const skill = (state.manager?.attrs.market ?? 3) / 10; // 0..0.5
  const rnd = makeRng(`neg-${t.id}-${state.season}-${state.round}-${attempt}`);
  const tolerance = 0.9 - skill * 0.25 + rnd() * 0.06;

  if (offer >= ask) {
    return { status: "accepted", message: `O ${clubName(t.clubId)} aceitou a proposta.` };
  }
  if (offer >= ask * tolerance) {
    return {
      status: "accepted",
      message: `Depois de conversar, o ${clubName(t.clubId)} aceitou €${offer}M.`,
    };
  }
  if (offer >= ask * 0.55 && attempt < 3) {
    const counter = Math.round(Math.max(offer * 1.12, ask * (0.9 - skill * 0.15)) * 10) / 10;
    return {
      status: "counter",
      counter,
      message: `O ${clubName(t.clubId)} pede €${counter}M para liberar ${t.name}.`,
    };
  }
  return {
    status: "rejected",
    message: `Proposta muito baixa. O ${clubName(t.clubId)} encerrou a conversa.`,
  };
}

export function clubName(id: string): string {
  return CLUBS[id]?.name ?? id;
}

/** Janela aberta nas 4 primeiras e nas rodadas 19-22 do campeonato. */
export function windowOpen(state: CareerState): boolean {
  return state.round <= 4 || (state.round >= 19 && state.round <= 22);
}

function nextNumber(players: Record<string, Player>, wanted: number | null): number {
  const used = new Set(Object.values(players).map((p) => p.number));
  if (wanted && wanted > 0 && !used.has(wanted)) return wanted;
  let n = 1;
  while (used.has(n)) n++;
  return n;
}

function attrs(pos: Position, ovr: number, rnd: () => number) {
  const j = (v: number) => Math.max(35, Math.min(99, Math.round(v + (rnd() * 8 - 4))));
  if (pos === "GK")
    return {
      pace: j(ovr - 20),
      shooting: j(ovr - 40),
      passing: j(ovr - 12),
      defending: j(ovr),
      physical: j(ovr - 4),
    };
  if (pos === "DF")
    return {
      pace: j(ovr - 4),
      shooting: j(ovr - 25),
      passing: j(ovr - 8),
      defending: j(ovr + 4),
      physical: j(ovr + 3),
    };
  if (pos === "MF")
    return {
      pace: j(ovr - 2),
      shooting: j(ovr - 6),
      passing: j(ovr + 4),
      defending: j(ovr - 5),
      physical: j(ovr - 2),
    };
  return {
    pace: j(ovr + 3),
    shooting: j(ovr + 4),
    passing: j(ovr - 4),
    defending: j(ovr - 22),
    physical: j(ovr - 2),
  };
}

export interface SignOptions {
  fee: number;
  wage: number;
  loan?: boolean;
  /** comissão do empresário (M€), somada ao custo */
  agentFee?: number;
  agentName?: string;
}

export function quoteRealSigning(
  state: CareerState,
  target: RealTarget,
  opts: SignOptions,
): SigningQuote {
  const fee = opts.loan ? roundMoney(opts.fee * 0.25) : opts.fee;
  const wage = opts.loan ? Math.round(opts.wage * 0.5) : opts.wage;
  const quote = quoteContract(state, fee, wage, opts.agentFee ?? 0);
  if (!windowOpen(state)) {
    return { ...quote, affordable: false, reason: "A janela de transferências está fechada." };
  }
  if (
    ownsRealPlayer(state, target) ||
    target.clubId === state.clubId ||
    state.players[`real-${target.id}`]
  ) {
    return { ...quote, affordable: false, reason: "O jogador já pertence ao clube." };
  }
  if (![opts.fee, opts.wage, opts.agentFee ?? 0].every((v) => Number.isFinite(v) && v >= 0)) {
    return { ...quote, affordable: false, reason: "Proposta financeira inválida." };
  }
  return quote;
}

/** Fecha a contratação: elenco, caixa, folha e notícia. */
export function signRealPlayer(state: CareerState, t: RealTarget, opts: SignOptions): CareerState {
  if (
    !Number.isFinite(t.ovr) ||
    t.ovr < 20 ||
    t.ovr > 99 ||
    !Number.isFinite(t.age) ||
    t.age < 14 ||
    t.age > 70 ||
    !["GK", "DF", "MF", "FW"].includes(t.pos)
  )
    return state;
  if (ownsRealPlayer(state, t) || t.clubId === state.clubId) return state;
  if (![opts.fee, opts.wage, opts.agentFee ?? 0].every((v) => Number.isFinite(v) && v >= 0))
    return state;
  const quote = quoteRealSigning(state, t, opts);
  if (!quote.affordable) return state;
  const cost = quote.upfrontCost;
  const id = `real-${t.id}`;
  if (state.players[id]) return state;

  const rnd = makeRng(`real-${t.id}`);
  const finances = financialChange(state, 0, cost);
  if (!finances) return state;
  const player: Player = withDevelopmentBase(
    {
      id,
      clubId: state.clubId,
      name: t.name,
      pos: t.pos,
      age: t.age,
      number: nextNumber(state.players, t.number),
      ovr: t.ovr,
      ...attrs(t.pos, t.ovr, rnd),
      condition: 88,
      morale: 80,
      goals: 0,
      assists: 0,
      apps: 0,
      wage: quote.weeklyWage,
      value: valueFor(t.ovr, t.age, { economyRulesVersion: state.economyRulesVersion }),
      yellows: 0,
      suspended: false,
      injuryWeeks: 0,
      rosterSource: "imported",
      sourcePlayerId: t.id,
      ...(t.source ? { sourceProvider: t.source } : {}),
      ...(t.source_id ? { sourceExternalId: t.source_id } : {}),
      ...(t.identity_aliases ? { sourceIdentityAliases: t.identity_aliases } : {}),
      ...(t.birth_date ? { birthDate: t.birth_date } : {}),
      contractYears: opts.loan ? 1 : 2 + Math.floor(rnd() * 4),
      ...(t.nationality ? { nationality: t.nationality } : {}),
      ...(t.photo ? { photo: t.photo } : {}),
    },
    state.developmentRulesVersion === 2 ? 2 : 1,
  );

  return {
    ...state,
    players: { ...state.players, [id]: developedPlayer(player, state) },
    bench: [...state.bench, id],
    transferredIn: [...new Set([...(state.transferredIn ?? []), t.id])],
    records: {
      ...(state.records ?? {}),
      biggestSigning: Math.max(state.records?.biggestSigning ?? 0, cost),
    },
    finances,
    financeLedger: [
      {
        id: `signing-${state.clubId}-${state.season}-${t.id}`,
        season: state.season,
        round: state.round,
        kind: "mercado" as const,
        label: `${t.name}: ${opts.loan ? "empréstimo" : "contratação"}, comissão e luvas`,
        income: 0,
        expense: cost,
      },
      ...(state.financeLedger ?? []),
    ].slice(0, 96),
    news: [
      {
        id: `real-sign-${t.id}-${state.round}`,
        season: state.season,
        round: state.round,
        kind: "mercado" as const,
        title: opts.loan ? `${t.name} chega por empréstimo` : `${t.name} é o novo reforço!`,
        body: `${t.pos} de ${t.age} anos (OVR ${t.ovr}) vem do ${clubName(t.clubId)} por €${quote.fee}M, comissão de €${quote.agentFee}M e luvas de €${quote.signingBonus}M. Salário de €${player.wage}k/semana.`,
      },
      ...state.news,
    ].slice(0, 60),
  };
}

/** Vende um jogador do elenco para um clube real. */
export function sellToClub(
  state: CareerState,
  playerId: string,
  buyerId: string,
  fee: number,
): CareerState {
  if (!validFinancialState(state)) return state;
  const player = state.players[playerId];
  if (!player || player.clubId !== state.clubId) return state;
  if (!CLUBS[buyerId] || buyerId === state.clubId || !finiteAmount(fee)) return state;
  if (
    Object.values(state.players).filter((candidate) => candidate.clubId === state.clubId).length <=
    16
  )
    return state;

  const finances = financialChange(state, fee, 0);
  if (!finances) return state;
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
        id: `sale-${state.clubId}-${state.season}-${state.round}-${playerId}`,
        season: state.season,
        round: state.round,
        kind: "mercado" as const,
        label: `Venda de ${player.name} ao ${clubName(buyerId)}`,
        income: roundMoney(fee),
        expense: 0,
      },
      ...financeLedgerFor(state),
    ].slice(0, 96),
    news: [
      {
        id: `sold-${playerId}-${state.round}`,
        season: state.season,
        round: state.round,
        kind: "mercado" as const,
        title: `${player.name} vendido ao ${clubName(buyerId)}`,
        body: `Negócio fechado por €${fee}M. O valor entra no caixa do clube.`,
      },
      ...state.news,
    ].slice(0, 60),
  };
}

/** Melhor oferta que um clube real faria por um jogador do elenco. */
export function bidFor(state: CareerState, player: Player, buyerId: string): number {
  player = effectivePlayer(player, state);
  const strength = CLUBS[buyerId]?.strength ?? 70;
  const rnd = makeRng(`bid-${player.id}-${buyerId}-${state.round}`);
  const factor = 0.85 + (strength - 60) / 120 + rnd() * 0.25;
  const value =
    state.economyRulesVersion === 2
      ? valueFor(player.ovr, player.age, {
          economyRulesVersion: 2,
          potential: player.potential,
          contractYears: player.contractYears,
        })
      : player.value;
  return roundMoney(value * Math.max(0.6, factor));
}
