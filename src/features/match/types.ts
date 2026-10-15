import type { MatchRuntime } from "@/game/live-match";

/** Instantâneo do estado do jogo enviado ao HUD (~10x por segundo). */
export interface Snap {
  minute: number;
  clock: string;
  phase: string;
  hg: number;
  ag: number;
  hShots: number;
  aShots: number;
  hXg: number;
  aXg: number;
  hOn: number;
  aOn: number;
  hFouls: number;
  aFouls: number;
  hPass: number;
  aPass: number;
  hPassOk: number;
  aPassOk: number;
  hCorners: number;
  aCorners: number;
  hYellow: number;
  aYellow: number;
  hRed: number;
  aRed: number;
  poss: [number, number];
  events: { type: string; text: string; minute: number }[];
  finished: boolean;
}
export function snapshot(sim: MatchRuntime): Snap {
  const started = sim.stats.home.possessionTicks + sim.stats.away.possessionTicks > 30;
  const [ph, pa] = started ? sim.possessionPct() : ([50, 50] as [number, number]);
  return {
    minute: sim.minute(),
    clock: sim.clock ?? `${sim.minute()}'`,
    phase: sim.phase ?? (sim.minute() <= 45 ? "first" : "second"),
    hg: sim.stats.home.goals,
    ag: sim.stats.away.goals,
    hShots: sim.stats.home.shots,
    aShots: sim.stats.away.shots,
    hXg: Math.round(sim.stats.home.xg * 100) / 100,
    aXg: Math.round(sim.stats.away.xg * 100) / 100,
    hOn: sim.stats.home.onTarget,
    aOn: sim.stats.away.onTarget,
    hFouls: sim.stats.home.fouls,
    aFouls: sim.stats.away.fouls,
    hPass: sim.stats.home.passes,
    aPass: sim.stats.away.passes,
    hPassOk: sim.stats.home.passesOk,
    aPassOk: sim.stats.away.passesOk,
    hCorners: sim.stats.home.corners,
    aCorners: sim.stats.away.corners,
    hYellow: sim.stats.home.yellow,
    aYellow: sim.stats.away.yellow,
    hRed: sim.stats.home.red,
    aRed: sim.stats.away.red,
    poss: [ph, pa],
    events: sim.events.slice(-14).map((e) => ({ type: e.type, text: e.text, minute: e.minute })),
    finished: sim.finished,
  };
}
