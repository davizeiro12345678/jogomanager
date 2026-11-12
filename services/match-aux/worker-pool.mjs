import { Worker } from "node:worker_threads";

export class PoolBusyError extends Error {
  constructor() {
    super("match_pool_busy");
    this.name = "PoolBusyError";
  }
}

/**
 * Bounded worker-thread executor. The HTTP server retains exclusive ownership
 * of SQLite, HMAC verification and settlement; workers only simulate.
 */
export class MatchWorkerPool {
  constructor({
    size = 2,
    maxQueue = 8,
    timeoutMs = 18_000,
    workerUrl = new URL("./engine-worker.mjs", import.meta.url),
  } = {}) {
    if (!Number.isInteger(size) || size < 1 || size > 8) throw Error("invalid_pool_size");
    if (!Number.isInteger(maxQueue) || maxQueue < 0 || maxQueue > 128)
      throw Error("invalid_queue_size");
    this.size = size;
    this.maxQueue = maxQueue;
    this.timeoutMs = timeoutMs;
    this.workerUrl = workerUrl;
    this.queue = [];
    this.slots = Array.from({ length: size }, () => ({ worker: null, active: null }));
    this.closed = false;
    this.nextId = 0;
    for (const slot of this.slots) this.spawn(slot);
  }

  get activeCount() {
    return this.slots.filter((slot) => slot.active !== null).length;
  }

  get queuedCount() {
    return this.queue.length;
  }

  spawn(slot) {
    if (this.closed) return;
    const worker = new Worker(this.workerUrl, { execArgv: process.execArgv });
    slot.worker = worker;
    slot.active = null;
    const fail = (reason) => {
      if (slot.worker !== worker) return;
      const job = slot.active;
      slot.active = null;
      if (job) {
        clearTimeout(job.timer);
        job.reject(reason instanceof Error ? reason : Error("worker_failed"));
      }
    };
    worker.on("message", (message) => {
      const job = slot.active;
      if (slot.worker !== worker || !job || message?.id !== job.id) return;
      clearTimeout(job.timer);
      slot.active = null;
      if (message.error) job.reject(Error("simulation_failed"));
      else job.resolve(message.result);
      this.dispatch();
    });
    worker.on("error", fail);
    worker.on("exit", (code) => {
      fail(Error("worker_exit_" + code));
      if (slot.worker === worker) slot.worker = null;
      if (!this.closed) {
        this.spawn(slot);
        this.dispatch();
      }
    });
    this.dispatch();
  }

  run(input) {
    if (this.closed) return Promise.reject(Error("pool_closed"));
    const free = this.slots.some((slot) => slot.worker && !slot.active);
    if (!free && this.queue.length >= this.maxQueue) {
      return Promise.reject(new PoolBusyError());
    }
    return new Promise((resolve, reject) => {
      this.queue.push({ id: ++this.nextId, input, resolve, reject, timer: null });
      this.dispatch();
    });
  }

  dispatch() {
    if (this.closed) return;
    for (const slot of this.slots) {
      if (!slot.worker || slot.active || !this.queue.length) continue;
      const job = this.queue.shift();
      slot.active = job;
      job.timer = setTimeout(() => {
        if (slot.active !== job) return;
        slot.active = null;
        job.reject(Error("simulation_timeout"));
        // Termination causes the exit handler to start a replacement worker.
        void slot.worker.terminate();
      }, this.timeoutMs);
      job.timer.unref?.();
      try {
        slot.worker.postMessage({ id: job.id, ...job.input });
      } catch (error) {
        clearTimeout(job.timer);
        slot.active = null;
        job.reject(error);
      }
    }
  }

  async close() {
    this.closed = true;
    for (const job of this.queue.splice(0)) job.reject(Error("pool_closed"));
    const pending = [];
    for (const slot of this.slots) {
      if (slot.active) {
        clearTimeout(slot.active.timer);
        slot.active.reject(Error("pool_closed"));
        slot.active = null;
      }
      if (slot.worker) pending.push(slot.worker.terminate());
    }
    await Promise.allSettled(pending);
  }
}
