// ============================================================================
//  unhappy.ts
//  Vestiário: quem está insatisfeito, por quê, e o que você pode fazer.
//
//  A insatisfação nasce de fatos (sem minutos, oferta recusada, salário
//  defasado, moral em queda) e aparece numa lista com motivo e gravidade. O
//  treinador conversa: elogia, promete titularidade, multa ou libera para
//  negociar. Cada ação tem resultado sorteado por semente — temperamental
//  explode fácil, profissional engole e trabalha, ambicioso só quer vitrine.
// ============================================================================

import { makeRng } from "./rng";
import { recordPlayerConversation, worldFor } from "./career-world";
import type { CareerState, NewsItem, Personality, Player } from "./types";

export type UnhappyReason = "minutos" | "oferta" | "salario" | "moral" | "promessa";

export interface Grievance {
  pid: string;
  reason: UnhappyReason;
  /** 1 leve .. 3 grave */
  level: 1 | 2 | 3;
  detail: string;
}

export const REASON_LABEL: Record<UnhappyReason, string> = {
  minutos: "Sem minutos",
  oferta: "Quer sair",
  salario: "Salário defasado",
  moral: "Moral baixa",
  promessa: "Promessa quebrada",
};

/** Detecta os insatisfeitos do elenco a partir dos fatos da carreira. */
export function detectUnhappy(state: CareerState): Grievance[] {
  const out: Grievance[] = [];
  const players = Object.values(state.players);
  const avgWage = players.reduce((s, p) => s + p.wage, 0) / Math.max(1, players.length);
  for (const p of players) {
    const star = p.ovr >= 76;
    const starter = state.lineup.includes(p.id);
    // craque no banco: o caso clássico
    if (star && !starter && p.injuryWeeks === 0 && !p.suspended) {
      out.push({
        pid: p.id,
        reason: "minutos",
        level: p.ovr >= 82 ? 3 : 2,
        detail: `${p.name} (${p.ovr}) esquenta banco e quer jogar.`,
      });
      continue;
    }
    // oferta recusada por ele: ficou magoado
    if (state.rejectedOffers?.includes(p.id)) {
      out.push({
        pid: p.id,
        reason: "oferta",
        level: 2,
        detail: `${p.name} queria sair e você barrou a transferência.`,
      });
      continue;
    }
    // promessa quebrada pesa mais que tudo
    const broken = state.brokenPromises?.includes(p.id);
    if (broken) {
      out.push({
        pid: p.id,
        reason: "promessa",
        level: 3,
        detail: `Você prometeu minutos a ${p.name} e não cumpriu.`,
      });
      continue;
    }
    // salário defasado: rende como estrela, ganha como reserva
    if (p.ovr >= 76 && p.wage < avgWage * 0.8) {
      out.push({
        pid: p.id,
        reason: "salario",
        level: 2,
        detail: `${p.name} rende de titular e ganha abaixo da média.`,
      });
      continue;
    }
    // moral em queda livre
    if (p.morale < 45 && starter) {
      out.push({
        pid: p.id,
        reason: "moral",
        level: p.morale < 32 ? 3 : 1,
        detail: `${p.name} anda abatido e rende abaixo do normal.`,
      });
    }
  }
  return out.sort((a, b) => b.level - a.level);
}

export type TalkAction = "elogiar" | "prometer" | "multar" | "liberar";

export const TALK_LABEL: Record<TalkAction, string> = {
  elogiar: "Elogiar em público",
  prometer: "Prometer titularidade",
  multar: "Multar e cobrar",
  liberar: "Liberar para negociar",
};

export interface TalkResult {
  ok: boolean;
  message: string;
  moraleDelta: number;
}

/**
 * Conversa com o insatisfeito. O temperamento do jogador (quando existe)
 * pesa no dado; o resto é semente por jogador+rodada (repetir a conversa na
 * mesma rodada dá o mesmo resultado — sem ficar clicando até dar sorte).
 */
export function talkTo(
  state: CareerState,
  p: Player,
  grievance: Grievance,
  action: TalkAction,
): TalkResult {
  const rng = makeRng(`talk-${p.id}-${state.season}-${state.round}-${action}`);
  const roll = rng();
  const personality: Personality = p.personality ?? "profissional";
  const bonus =
    action === "elogiar"
      ? personality === "temperamental"
        ? -0.2
        : personality === "caseiro"
          ? 0.15
          : 0
      : action === "prometer"
        ? personality === "ambicioso"
          ? 0.2
          : personality === "temperamental"
            ? -0.1
            : 0.05
        : action === "multar"
          ? personality === "profissional" || personality === "determinado"
            ? 0.25
            : -0.25
          : 0.1;
  const world = worldFor(state);
  const bond = world.relationships[p.id];
  const remembered = ((bond?.trust ?? 55) - 55) / 220;
  const manner =
    action === "multar"
      ? (50 - world.identity.protection) / 450
      : (world.identity.protection - 50) / 550;
  const need = 0.35 + grievance.level * 0.12;
  const ok = roll + bonus + remembered + manner >= need;

  if (action === "elogiar") {
    return ok
      ? {
          ok: true,
          message: `${p.name} gostou do elogio e treinou sorrindo. (+8 moral)`,
          moraleDelta: 8,
        }
      : {
          ok: false,
          message: `${p.name} achou papo furado. "Quero jogar, não ouvir elogio." (-3 moral)`,
          moraleDelta: -3,
        };
  }
  if (action === "prometer") {
    return ok
      ? {
          ok: true,
          message: `${p.name} aceitou: titular nos próximos 3 jogos, ou a coisa azeda. (+10 moral)`,
          moraleDelta: 10,
        }
      : {
          ok: false,
          message: `${p.name} não acredita mais em promessa. "Quero por escrito." (-4 moral)`,
          moraleDelta: -4,
        };
  }
  if (action === "multar") {
    return ok
      ? {
          ok: true,
          message: `${p.name} engoliu a bronca e baixou a cabeça. O grupo entendeu o recado. (+4 moral)`,
          moraleDelta: 4,
        }
      : {
          ok: false,
          message: `${p.name} explodiu: "Me multa? Então me vende!" O clima pesou. (-8 moral)`,
          moraleDelta: -8,
        };
  }
  // liberar: sempre "funciona" — o jogador fica feliz, o problema vira mercado
  return {
    ok: true,
    message: `${p.name} agradeceu. Agora é esperar proposta — e torcer para ser boa. (+6 moral)`,
    moraleDelta: 6,
  };
}

/** Aplica o resultado da conversa (moral + promessa registrada). */
export function applyTalk(
  state: CareerState,
  pid: string,
  action: TalkAction,
  result: TalkResult,
): CareerState {
  const p = state.players[pid];
  if (!p) return state;
  const players = {
    ...state.players,
    [pid]: { ...p, morale: Math.max(10, Math.min(99, p.morale + result.moraleDelta)) },
  };
  const news: NewsItem[] = [];
  let promises = state.promises ?? [];
  if (action === "prometer" && result.ok) {
    promises = [
      ...promises.filter((pr) => pr.pid !== pid),
      { pid, starts: 0, target: 3, untilRound: state.round + 3 },
    ];
  }
  if (action === "liberar") {
    news.push({
      id: `lista-${pid}-${state.round}`,
      season: state.season,
      round: state.round,
      kind: "mercado",
      title: `${p.name} liberado para negociar`,
      body: `O treinador autorizou ${p.name} a ouvir propostas. O mercado reage nas próximas rodadas.`,
    });
  }
  return recordPlayerConversation(
    state,
    { ...state, players, promises, news: [...news, ...state.news].slice(0, 60) },
    pid,
    action,
    result.ok,
  );
}

/**
 * Cobra as promessas no fim da rodada: quem foi titular soma; quem estourou o
 * prazo sem os jogos vira "promessa quebrada" (moral despenca e vira notícia).
 * Chamado pelo advanceRound com as atuações da rodada.
 */
export function settlePromises(state: CareerState, starters: readonly string[]): CareerState {
  const promises = state.promises ?? [];
  if (!promises.length) return state;
  const players = { ...state.players };
  const news: NewsItem[] = [];
  let broken = state.brokenPromises ?? [];
  const kept: typeof promises = [];
  for (const pr of promises) {
    const p = players[pr.pid];
    if (!p) continue;
    const starts = pr.starts + (starters.includes(pr.pid) ? 1 : 0);
    if (starts >= pr.target) {
      players[pr.pid] = { ...p, morale: Math.min(99, p.morale + 5) };
      news.push({
        id: `promok-${pr.pid}-${state.round}`,
        season: state.season,
        round: state.round,
        kind: "vestiario",
        title: `Promessa cumprida com ${p.name}`,
        body: `${p.name} ganhou os minutos prometidos e o vestiário respeita sua palavra.`,
      });
      continue;
    }
    if (state.round >= pr.untilRound) {
      players[pr.pid] = { ...p, morale: Math.max(10, p.morale - 15) };
      if (!broken.includes(pr.pid)) broken = [...broken, pr.pid];
      news.push({
        id: `prombad-${pr.pid}-${state.round}`,
        season: state.season,
        round: state.round,
        kind: "vestiario",
        title: `${p.name} cobra promessa quebrada`,
        body: `Você prometeu titularidade a ${p.name} e não cumpriu. O clima azedou.`,
      });
      continue;
    }
    kept.push({ ...pr, starts });
  }
  return {
    ...state,
    players,
    promises: kept,
    brokenPromises: broken,
    news: [...news, ...state.news].slice(0, 60),
  };
}
