/// <reference lib="webworker" />
/**
 * Web Worker de simulação: tira o cálculo pesado da thread da interface.
 *
 * Duas tarefas:
 *  - "simulate": joga uma partida inteira sem desenho (usado no "pular partida")
 *  - "advance":  avança a rodada da carreira (simula todos os outros jogos)
 */
import { MatchSim, type TeamSetup } from "./sim";
import { advanceRound, type MatchPerformance } from "./career";
import type { CareerState } from "./types";

type Req =
  | { id: number; type: "simulate"; home: TeamSetup; away: TeamSetup; seed: string }
  | {
      id: number;
      type: "advance";
      career: CareerState;
      result: { hg: number; ag: number };
      performances: MatchPerformance[];
    };

self.onmessage = (ev: MessageEvent<Req>) => {
  const msg = ev.data;
  try {
    if (msg.type === "simulate") {
      const sim = new MatchSim(msg.home, msg.away, msg.seed);
      let guard = 0;
      while (!sim.finished && guard++ < 200_000) sim.step(0.4);
      (self as unknown as Worker).postMessage({
        id: msg.id,
        ok: true,
        result: {
          hg: sim.stats.home.goals,
          ag: sim.stats.away.goals,
          events: sim.events,
          ratings: sim.playerRatings(),
          scorers: sim.scorers,
        },
      });
      return;
    }
    const career = advanceRound(msg.career, msg.result, msg.performances);
    (self as unknown as Worker).postMessage({ id: msg.id, ok: true, result: career });
  } catch (e) {
    (self as unknown as Worker).postMessage({
      id: msg.id,
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    });
  }
};
