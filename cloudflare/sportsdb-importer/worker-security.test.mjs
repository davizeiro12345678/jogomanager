import assert from "node:assert/strict";
import test from "node:test";

import Worker from "./index.js";
import { PUBLIC_RATE_SCHEMA_SQL } from "./public-rate-limit.mjs";

const IMPORT_SECRET = "test-import-secret";

function env(overrides = {}) {
  return {
    SPORTS_DB: catalogDb([]),
    THESPORTSDB_API_KEY: "test-provider-key",
    THESPORTSDB_IMPORT_SECRET: IMPORT_SECRET,
    ...overrides,
  };
}

function request(path, init = {}) {
  return new Request(`https://worker.test${path}`, init);
}

function catalogBackend(rows, options = {}) {
  return {
    rows,
    queries: [],
    batches: [],
    publicRequests: [],
    publicSchemaAttempts: 0,
    publicSchemaReleased: false,
    pauseReads: 0,
    publicCleanupAttempts: 0,
    publicCleanupStarted: false,
    publicCleanupSettled: false,
    ...options,
  };
}

function catalogDb(rows, backend = catalogBackend(rows)) {
  return {
    backend,
    queries: backend.queries,
    publicRequests: backend.publicRequests,
    async batch(statements) {
      backend.batches.push(statements.map((statement) => statement.sql));
      if (backend.failBatch) throw new Error("fixture D1 batch failure");
      const isPublicRateSchemaBatch =
        statements.length === PUBLIC_RATE_SCHEMA_SQL.length &&
        statements.every((statement) => PUBLIC_RATE_SCHEMA_SQL.includes(statement.sql));
      if (isPublicRateSchemaBatch) {
        backend.publicSchemaAttempts += 1;
        if (backend.pendingPublicSchema) {
          return new Promise((resolve) => {
            backend.releasePublicSchema = () => {
              backend.publicSchemaReleased = true;
              resolve([]);
            };
          });
        }
      }
      return [];
    },
    prepare(sql) {
      const statement = {
        sql,
        args: [],
        bind(...args) {
          this.args = args;
          return this;
        },
        async all() {
          return {
            results: backend.rows.map(
              ({ imported_at: _internalTimestamp, ...publicRow }) => publicRow,
            ),
          };
        },
        async first() {
          if (sql.includes("FROM sportsdb_public_request_log")) {
            if (backend.failPublicRead) throw new Error("fixture public usage read failure");
            const [clientKey, now, windowMs] = this.args;
            const matching = backend.publicRequests
              .filter((row) => row.clientKey === clientKey && row.requestedAtMs > now - windowMs)
              .sort((left, right) => left.requestedAtMs - right.requestedAtMs);
            return {
              request_count: matching.length,
              oldest_at_ms: matching[0]?.requestedAtMs ?? null,
            };
          }
          if (sql.includes("phase = '__paused__'")) {
            backend.pauseReads += 1;
            if (backend.failPauseRead) throw new Error("fixture pause read failure");
            return backend.pauseRow ?? null;
          }
          return backend.rows[0] ?? null;
        },
        async run() {
          if (sql.startsWith("DELETE FROM sportsdb_public_request_log")) {
            backend.publicCleanupAttempts += 1;
            backend.publicCleanupStarted = true;
            backend.onPublicCleanupStart?.();
            if (backend.failPublicCleanup) throw new Error("fixture public cleanup failure");
            if (backend.pendingPublicCleanup) {
              return new Promise((resolve) => {
                backend.releasePublicCleanup = () => {
                  backend.publicCleanupSettled = true;
                  resolve({ meta: { changes: 0 } });
                };
              });
            }
            const [now, windowMs] = this.args;
            const before = backend.publicRequests.length;
            for (let index = backend.publicRequests.length - 1; index >= 0; index -= 1) {
              if (backend.publicRequests[index].requestedAtMs <= now - windowMs)
                backend.publicRequests.splice(index, 1);
            }
            return { meta: { changes: before - backend.publicRequests.length } };
          }
          if (sql.startsWith("INSERT INTO sportsdb_public_request_log")) {
            if (backend.failPublicInsert) throw new Error("fixture public reservation failure");
            if (backend.forcePublicReject) return { meta: { changes: 0 } };
            const [clientKey, now, queriedKey, queriedNow, windowMs, limit] = this.args;
            const count = backend.publicRequests.filter(
              (row) => row.clientKey === queriedKey && row.requestedAtMs > queriedNow - windowMs,
            ).length;
            if (count >= limit) return { meta: { changes: 0 } };
            backend.publicRequests.push({ clientKey, requestedAtMs: now });
            return { meta: { changes: 1 } };
          }
          return { meta: { changes: 0 } };
        },
      };
      backend.queries.push(statement);
      return statement;
    },
  };
}

function assertCorsMatches(actual, expected) {
  for (const name of [
    "Access-Control-Allow-Origin",
    "Access-Control-Allow-Methods",
    "Access-Control-Allow-Headers",
  ]) {
    assert.equal(actual.headers.get(name), expected.headers.get(name), name);
  }
}

test("does not accept importer secrets in query strings", async () => {
  const response = await Worker.fetch(request("/init?secret=test-import-secret"), env(), {});

  assert.equal(response.status, 401);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.doesNotMatch(await response.text(), /test-import-secret/);
});

test("accepts Bearer authorization for private importer routes", async () => {
  const response = await Worker.fetch(
    request("/init", {
      headers: { Authorization: `Bearer ${IMPORT_SECRET}` },
    }),
    env(),
    {},
  );

  assert.equal(response.status, 200, await response.clone().text());
  assert.equal(response.headers.get("Cache-Control"), "no-store");
});

test("keeps the legacy importer secret header working without a query secret", async () => {
  const response = await Worker.fetch(
    request("/init", {
      headers: { "X-Import-Secret": IMPORT_SECRET },
    }),
    env(),
    {},
  );

  assert.equal(response.status, 200, await response.clone().text());
  assert.equal(response.headers.get("Cache-Control"), "no-store");
});

test("/init batches the public rate-limit table and both indexes", async () => {
  const backend = catalogBackend([]);
  const response = await Worker.fetch(
    request("/init", { headers: { Authorization: `Bearer ${IMPORT_SECRET}` } }),
    env({ SPORTS_DB: catalogDb([], backend) }),
    {},
  );

  assert.equal(response.status, 200, await response.clone().text());
  assert.equal(backend.batches.length, 1);
  const statements = backend.batches[0].join("\n");
  assert.match(statements, /CREATE TABLE IF NOT EXISTS sportsdb_public_request_log/);
  assert.match(statements, /idx_public_request_log_client_time/);
  assert.match(statements, /idx_public_request_log_time/);
});

test("returns a non-cacheable error when /init D1 batch fails", async () => {
  const response = await Worker.fetch(
    request("/init", { headers: { Authorization: `Bearer ${IMPORT_SECRET}` } }),
    env({ SPORTS_DB: catalogDb([], catalogBackend([], { failBatch: true })) }),
    {},
  );

  assert.equal(response.status, 500);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
});

test("fails closed with 503 when public limiter schema batch fails", async () => {
  const response = await Worker.fetch(
    request("/api/leagues", { headers: { "CF-Connecting-IP": "198.51.100.25" } }),
    env({ SPORTS_DB: catalogDb([], catalogBackend([], { failBatch: true })) }),
    {},
  );

  assert.equal(response.status, 503);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "*");
});

test("fails closed with 503 when public reservation insert fails", async () => {
  const response = await Worker.fetch(
    request("/api/leagues", { headers: { "CF-Connecting-IP": "198.51.100.26" } }),
    env({ SPORTS_DB: catalogDb([], catalogBackend([], { failPublicInsert: true })) }),
    {},
  );

  assert.equal(response.status, 503);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
});

test("fails closed with 503 when rejected-request usage read fails", async () => {
  const backend = catalogBackend([], { failPublicRead: true, forcePublicReject: true });
  const response = await Worker.fetch(
    request("/api/leagues", { headers: { "CF-Connecting-IP": "198.51.100.27" } }),
    env({ SPORTS_DB: catalogDb([], backend) }),
    {},
  );

  assert.equal(response.status, 503);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
});

test("requires authorization for operational status", async () => {
  const unauthenticated = await Worker.fetch(request("/api/status"), env(), {});
  const querySecret = await Worker.fetch(
    request("/api/status?secret=test-import-secret"),
    env(),
    {},
  );

  assert.equal(unauthenticated.status, 401);
  assert.equal(querySecret.status, 401);
  assert.equal(unauthenticated.headers.get("Cache-Control"), "no-store");
  assert.equal(querySecret.headers.get("Cache-Control"), "no-store");
});

test("uses the same CORS contract for preflight and public responses", async () => {
  const preflight = await Worker.fetch(
    request("/api/leagues", {
      method: "OPTIONS",
      headers: {
        Origin: "https://client.example",
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "content-type",
      },
    }),
    env(),
    {},
  );
  const publicResponse = await Worker.fetch(request("/api/leagues"), env(), {});

  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("Cache-Control"), "no-store");
  assert.equal(preflight.headers.get("Access-Control-Allow-Origin"), "*");
  assert.equal(preflight.headers.get("Access-Control-Allow-Methods"), "GET, OPTIONS");
  assert.equal(preflight.headers.get("Access-Control-Allow-Headers"), "Content-Type");
  assertCorsMatches(preflight, publicResponse);
});

test("fails closed when the public limiter has no HMAC secret", async () => {
  const response = await Worker.fetch(
    request("/api/leagues", { headers: { "CF-Connecting-IP": "198.51.100.24" } }),
    env({ THESPORTSDB_IMPORT_SECRET: "" }),
    {},
  );

  assert.equal(response.status, 503);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "*");
});

test("projects public catalog fields and paginates with a stable cursor", async () => {
  const database = catalogDb([
    { idLeague: 10, strLeague: "Alpha", imported_at: "internal-only" },
    { idLeague: 20, strLeague: "Beta", imported_at: "internal-only" },
  ]);
  const clientIp = "198.51.100.21";
  const response = await Worker.fetch(
    request("/api/leagues?limit=1", { headers: { "CF-Connecting-IP": clientIp } }),
    env({ SPORTS_DB: database }),
    {},
  );

  assert.equal(response.status, 200, await response.clone().text());
  assert.equal(response.headers.get("Cache-Control"), "public, max-age=60");
  assert.equal(response.headers.get("X-Page-Limit"), "1");
  assert.equal(response.headers.get("X-Page-Count"), "1");
  assert.ok(response.headers.get("X-Next-Cursor"));
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "*");
  const body = await response.json();
  assert.deepEqual(body, [{ idLeague: 10, strLeague: "Alpha" }]);
  const catalogQueries = () =>
    database.queries.filter((query) => query.sql.includes("FROM sportsdb_leagues"));
  assert.doesNotMatch(catalogQueries()[0].sql, /SELECT \*/i);
  assert.doesNotMatch(catalogQueries()[0].sql, /imported_at/i);
  assert.equal(catalogQueries()[0].args.at(-1), 2);

  const nextResponse = await Worker.fetch(
    request(
      `/api/leagues?limit=1&cursor=${encodeURIComponent(response.headers.get("X-Next-Cursor"))}`,
      { headers: { "CF-Connecting-IP": clientIp } },
    ),
    env({ SPORTS_DB: database }),
    {},
  );
  assert.equal(nextResponse.status, 200, await nextResponse.clone().text());
  assert.match(catalogQueries()[1].sql, /idLeague > \?/);
  assert.equal(catalogQueries()[1].args.at(-1), 2);
});

test("does not expose CORS on administrative responses", async () => {
  const response = await Worker.fetch(
    request("/api/status", {
      headers: { Authorization: `Bearer ${IMPORT_SECRET}`, Origin: "https://client.example" },
    }),
    env(),
    {},
  );
  const preflight = await Worker.fetch(
    request("/api/status", { method: "OPTIONS", headers: { Origin: "https://client.example" } }),
    env(),
    {},
  );

  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), null);
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("Access-Control-Allow-Origin"), null);
});

test("closes public methods and fixes root cache policy", async () => {
  const method = await Worker.fetch(request("/api/leagues", { method: "POST" }), env(), {});
  const root = await Worker.fetch(request("/"), env(), {});

  assert.equal(method.status, 405);
  assert.equal(method.headers.get("Allow"), "GET, OPTIONS");
  assert.equal(method.headers.get("Cache-Control"), "no-store");
  assert.equal(root.status, 200);
  assert.equal(root.headers.get("Cache-Control"), "no-store");
});

test("rate limits public catalog requests without affecting private routes", async () => {
  const clientIp = "198.51.100.22";
  const environment = env({ SPORTS_DB: catalogDb([]) });
  for (let attempt = 0; attempt < 120; attempt++) {
    await Worker.fetch(
      request("/api/leagues", { headers: { "CF-Connecting-IP": clientIp } }),
      environment,
      {},
    );
  }
  const limited = await Worker.fetch(
    request("/api/leagues", { headers: { "CF-Connecting-IP": clientIp } }),
    environment,
    {},
  );
  const privateResponse = await Worker.fetch(
    request("/init", { headers: { Authorization: `Bearer ${IMPORT_SECRET}` } }),
    environment,
    {},
  );

  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("Retry-After"), "60");
  assert.equal(privateResponse.status, 200);
});

test("shares public rate limits across distinct D1 binding wrappers", async () => {
  const backend = catalogBackend([]);
  const database = catalogDb([], backend);
  const firstEnv = env({ SPORTS_DB: database });
  const secondEnv = env({ SPORTS_DB: catalogDb([], backend) });
  const clientIp = "198.51.100.23";

  for (let attempt = 0; attempt < 60; attempt++) {
    const response = await Worker.fetch(
      request("/api/leagues", { headers: { "CF-Connecting-IP": clientIp } }),
      firstEnv,
      {},
    );
    assert.equal(response.status, 200);
  }
  for (let attempt = 0; attempt < 60; attempt++) {
    const response = await Worker.fetch(
      request("/api/leagues", { headers: { "CF-Connecting-IP": clientIp } }),
      secondEnv,
      {},
    );
    assert.equal(response.status, 200);
  }

  const limited = await Worker.fetch(
    request("/api/leagues", { headers: { "CF-Connecting-IP": clientIp } }),
    firstEnv,
    {},
  );
  assert.equal(limited.status, 429);
});

test("continues iCron when scheduled public-rate cleanup fails", async () => {
  const backend = catalogBackend([], {
    failPublicCleanup: true,
    pauseRow: {
      last_error: `maintenance; retry_after_ms=${Date.now() + 60 * 60 * 1000}`,
      updated_at: "2099-01-01 00:00:00",
    },
  });
  const waits = [];
  await Worker.scheduled({ cron: "*/3 * * * *" }, env({ SPORTS_DB: catalogDb([], backend) }), {
    waitUntil(promise) {
      waits.push(promise);
    },
  });

  assert.equal(waits.length, 2);
  await waits[0];
  await waits[1];
  assert.equal(waits.length, 2);
  assert.equal(backend.publicCleanupAttempts, 1);
  assert.equal(backend.pauseReads, 1);
});

test("does not let pending public schema DDL block scheduled import", async () => {
  const backend = catalogBackend([], {
    pendingPublicSchema: true,
    pauseRow: {
      last_error: `maintenance; retry_after_ms=${Date.now() + 60 * 60 * 1000}`,
      updated_at: "2099-01-01 00:00:00",
    },
  });
  const waits = [];
  await Worker.scheduled({ cron: "*/3 * * * *" }, env({ SPORTS_DB: catalogDb([], backend) }), {
    waitUntil(promise) {
      waits.push(promise);
    },
  });

  assert.equal(waits.length, 2);
  await waits[0];
  await Promise.resolve();
  assert.equal(backend.pauseReads, 1);
  assert.equal(backend.publicSchemaAttempts, 1);
  assert.equal(backend.publicSchemaReleased, false);
  assert.doesNotMatch(backend.batches[0].join("\n"), /sportsdb_public_request_log/);
  assert.deepEqual(backend.batches[1], PUBLIC_RATE_SCHEMA_SQL);

  let cleanupFinishedBeforeRelease = false;
  void waits[1].then(
    () => {
      cleanupFinishedBeforeRelease = true;
    },
    () => {
      cleanupFinishedBeforeRelease = true;
    },
  );
  await new Promise((resolve) => queueMicrotask(resolve));
  assert.equal(cleanupFinishedBeforeRelease, false);

  backend.releasePublicSchema();
  await waits[1];
  assert.equal(backend.publicSchemaReleased, true);
  assert.equal(backend.publicCleanupAttempts, 1);
});

test("lets iCron finish while post-import public cleanup remains pending", async () => {
  const backend = catalogBackend([], {
    pendingPublicCleanup: true,
    pauseRow: {
      last_error: `maintenance; retry_after_ms=${Date.now() + 60 * 60 * 1000}`,
      updated_at: "2099-01-01 00:00:00",
    },
  });
  const cleanupStarted = new Promise((resolve) => {
    backend.onPublicCleanupStart = resolve;
  });
  const waits = [];
  await Worker.scheduled({ cron: "*/3 * * * *" }, env({ SPORTS_DB: catalogDb([], backend) }), {
    waitUntil(promise) {
      waits.push(promise);
    },
  });

  const importFinished = await Promise.race([
    waits[0].then(() => true),
    new Promise((resolve) => setTimeout(() => resolve(false), 100)),
  ]);
  try {
    assert.equal(importFinished, true, "iCron must not wait for the cleanup DELETE");
    await cleanupStarted;
    assert.equal(backend.pauseReads, 1);
    assert.equal(backend.publicCleanupAttempts, 1);
    assert.equal(backend.publicCleanupSettled, false);
    assert.equal(waits.length, 2);
  } finally {
    backend.releasePublicCleanup?.();
    if (backend.releasePublicCleanup) await Promise.all(waits);
  }
});

test("schedules public cleanup when iCron fails", async () => {
  const backend = catalogBackend([], { failPauseRead: true });
  const waits = [];
  await Worker.scheduled({ cron: "*/3 * * * *" }, env({ SPORTS_DB: catalogDb([], backend) }), {
    waitUntil(promise) {
      waits.push(promise);
    },
  });

  await waits[0];
  await waits[1];
  assert.equal(waits.length, 2);
  assert.equal(backend.publicCleanupAttempts, 1);
});

test("marks not-found and worker errors as non-cacheable", async () => {
  const notFound = await Worker.fetch(request("/missing"), env(), {});
  const failingDb = catalogDb([]);
  const originalPrepare = failingDb.prepare.bind(failingDb);
  failingDb.prepare = (sql) => {
    if (sql.includes("FROM sportsdb_leagues")) throw new Error("fixture database failure");
    return originalPrepare(sql);
  };
  const error = await Worker.fetch(request("/api/leagues"), env({ SPORTS_DB: failingDb }), {});

  assert.equal(notFound.status, 404);
  assert.equal(notFound.headers.get("Cache-Control"), "no-store");
  assert.equal(error.status, 500);
  assert.equal(error.headers.get("Cache-Control"), "no-store");
});
