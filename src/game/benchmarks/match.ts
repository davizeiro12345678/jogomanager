import type { Bench } from "tinybench";

import { snapshotMatch, WorkerMatchView } from "../live-match";
import { buildTeamSetup } from "../quickMatch";
import { ReplayRecorder } from "../replay";
import { decodeReplay, encodeReplay } from "../replay-codec";
import { MatchSim, MATCH_SIMULATION_STEP } from "../sim";

const home = buildTeamSetup("fla");
const away = buildTeamSetup("pal");

function warmedSim(seed: string, ticks: number) {
  const sim = new MatchSim(home, away, seed);
  for (let index = 0; index < ticks; index += 1) sim.step(MATCH_SIMULATION_STEP, 6);
  return sim;
}

function recordedReplay() {
  const sim = new MatchSim(home, away, "bench-replay");
  const recorder = new ReplayRecorder(sim);
  while (!sim.finished) {
    sim.step(0.25, 1);
    recorder.sample();
  }
  return recorder.build("Benchmark replay");
}

export function registerMatchBenchmarks(bench: Bench) {
  const snapshotSim = warmedSim("bench-snapshot", 120);
  const view = new WorkerMatchView(home, away);
  const snapshot = snapshotMatch(snapshotSim, 1);
  const replay = recordedReplay();
  const stored = encodeReplay(replay);

  bench
    .add("match setup: buildTeamSetup", () => {
      buildTeamSetup("fla");
    })
    .add("match setup: new MatchSim", () => {
      new MatchSim(home, away, "bench-setup");
    })
    .add("match simulation: 300 live ticks", () => {
      const sim = new MatchSim(home, away, "bench-live-ticks");
      for (let index = 0; index < 300; index += 1) sim.step(MATCH_SIMULATION_STEP, 6);
    })
    .add("match simulation: 120 coarse steps", () => {
      const sim = new MatchSim(home, away, "bench-coarse-steps");
      for (let index = 0; index < 120 && !sim.finished; index += 1) sim.step(0.5);
    })
    .add("live match: snapshotMatch", () => {
      snapshotMatch(snapshotSim, 1);
    })
    .add("live match: WorkerMatchView.apply", () => {
      view.apply(snapshot);
    })
    .add("replay codec: encodeReplay", () => {
      encodeReplay(replay);
    })
    .add("replay codec: decodeReplay", () => {
      decodeReplay(stored);
    });
}
