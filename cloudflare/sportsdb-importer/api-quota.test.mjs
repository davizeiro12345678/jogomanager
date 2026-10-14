import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import {
  pauseSportsDbImporter,
  pruneSportsDbApiRequests,
  readSportsDbPause,
  reserveSportsDbApiRequest,
  retryAtFromResponse,
} from "./api-quota.mjs";
import Worker from "./index.js";

class SqliteD1 {
  constructor() {
    this.db = new DatabaseSync(":memory:");
    this.db.exec(`
      CREATE TABLE sportsdb_api_request_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        requested_at_ms INTEGER NOT NULL,
        response_status INTEGER,
        source_log_id INTEGER,
        attempt_no INTEGER,
        UNIQUE (source_log_id, attempt_no)
      );
      CREATE TABLE sportsdb_import_state (
        phase TEXT PRIMARY KEY,
        offset_val INTEGER,
        last_error TEXT,
        updated_at TEXT DEFAULT (datetime('now'))
      );
    `);
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
      async all() {
        return { results: db.prepare(sql).all(...this.args) };
      },
    };
  }

  async batch(statements) {
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

test("reserves exactly 450 requests in a rolling minute", async () => {
  const db = new SqliteD1();
  const now = Date.now();
  const seed = db.db.prepare("INSERT INTO sportsdb_api_request_log(requested_at_ms) VALUES (?)");
  db.db.exec("BEGIN");
  for (let i = 0; i < 449; i++) seed.run(now - 1_000);
  db.db.exec("COMMIT");

  await reserveSportsDbApiRequest(db, now);
  await assert.rejects(reserveSportsDbApiRequest(db, now), (error) => {
    assert.equal(error.code, "SPORTSDB_QUOTA");
    assert.ok(error.retryAt > now);
    return true;
  });
  db.close();
});

test("reserves exactly 75,000 requests in a rolling 24-hour window", async () => {
  const db = new SqliteD1();
  const now = Date.now();
  const seed = db.db.prepare("INSERT INTO sportsdb_api_request_log(requested_at_ms) VALUES (?)");
  db.db.exec("BEGIN");
  for (let i = 0; i < 74_999; i++) seed.run(now - 120_000 - i);
  db.db.exec("COMMIT");

  await reserveSportsDbApiRequest(db, now);
  await assert.rejects(reserveSportsDbApiRequest(db, now), (error) => {
    assert.equal(error.code, "SPORTSDB_QUOTA");
    assert.ok(error.retryAt >= now + 23 * 60 * 60 * 1000);
    return true;
  });
  db.close();
});

test("ignores requests outside the rolling window and prunes expired rows", async () => {
  const db = new SqliteD1();
  const now = Date.now();
  db.db
    .prepare("INSERT INTO sportsdb_api_request_log(requested_at_ms) VALUES (?)")
    .run(now - 86_400_001);

  await reserveSportsDbApiRequest(db, now);
  await pruneSportsDbApiRequests(db, now);
  const count = db.db.prepare("SELECT COUNT(*) AS count FROM sportsdb_api_request_log").get();
  assert.equal(count.count, 1);
  db.close();
});

test("pauses until retry time, then clears the stale pause", async () => {
  const db = new SqliteD1();
  const now = Date.now();
  const retryAt = now + 90_000;

  await pauseSportsDbImporter(db, "TheSportsDB returned HTTP 429", retryAt);
  assert.equal((await readSportsDbPause(db, now))?.retryAt, retryAt);
  assert.equal(await readSportsDbPause(db, retryAt), null);
  const row = await db.prepare("SELECT phase FROM sportsdb_import_state").first();
  assert.equal(row, null);
  db.close();
});

test("honors Retry-After without retrying sooner than one minute", () => {
  const now = Date.now();
  assert.equal(retryAtFromResponse("30", now, 900_000), now + 60_000);
  assert.equal(retryAtFromResponse("3600", now, 900_000), now + 3_600_000);
  assert.equal(retryAtFromResponse("", now, 300_000), now + 300_000);
});

test("imports with the configured key and records actual provider responses", async () => {
  const db = new SqliteD1();
  const originalFetch = globalThis.fetch;
  const requestedUrls = [];
  globalThis.fetch = async (input) => {
    requestedUrls.push(String(input));
    return Response.json({
      leagues: [{ idLeague: "100", strLeague: "Liga de teste", strSport: "Soccer" }],
    });
  };

  try {
    const response = await Worker.fetch(
      new Request("https://worker.test/import/leagues?secret=import-token"),
      {
        SPORTS_DB: db,
        THESPORTSDB_API_KEY: "configured-provider-key",
        THESPORTSDB_IMPORT_SECRET: "import-token",
      },
      {},
    );
    assert.equal(response.status, 200, await response.clone().text());
    assert.match(requestedUrls[0], /\/configured-provider-key\/all_leagues\.php$/);
    assert.doesNotMatch(requestedUrls[0], /\/3\/all_leagues/);
    const request = db.db
      .prepare("SELECT requested_at_ms, response_status FROM sportsdb_api_request_log")
      .get();
    assert.equal(request.response_status, 200);
  } finally {
    globalThis.fetch = originalFetch;
    db.close();
  }
});

test("stops on an upstream 429 and does not make another request while paused", async () => {
  const db = new SqliteD1();
  const originalFetch = globalThis.fetch;
  let attempts = 0;
  globalThis.fetch = async () => {
    attempts++;
    return new Response("rate limited", { status: 429, headers: { "Retry-After": "600" } });
  };
  const env = {
    SPORTS_DB: db,
    THESPORTSDB_API_KEY: "configured-provider-key",
    THESPORTSDB_IMPORT_SECRET: "import-token",
  };
  const request = () => new Request("https://worker.test/import/leagues?secret=import-token");

  try {
    const first = await Worker.fetch(request(), env, {});
    assert.equal(first.status, 503);
    const second = await Worker.fetch(request(), env, {});
    assert.equal(second.status, 503);
    assert.equal(attempts, 1);
    const pause = await readSportsDbPause(db);
    assert.ok(pause?.retryAt > Date.now());
  } finally {
    globalThis.fetch = originalFetch;
    db.close();
  }
});

test("status is active only with recent provider success and cursor progress", async () => {
  const db = new SqliteD1();
  const env = {
    SPORTS_DB: db,
    THESPORTSDB_API_KEY: "configured-provider-key",
    THESPORTSDB_IMPORT_SECRET: "import-token",
  };
  const status = async () => Worker.fetch(new Request("https://worker.test/api/status"), env, {});

  try {
    await Worker.fetch(new Request("https://worker.test/init?secret=import-token"), env, {});
    const now = Date.now();
    await db
      .prepare(
        "INSERT INTO sportsdb_api_request_log(requested_at_ms,response_status) VALUES (?,200)",
      )
      .bind(now)
      .run();
    await db
      .prepare(
        "INSERT INTO sportsdb_import_state(phase,offset_val,updated_at) VALUES ('teams',5,datetime('now'))",
      )
      .run();

    const active = await (await status()).json();
    assert.equal(active.importer.status, "active");
    assert.equal(active.importer.api_requests.limit_per_minute, 450);
    assert.equal(active.importer.api_requests.limit_per_24_hours, 75_000);

    await db
      .prepare("UPDATE sportsdb_api_request_log SET requested_at_ms=?")
      .bind(now - 11 * 60_000)
      .run();
    await db
      .prepare(
        "UPDATE sportsdb_import_state SET updated_at=datetime('now','-11 minutes') WHERE phase='teams'",
      )
      .run();
    const stalled = await (await status()).json();
    assert.equal(stalled.importer.status, "stalled");
  } finally {
    db.close();
  }
});
