/**
 * Mercado de transferências ligado aos clubes e jogadores reais do banco.
 * A negociação (proposta, contraproposta, salário, empréstimo) acontece aqui
 * e o resultado é gravado direto no estado da carreira.
 */
import { CLUBS } from "./data/leagues";
import { valueFor, wageFor } from "./economy";
import { makeRng } from "./rng";
import type { CareerState, Player, Position } from "./types";

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
  };
}

/** Preço pedido pelo clube dono (M€): valor de mercado + prêmio do clube. */
export function askingPrice(t: RealTarget): number {
  const base = valueFor(t.ovr, t.age);
  const strength = CLUBS[t.clubId]?.strength ?? 70;
  const premium = 1.1 + Math.max(0, strength - 65) / 100;
  return Math.round(base * premium * 10) / 10;
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
  const ask = askingPrice(t);
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

/** Fecha a contratação: elenco, caixa, folha e notícia. */
export function signRealPlayer(state: CareerState, t: RealTarget, opts: SignOptions): CareerState {
  const base = opts.loan ? Math.round(opts.fee * 0.25 * 10) / 10 : opts.fee;
  const cost = Math.round((base + (opts.agentFee ?? 0)) * 10) / 10;
  if (state.finances.budget < cost) return state;
  const id = `real-${t.id}`;
  if (state.players[id]) return state;

  const rnd = makeRng(`real-${t.id}`);
  const player: Player = {
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
    wage: opts.loan ? Math.round(opts.wage * 0.5) : opts.wage,
    value: valueFor(t.ovr, t.age),
    yellows: 0,
    suspended: false,
    injuryWeeks: 0,
    contractYears: opts.loan ? 1 : 2 + Math.floor(rnd() * 4),
    ...(t.nationality ? { nationality: t.nationality } : {}),
    ...(t.photo ? { photo: t.photo } : {}),
  };

  return {
    ...state,
    players: { ...state.players, [id]: player },
    bench: [...state.bench, id],
    transferredIn: [...(state.transferredIn ?? []), t.id],
    records: {
      ...(state.records ?? {}),
      biggestSigning: Math.max(state.records?.biggestSigning ?? 0, cost),
    },
    finances: {
      ...state.finances,
      budget: Math.round((state.finances.budget - cost) * 10) / 10,
      spent: Math.round((state.finances.spent + cost) * 10) / 10,
    },
    news: [
      {
        id: `real-sign-${t.id}-${state.round}`,
        season: state.season,
        round: state.round,
        kind: "mercado" as const,
        title: opts.loan ? `${t.name} chega por empréstimo` : `${t.name} é o novo reforço!`,
        body: `${t.pos} de ${t.age} anos (OVR ${t.ovr}) vem do ${clubName(t.clubId)} por €${cost}M, salário de €${player.wage}k/semana.`,
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
  const player = state.players[playerId];
  if (!player) return state;
  if (Object.keys(state.players).length <= 16) return state;

  const players = { ...state.players };
  delete players[playerId];

  return {
    ...state,
    players,
    lineup: state.lineup.filter((id) => id !== playerId),
    bench: state.bench.filter((id) => id !== playerId),
    finances: {
      ...state.finances,
      budget: Math.round((state.finances.budget + fee) * 10) / 10,
      income: Math.round((state.finances.income + fee) * 10) / 10,
    },
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
  const strength = CLUBS[buyerId]?.strength ?? 70;
  const rnd = makeRng(`bid-${player.id}-${buyerId}-${state.round}`);
  const factor = 0.85 + (strength - 60) / 120 + rnd() * 0.25;
  return Math.round(player.value * Math.max(0.6, factor) * 10) / 10;
}
