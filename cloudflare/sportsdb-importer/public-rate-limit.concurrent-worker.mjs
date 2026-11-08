import { DatabaseSync } from "node:sqlite";
import { parentPort, workerData } from "node:worker_threads";

import { reservePublicRequest } from "./public-rate-limit.mjs";

class SqliteD1 {
  constructor(db) {
    this.db = db;
    this.prepareCalls = 0;
    this.batchCalls = 0;
  }

  prepare(sql) {
    this.prepareCalls += 1;
    const db = this.db;
    return {
      args: [],
      bind(...args) {
        this.args = args;
        return this;
      },
      async run() {
        const result = db.prepare(sql).run(...this.args);
        return {
          meta: {
            changes: Number(result.changes),
            last_row_id: Number(result.lastInsertRowid),
          },
        };
      },
      async first() {
        return db.prepare(sql).get(...this.args) ?? null;
      },
    };
  }

  async batch(statements) {
    this.batchCalls += 1;
    this.db.exec("BEGIN");
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      this.db.exec("COMMIT");
      return results;
    } catch (error) {
      try {
        this.db.exec("ROLLBACK");
      } catch {}
      throw error;
    }
  }
}

const backend = new DatabaseSync(workerData.databasePath, { timeout: 10_000 });
const wrappers = [new SqliteD1(backend), new SqliteD1(backend)];
const barrier = new Int32Array(workerData.barrier);

// The parent creates the schema first. Warm each wrapper sequentially so this
// fixture does not open two DDL transactions on the same local connection;
// the actual reservation wave still runs concurrently across worker
// connections, and each binding verifies its own idempotent schema path.
for (const wrapper of wrappers) {
  await reservePublicRequest(wrapper, "b".repeat(64), workerData.now);
}
Atomics.add(barrier, 0, 1);
Atomics.notify(barrier, 0);
while (Atomics.load(barrier, 0) < workerData.workerCount) Atomics.wait(barrier, 0, 1);

const results = await Promise.all(
  Array.from({ length: workerData.requestCount }, (_, index) =>
    reservePublicRequest(wrappers[index % wrappers.length], workerData.clientKey, workerData.now),
  ),
);

parentPort.postMessage({
  results,
  batchCalls: wrappers.map((wrapper) => wrapper.batchCalls),
  usedWrappers: wrappers.map((wrapper) => wrapper.prepareCalls > 0),
});
backend.close();
