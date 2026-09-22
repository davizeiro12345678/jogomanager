import { MatchSim } from "../src/game/sim";
import { snapshotMatch } from "../src/game/live-match";
import { benchmarkTeam } from "./graphics-fixture";
const sim = new MatchSim(benchmarkTeam("fla"), benchmarkTeam("pal"), "graphics-high-v1");
let seq = 0;

function advance(ms: number) {
  // Fixed simulation steps keep the match sequence independent from render FPS.
  const steps = Math.max(1, Math.round(ms / (1000 / 30)));
  for (let i = 0; i < steps; i++) sim.step(1 / 30, 6);
  postMessage(snapshotMatch(sim, ++seq));
}

// The default browser benchmark is animated, while `?manual=1` uses this
// message bridge for deterministic Playwright input bursts.
let auto: number | undefined = setInterval(() => advance(100), 100) as unknown as number;
postMessage(snapshotMatch(sim, ++seq));
onmessage = ({ data }: MessageEvent<{ type?: string; ms?: number; manual?: boolean }>) => {
  if (data.type === "manual") {
    if (data.manual && auto !== undefined) { clearInterval(auto); auto = undefined; }
    if (!data.manual && auto === undefined) auto = setInterval(() => advance(100), 100) as unknown as number;
  }
  if (data.type === "advance") advance(Math.max(1, data.ms ?? 1000 / 60));
};
