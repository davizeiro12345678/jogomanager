import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { Worker } from "node:worker_threads";

import {
  hashPublicClientKey,
  PUBLIC_RATE_LIMIT,
  PUBLIC_RATE_SCHEMA_SQL,
  reservePublicRequest,
} from "./public-rate-limit.mjs";

function fakeD1() {
  const requests = [];
  return {
    requests,
    async batch() {
      return [];
    },
    prepare(sql) {
      const statement = {
        args: [],
        bind(...args) {
          this.args = args;
          return this;
        },
        async run() {
          if (sql.startsWith("DELETE FROM sportsdb_public_request_log")) {
            const [now, windowMs] = this.args;
            const before = requests.length;
            for (let index = requests.length - 1; index >= 0; index -= 1) {
              if (requests[index].requestedAtMs <= now - windowMs) requests.splice(index, 1);
            }
            return { meta: { changes: before - requests.length } };
          }
          if (sql.startsWith("INSERT INTO sportsdb_public_request_log")) {
            const [clientKey, now, queriedKey, queriedNow, windowMs, limit] = this.args;
            const count = requests.filter(
              (request) =>
                request.clientKey === queriedKey && request.requestedAtMs > queriedNow - windowMs,
            ).length;
            if (count >= limit) return { meta: { changes: 0 } };
            requests.push({ clientKey, requestedAtMs: now });
            return { meta: { changes: 1 } };
          }
          throw new Error(`Unexpected D1 run query: ${sql}`);
        },
        async first() {
          if (!sql.includes("FROM sportsdb_public_request_log")) {
            throw new Error(`Unexpected D1 first query: ${sql}`);
          }
          const [clientKey, now, windowMs] = this.args;
          const matching = requests
            .filter(
              (request) =>
                request.clientKey === clientKey && request.requestedAtMs > now - windowMs,
            )
            .sort((left, right) => left.requestedAtMs - right.requestedAtMs);
          return {
            request_count: matching.length,
            oldest_at_ms: matching[0]?.requestedAtMs ?? null,
          };
        },
      };
      return statement;
    },
  };
}

class SqliteRateD1 {
  constructor() {
    this.db = new DatabaseSync(":memory:", { timeout: 10_000 });
    this.batchCalls = 0;
  }

  prepare(sql) {
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
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  close() {
    this.db.close();
  }
}

function runConcurrentWorker(workerData) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL("./public-rate-limit.concurrent-worker.mjs", import.meta.url),
      {
        workerData,
      },
    );
    let message;
    worker.once("message", (value) => {
      message = value;
    });
    worker.once("error", reject);
    worker.once("exit", (code) => {
      if (code !== 0) reject(new Error(`Concurrent worker exited with code ${code}`));
      else if (message === undefined) reject(new Error("Concurrent worker returned no result"));
      else resolve(message);
    });
  });
}

const KEY_A = "a".repeat(64);

test("HMACs the trusted edge IP without storing the address in the client key", async () => {
  const request = new Request("https://worker.test/api/leagues", {
    headers: { "CF-Connecting-IP": "198.51.100.44" },
  });
  const key = await hashPublicClientKey(request, "test-import-secret");
  const same = await hashPublicClientKey(request, "test-import-secret");
  const differentSecret = await hashPublicClientKey(request, "other-test-secret");

  assert.equal(key.length, 64);
  assert.equal(key, same);
  assert.notEqual(key, differentSecret);
  assert.doesNotMatch(key, /198\.51\.100\.44/);
  await assert.rejects(() => hashPublicClientKey(request, ""), /not configured/);
});

test("creates its D1 schema and enforces the exact cap with SQLite", async () => {
  const db = new SqliteRateD1();
  const now = 2_500_000;
  try {
    const results = await Promise.all(
      Array.from({ length: 180 }, (_, index) => reservePublicRequest(db, KEY_A, now + index)),
    );
    assert.equal(results.filter((result) => result.allowed).length, PUBLIC_RATE_LIMIT);
    assert.equal(results.filter((result) => !result.allowed).length, 180 - PUBLIC_RATE_LIMIT);
    const stored = db.db.prepare("SELECT COUNT(*) AS count FROM sportsdb_public_request_log").get();
    assert.equal(stored.count, PUBLIC_RATE_LIMIT);
    const indexes = db.db
      .prepare(
        "SELECT COUNT(*) AS count FROM sqlite_master WHERE type='index' AND name LIKE 'idx_public_request_log_%'",
      )
      .get();
    assert.equal(indexes.count, 2);
  } finally {
    db.close();
  }
});

test("enforces a 120-request rolling minute and reports the next retry time", async () => {
  const db = fakeD1();
  const now = 1_000_000;

  for (let index = 0; index < PUBLIC_RATE_LIMIT; index += 1) {
    const result = await reservePublicRequest(db, KEY_A, now + index);
    assert.equal(result.allowed, true);
  }

  const blocked = await reservePublicRequest(db, KEY_A, now + PUBLIC_RATE_LIMIT);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.remaining, 0);
  assert.equal(blocked.retryAfter, 60);

  const afterWindow = await reservePublicRequest(db, KEY_A, now + 60_001);
  assert.equal(afterWindow.allowed, true);
});

test("keeps the deterministic fake-D1 cap while the SQLite worker test proves connection concurrency", async () => {
  const db = fakeD1();
  const now = 2_000_000;
  const results = await Promise.all(
    Array.from({ length: 240 }, (_, index) => reservePublicRequest(db, KEY_A, now + index)),
  );

  assert.equal(results.filter((result) => result.allowed).length, PUBLIC_RATE_LIMIT);
  assert.equal(results.filter((result) => !result.allowed).length, 240 - PUBLIC_RATE_LIMIT);
  assert.equal(db.requests.length, PUBLIC_RATE_LIMIT);
});

test("enforces exactly 120 allows across 240 requests and two SQLite worker connections", async () => {
  const directory = mkdtempSync(join(tmpdir(), "sportsdb-public-rate-"));
  const databasePath = join(directory, "rate-limit.sqlite");
  const initializer = new DatabaseSync(databasePath, { timeout: 10_000 });
  for (const sql of PUBLIC_RATE_SCHEMA_SQL) initializer.exec(sql);
  initializer.close();

  const barrier = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT);
  const workerData = {
    barrier,
    clientKey: KEY_A,
    databasePath,
    now: 4_000_000,
    requestCount: 120,
    workerCount: 2,
  };
  try {
    const messages = await Promise.all([
      runConcurrentWorker(workerData),
      runConcurrentWorker(workerData),
    ]);
    const results = messages.flatMap((message) => message.results);

    assert.equal(results.length, 240);
    assert.equal(results.filter((result) => result.allowed).length, PUBLIC_RATE_LIMIT);
    assert.equal(results.filter((result) => !result.allowed).length, 240 - PUBLIC_RATE_LIMIT);
    assert.ok(messages.every((message) => message.usedWrappers.every(Boolean)));
    assert.ok(messages.every((message) => message.batchCalls[0] === 1));
    assert.ok(messages.every((message) => message.batchCalls[1] === 1));

    const verifier = new DatabaseSync(databasePath, { timeout: 10_000 });
    try {
      const stored = verifier
        .prepare("SELECT COUNT(*) AS count FROM sportsdb_public_request_log WHERE client_key=?")
        .get(KEY_A);
      assert.equal(stored.count, PUBLIC_RATE_LIMIT);
    } finally {
      verifier.close();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("keeps independent client keys on separate rolling windows", async () => {
  const db = fakeD1();
  const now = 3_000_000;
  for (let index = 0; index < PUBLIC_RATE_LIMIT; index += 1) {
    await reservePublicRequest(db, KEY_A, now);
  }

  const otherClient = await reservePublicRequest(db, "b".repeat(64), now);
  const blockedClient = await reservePublicRequest(db, KEY_A, now);

  assert.equal(otherClient.allowed, true);
  assert.equal(blockedClient.allowed, false);
});

test("keeps schema and prune state independent for distinct D1 bindings", async () => {
  const firstDb = new SqliteRateD1();
  const secondDb = new SqliteRateD1();
  const now = Date.now();
  try {
    for (const sql of PUBLIC_RATE_SCHEMA_SQL) secondDb.db.exec(sql);
    secondDb.db
      .prepare(
        "INSERT INTO sportsdb_public_request_log (client_key, requested_at_ms) VALUES (?, ?)",
      )
      .run(KEY_A, now - 60_001);

    await reservePublicRequest(firstDb, KEY_A, now);
    const result = await reservePublicRequest(secondDb, KEY_A, now + 1);

    assert.equal(result.allowed, true);
    assert.equal(secondDb.batchCalls, 1);
    const stored = secondDb.db
      .prepare("SELECT COUNT(*) AS count FROM sportsdb_public_request_log WHERE client_key=?")
      .get(KEY_A);
    assert.equal(stored.count, 1);
  } finally {
    firstDb.close();
    secondDb.close();
  }
});
