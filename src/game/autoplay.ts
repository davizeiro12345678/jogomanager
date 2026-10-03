/**
 * Modo automático: o computador joga a partida do usuário e avança a semana
 * (ou a temporada inteira) sem interação. Reaproveita `quickSimulate` para o
 * placar e distribui gols/assistências pelo elenco escalado, gerando o mesmo
 * histórico por partida que uma partida jogada em 3D.
 */
import { CLUBS } from "@/game/data/leagues";
import {
  advanceRound,
  careerMatchContext,
  quickSimulate,
  type MatchPerformance,
} from "@/game/career";
import { makeRng } from "@/game/rng";
import type { CareerState, Player } from "@/game/types";

export interface AutoWeek {
  kind: "match" | "bye";
  round: number;
  opponentId: string;
  home: boolean;
  gf: number;
  ga: number;
  scorers: { name: string; goals: number }[];
  state: CareerState;
}

/** Peso de chance de marcar por posição. */
function scoreWeight(p: Player) {
  if (p.pos === "FW") return 5 + p.shooting / 20;
  if (p.pos === "MF") return 2.4 + p.shooting / 30;
  if (p.pos === "DF") return 0.7;
  return 0.05;
}

function pickWeighted(list: Player[], rnd: () => number): Player | undefined {
  const total = list.reduce((s, p) => s + scoreWeight(p), 0);
  if (total <= 0) return list[0];
  let r = rnd() * total;
  for (const p of list) {
    r -= scoreWeight(p);
    if (r <= 0) return p;
  }
  return list[list.length - 1];
}

/** Monta a lista de desempenho do elenco titular para um placar já definido. */
export function buildPerformances(
  state: CareerState,
  gf: number,
  seed: string,
): MatchPerformance[] {
  const rnd = makeRng(seed);
  const starters = state.lineup.map((id) => state.players[id]).filter(Boolean) as Player[];
  if (!starters.length) return [];

  const perf = new Map<string, MatchPerformance>();
  for (const p of starters) {
    perf.set(p.id, {
      pid: p.id,
      goals: 0,
      assists: 0,
      played: true,
      minutes: 90,
      rating: Math.round((5.6 + (p.ovr - 60) / 22 + rnd() * 1.2) * 10) / 10,
    });
  }

  for (let g = 0; g < gf; g++) {
    const scorer = pickWeighted(starters, rnd);
    if (!scorer) break;
    const s = perf.get(scorer.id)!;
    s.goals += 1;
    s.rating = Math.min(10, Math.round((s.rating! + 1.1) * 10) / 10);
    if (rnd() > 0.35) {
      const helpers = starters.filter((p) => p.id !== scorer.id && p.pos !== "GK");
      const helper = helpers[Math.floor(rnd() * helpers.length)];
      if (helper) {
        const a = perf.get(helper.id)!;
        a.assists += 1;
        a.rating = Math.min(10, Math.round((a.rating! + 0.6) * 10) / 10);
      }
    }
  }

  return [...perf.values()];
}

/** Simula a partida do usuário desta rodada e devolve o estado já avançado. */
export function autoWeek(state: CareerState): AutoWeek | null {
  const roundFixtures = state.fixtures.filter((f) => f.round === state.round);
  const scheduled = roundFixtures.find((f) => f.home === state.clubId || f.away === state.clubId);
  const fixture = state.fixtures.find(
    (f) =>
      f.round === state.round &&
      f.homeGoals === null &&
      (f.home === state.clubId || f.away === state.clubId),
  );
  if (!fixture) {
    if (scheduled || !roundFixtures.length) return null;
    const next = advanceRound(state, null, [], "Liga");
    return {
      kind: "bye",
      round: state.round,
      opponentId: "",
      home: false,
      gf: 0,
      ga: 0,
      scorers: [],
      state: next,
    };
  }

  const seed = `${state.clubId}-auto-${state.season}-${state.round}`;
  const { hg, ag } = quickSimulate(
    fixture.home,
    fixture.away,
    seed,
    careerMatchContext(state, fixture.home, fixture.away),
  );
  const home = fixture.home === state.clubId;
  const gf = home ? hg : ag;
  const ga = home ? ag : hg;

  const perf = buildPerformances(state, gf, `${seed}-perf`);
  const next = advanceRound(state, { hg, ag }, perf, "Liga");

  const scorers = perf
    .filter((p) => p.goals > 0)
    .map((p) => ({ name: state.players[p.pid]?.name ?? "—", goals: p.goals }));

  return {
    kind: "match",
    round: state.round,
    opponentId: home ? fixture.away : fixture.home,
    home,
    gf,
    ga,
    scorers,
    state: next,
  };
}

/** Roda semanas seguidas até acabar a temporada (ou o limite de segurança). */
export function autoSeason(
  state: CareerState,
  maxWeeks = 60,
): { weeks: AutoWeek[]; state: CareerState } {
  const weeks: AutoWeek[] = [];
  let cur = state;
  const startSeason = state.season;
  for (let i = 0; i < maxWeeks; i++) {
    const w = autoWeek(cur);
    if (!w) break;
    weeks.push(w);
    cur = w.state;
    if (cur.season !== startSeason || cur.sacked) break;
  }
  return { weeks, state: cur };
}

export function clubName(id: string) {
  return CLUBS[id]?.name ?? id;
}
