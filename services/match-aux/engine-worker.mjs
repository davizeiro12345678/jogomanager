import { parentPort } from "node:worker_threads";
import { simulateAuthoritativeRoom } from "./engine.mjs";

if (!parentPort) throw Error("engine_worker_must_run_in_worker_thread");

parentPort.on("message", async (job) => {
  try {
    const result = await simulateAuthoritativeRoom(job.homeClub, job.awayClub, job.seed);
    parentPort.postMessage({ id: job.id, result });
  } catch {
    parentPort.postMessage({ id: job.id, error: "simulation_failed" });
  }
});
