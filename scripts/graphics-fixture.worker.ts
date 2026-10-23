import { MatchSim } from "../src/game/sim";
import { snapshotMatch } from "../src/game/live-match";
import { benchmarkTeam } from "./graphics-fixture";

let sim: MatchSim | null = null;
let seq = 0;
let auto: ReturnType<typeof setInterval> | undefined;
let manualMode = false;

function publish() {
  if (!sim) return;
  const snapshot = snapshotMatch(sim, ++seq);
  // QA metadata uses the existing read-only physics snapshot. It never feeds
  // back into the simulation and is absent from the ordinary animated fixture.
  postMessage(
    manualMode
      ? {
          ...snapshot,
          fixture: { seq: snapshot.seq, time: snapshot.time, ball: sim.physicsBallState() },
        }
      : snapshot,
  );
}

function advance(ms: number) {
  if (!sim) return;
  // Fixed simulation steps keep the match sequence independent from render FPS.
  const steps = Math.max(1, Math.round(ms / (1000 / 30)));
  for (let i = 0; i < steps; i++) sim.step(1 / 30, 6);
  publish();
}

function stopAuto() {
  if (auto === undefined) return;
  clearInterval(auto);
  auto = undefined;
}

function startAuto() {
  if (auto !== undefined) return;
  auto = setInterval(() => advance(100), 100);
}

function initialize(seed: string, manual: boolean) {
  stopAuto();
  seq = 0;
  manualMode = manual;
  sim = new MatchSim(benchmarkTeam("fla"), benchmarkTeam("pal"), seed);
  publish();
  if (!manual) startAuto();
}

// The default browser benchmark is animated, while `?manual=1` uses this
// message bridge for deterministic Playwright input bursts.
onmessage = ({
  data,
}: MessageEvent<{ type?: string; ms?: number; manual?: boolean; seed?: string }>) => {
  if (data.type === "init") {
    initialize(data.seed?.trim().slice(0, 96) || "graphics-high-v1", data.manual === true);
    return;
  }
  if (data.type === "manual") {
    manualMode = data.manual === true;
    if (data.manual) stopAuto();
    else startAuto();
  }
  if (data.type === "advance") advance(Math.max(1, data.ms ?? 1000 / 60));
};
