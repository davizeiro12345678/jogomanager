import { MatchSim } from "../src/game/sim";
import { snapshotMatch } from "../src/game/live-match";
import { benchmarkTeam } from "./graphics-fixture";

let sim: MatchSim | null = null;
let seq = 0;
let auto: ReturnType<typeof setInterval> | undefined;

function advance(ms: number) {
  if (!sim) return;
  // Fixed simulation steps keep the match sequence independent from render FPS.
  const steps = Math.max(1, Math.round(ms / (1000 / 30)));
  for (let i = 0; i < steps; i++) sim.step(1 / 30, 6);
  postMessage(snapshotMatch(sim, ++seq));
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
  sim = new MatchSim(benchmarkTeam("fla"), benchmarkTeam("pal"), seed);
  postMessage(snapshotMatch(sim, ++seq));
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
    if (data.manual) stopAuto();
    else startAuto();
  }
  if (data.type === "advance") advance(Math.max(1, data.ms ?? 1000 / 60));
};
