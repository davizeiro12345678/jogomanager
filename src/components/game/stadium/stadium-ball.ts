import type { SimView } from "@/game/sim-contracts";

export function presentationBall(sim: SimView) {
  return sim.visualBall ?? sim.ball;
}
