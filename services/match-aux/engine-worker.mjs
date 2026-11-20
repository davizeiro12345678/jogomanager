import { parentPort } from "node:worker_threads";
import { simulateAuthoritativeRoom } from "./engine.mjs";

parentPort.on("message", async ({ homeClub, awayClub, seed }) => {
  try {
    parentPort.postMessage({ result: await simulateAuthoritativeRoom(homeClub, awayClub, seed) });
  } catch (error) {
    parentPort.postMessage({ error: error instanceof Error ? error.message : "simulation_failed" });
  }
});
