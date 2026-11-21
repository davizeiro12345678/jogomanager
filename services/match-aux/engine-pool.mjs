import { availableParallelism, totalmem } from "node:os";
import process from "node:process";
import { Worker } from "node:worker_threads";

const MAX_WORKERS = 512;
const MIB = 1024 * 1024;
const PROCESS_RESERVE = 128 * MIB;
const MEMORY_PER_WORKER = 96 * MIB;

export function matchSimulationCapacity(
  configured = process.env.MATCH_AUX_WORKERS,
  logicalCpus = availableParallelism(),
  memoryBytes = Math.min(process.constrainedMemory() || Infinity, totalmem()),
) {
  const requested =
    configured === undefined ? Math.min(8, Math.max(1, logicalCpus - 1)) : Number(configured);
  if (!Number.isSafeInteger(requested) || requested < 1 || requested > MAX_WORKERS)
    throw new RangeError("MATCH_AUX_WORKERS must be an integer between 1 and 512");
  const memoryCapacity = Math.max(
    1,
    Math.floor((memoryBytes - PROCESS_RESERVE) / MEMORY_PER_WORKER),
  );
  return Math.min(requested, logicalCpus, memoryCapacity);
}

/** One canonical match per lane. Workers are started on demand and reused. */
export function createMatchSimulationPool(size, { timeoutMs = 15_000 } = {}) {
  const lanes = new Set();
  let closed = false;

  function retire(lane, reason) {
    const job = lane.job;
    lane.job = null;
    if (job) {
      clearTimeout(job.timer);
      job.reject(reason);
    }
    // Keep a retiring lane counted until its OS thread exits.
    lane.stopping ??= lane.worker
      .terminate()
      .catch(() => undefined)
      .finally(() => lanes.delete(lane));
    return lane.stopping;
  }

  function createLane() {
    const worker = new Worker(new URL("./engine-worker.mjs", import.meta.url), {
      env: { NODE_ENV: process.env.NODE_ENV ?? "production" },
    });
    const lane = { worker, job: null, stopping: null };
    lanes.add(lane);
    worker.on("message", ({ result, error }) => {
      const job = lane.job;
      if (!job) return;
      clearTimeout(job.timer);
      lane.job = null;
      if (error) job.reject(new Error(error));
      else job.resolve(result);
    });
    worker.on("error", (error) => void retire(lane, error));
    worker.on("messageerror", (error) => void retire(lane, error));
    worker.once("exit", () => {
      lanes.delete(lane);
      if (!lane.job) return;
      clearTimeout(lane.job.timer);
      lane.job.reject(new Error("simulation_worker_exited"));
      lane.job = null;
    });
    return lane;
  }

  return {
    async run(homeClub, awayClub, seed) {
      if (closed) throw new Error("simulation_pool_closed");
      let lane;
      for (const existing of lanes) {
        if (existing.job || existing.stopping) continue;
        lane = existing;
        break;
      }
      if (!lane) {
        if (lanes.size >= size) throw new Error("simulation_pool_busy");
        lane = createLane();
      }
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          void retire(lane, new Error("simulation_worker_timeout"));
        }, timeoutMs);
        lane.job = { resolve, reject, timer };
        try {
          lane.worker.postMessage({ homeClub, awayClub, seed });
        } catch (error) {
          void retire(lane, error);
        }
      });
    },
    async close() {
      closed = true;
      await Promise.allSettled(
        Array.from(lanes, (lane) => retire(lane, new Error("simulation_pool_closed"))),
      );
    },
  };
}
