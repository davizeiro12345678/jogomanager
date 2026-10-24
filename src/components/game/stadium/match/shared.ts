import type { SimView } from "@/game/sim-types";
export type Quality = "alta" | "media" | "baixa";
/** Presentation pose only; canonical ball physics stays in the Worker. */
export function presentationBall(sim: SimView) {
  return sim.visualBall ?? sim.ball;
}
