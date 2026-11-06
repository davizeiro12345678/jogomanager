import { CLUBS } from "./data/leagues";
import { makeRng } from "./rng";
import { expectedGoals, regulationScore, type MatchConditions } from "./match-probability";
import { effectivePlayer } from "./player-development";
import { pickLineup } from "./career-lineup";
import type { CareerState, Player, Fixture, FixtureEvent } from "./types";

/** Contexto opcional do jogo: forma/moral (0–100) e cansaço dos dois lados. */
export type QuickSimContext = MatchConditions;

export type QuickSimEvent = FixtureEvent;

/**
 * Simulação rápida (sem 3D) para as outras partidas da rodada.
 * A diferença de força é comprimida (tanh) para evitar goleadas demais, e uma
 * correção de Dixon-Coles aproxima a frequência real de empates.
 */
export function quickSimulate(
  homeId: string,
  awayId: string,
  seed: string,
  ctx: QuickSimContext = {},
) {
  const rnd = makeRng(seed);
  const h = CLUBS[homeId]?.strength ?? 70;
  const a = CLUBS[awayId]?.strength ?? 70;
  const { hg, ag } = regulationScore(expectedGoals(h, a, seed, ctx), rnd);
  return { hg, ag, events: quickEvents(hg, ag, rnd) };
}

/** Use the saved squad for the managed club, including transfers and availability. */
export function careerMatchContext(
  state: CareerState,
  home: string,
  away: string,
): QuickSimContext {
  const ctx: QuickSimContext = {
    homeForm: recentForm(state.fixtures, home, state.round),
    awayForm: recentForm(state.fixtures, away, state.round),
    homeFatigue: squadFatigue(state.fixtures, home, state.round),
    awayFatigue: squadFatigue(state.fixtures, away, state.round),
  };
  if (home !== state.clubId && away !== state.clubId) return ctx;
  const squad = Object.values(state.players).filter((p) => p.clubId === state.clubId);
  let players = state.lineup
    .map((id) => state.players[id])
    .filter(
      (p): p is Player =>
        p !== undefined && p.clubId === state.clubId && !p.suspended && p.injuryWeeks === 0,
    );
  if (players.length < 11) {
    const { lineup } = pickLineup(squad, state.tactics.formation);
    players = lineup.map((id) => state.players[id]).filter((p): p is Player => p !== undefined);
  }
  const side = home === state.clubId ? "home" : "away";
  if (players.length) {
    const average = (read: (p: Player) => number) =>
      players.reduce((sum, p) => sum + read(p), 0) / players.length;
    // Club strength represents a normal XI at overall strength-2.
    ctx[`${side}Strength`] =
      average((p) => effectivePlayer(p, state).ovr) + 2 - Math.max(0, 11 - players.length) * 2;
    ctx[`${side}Form`] = (ctx[`${side}Form`] ?? 60) * 0.7 + average((p) => p.form ?? 60) * 0.3;
    ctx[`${side}Fatigue`] = average((p) => 100 - p.condition);
  }
  ctx[`${side}Tactics`] = state.tactics;
  return ctx;
}

/** Forma recente 0–100 pelos pontos nos últimos 5 jogos (60 = neutra). */
/**
 * Cansaço estimado (0–100) de um clube controlado pelo computador: o desgaste
 * cresce ao longo da temporada e cada expulsão nas duas últimas rodadas pesa
 * (elenco desfalcado roda menos). Determinístico, sem estado extra.
 */
export function squadFatigue(fixtures: Fixture[], clubId: string, beforeRound: number): number {
  const lastRound = fixtures.reduce((m, f) => Math.max(m, f.round), 1);
  let reds = 0;
  for (const f of fixtures) {
    if (f.round >= beforeRound || f.round < beforeRound - 2 || !f.events) continue;
    const side = f.home === clubId ? "home" : f.away === clubId ? "away" : null;
    if (!side) continue;
    reds += f.events.filter((e) => e.kind === "vermelho" && e.side === side).length;
  }
  return Math.min(100, 12 + 20 * (beforeRound / lastRound) + 12 * reds);
}

export function recentForm(fixtures: Fixture[], clubId: string, beforeRound: number): number {
  const last = fixtures
    .filter(
      (f) =>
        f.round < beforeRound && f.homeGoals !== null && (f.home === clubId || f.away === clubId),
    )
    .sort((a, b) => b.round - a.round)
    .slice(0, 5);
  if (!last.length) return 60;
  let pts = 0;
  for (const f of last) {
    const mine = f.home === clubId ? (f.homeGoals ?? 0) : (f.awayGoals ?? 0);
    const theirs = f.home === clubId ? (f.awayGoals ?? 0) : (f.homeGoals ?? 0);
    pts += mine > theirs ? 3 : mine === theirs ? 1 : 0;
  }
  return Math.round(20 + (pts / (last.length * 3)) * 80);
}

/** Minutos dos gols, pênaltis, gols contra e expulsões, com viradas plausíveis. */
function quickEvents(hg: number, ag: number, rnd: () => number): QuickSimEvent[] {
  const ev: QuickSimEvent[] = [];
  const minute = () => {
    // mais gols no fim de cada tempo
    const r = rnd();
    const m =
      r < 0.47
        ? 1 + Math.floor(Math.pow(rnd(), 0.8) * 45)
        : 46 + Math.floor(Math.pow(rnd(), 0.75) * 45);
    return Math.min(90, m);
  };
  const push = (side: "home" | "away", n: number) => {
    for (let i = 0; i < n; i++) {
      const r = rnd();
      ev.push({
        minute: minute(),
        side,
        kind: r < 0.1 ? "penalti" : r < 0.13 ? "gol_contra" : "gol",
      });
    }
  };
  push("home", hg);
  push("away", ag);
  if (rnd() < 0.12)
    ev.push({
      minute: 30 + Math.floor(rnd() * 60),
      side: rnd() < 0.55 ? "away" : "home",
      kind: "vermelho",
    });
  return ev.sort((x, y) => x.minute - y.minute);
}
