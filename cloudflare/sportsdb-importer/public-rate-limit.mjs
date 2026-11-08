export const PUBLIC_RATE_LIMIT = 120;
export const PUBLIC_RATE_WINDOW_MS = 60_000;
export const PUBLIC_RATE_SCHEMA_SQL = Object.freeze([
  `CREATE TABLE IF NOT EXISTS sportsdb_public_request_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_key TEXT NOT NULL,
    requested_at_ms INTEGER NOT NULL
  )`,
  "CREATE INDEX IF NOT EXISTS idx_public_request_log_client_time ON sportsdb_public_request_log(client_key, requested_at_ms)",
  "CREATE INDEX IF NOT EXISTS idx_public_request_log_time ON sportsdb_public_request_log(requested_at_ms)",
]);

// Cloudflare keeps the D1 binding object stable within a Worker isolate. Cache
// lifecycle state only by that object: separate binding objects get separate
// schema/prune gates. The request cap itself remains shared in D1; this is not
// a cache keyed by an underlying database identity.
const bindingState = new WeakMap();
const PRUNE_INTERVAL_MS = 30_000;
const encoder = new TextEncoder();

function stateFor(db) {
  let state = bindingState.get(db);
  if (!state) {
    state = { schemaReady: undefined, nextPruneAt: 0 };
    bindingState.set(db, state);
  }
  return state;
}

export async function hashPublicClientKey(request, secret) {
  const clientAddress = request.headers.get("CF-Connecting-IP")?.trim() || "anonymous";
  const keyMaterial = String(secret || "").trim();
  if (!keyMaterial) throw new Error("Public rate-limit key is not configured");

  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    encoder.encode(keyMaterial),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await globalThis.crypto.subtle.sign("HMAC", key, encoder.encode(clientAddress));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

export async function ensurePublicRateSchema(db) {
  if (!db || typeof db.prepare !== "function" || typeof db.batch !== "function") {
    throw new Error("Public rate-limit D1 binding is unavailable");
  }

  const state = stateFor(db);
  if (!state.schemaReady) {
    state.schemaReady = Promise.resolve()
      .then(() => db.batch(PUBLIC_RATE_SCHEMA_SQL.map((sql) => db.prepare(sql))))
      .then(() => undefined);
  }
  try {
    await state.schemaReady;
  } catch (error) {
    state.schemaReady = undefined;
    throw error;
  }
}

/** Remove rows outside the rolling window; cron passes force=true to run while idle. */
export async function prunePublicRateRequests(db, now = Date.now(), { force = false } = {}) {
  if (!Number.isSafeInteger(now)) throw new Error("Invalid public rate-limit timestamp");
  const state = stateFor(db);
  if (!force && now < state.nextPruneAt) return { pruned: false };

  // Set the gate before awaiting so concurrent requests in this isolate do not
  // fan out duplicate DELETE statements. A failure reopens the gate.
  state.nextPruneAt = now + PRUNE_INTERVAL_MS;
  try {
    await db
      .prepare("DELETE FROM sportsdb_public_request_log WHERE requested_at_ms <= ? - ?")
      .bind(now, PUBLIC_RATE_WINDOW_MS)
      .run();
    return { pruned: true };
  } catch (error) {
    state.nextPruneAt = 0;
    throw error;
  }
}

async function readUsage(db, clientKey, now) {
  return db
    .prepare(
      `SELECT COUNT(*) AS request_count, MIN(requested_at_ms) AS oldest_at_ms
       FROM sportsdb_public_request_log
       WHERE client_key = ? AND requested_at_ms > ? - ?`,
    )
    .bind(clientKey, now, PUBLIC_RATE_WINDOW_MS)
    .first();
}

function retryAfterSeconds(oldestAt, now) {
  const oldest = Number(oldestAt);
  const retryAt = Number.isFinite(oldest)
    ? oldest + PUBLIC_RATE_WINDOW_MS
    : now + PUBLIC_RATE_WINDOW_MS;
  return Math.max(1, Math.ceil((retryAt - now) / 1000));
}

/** Atomically reserve a public catalog request in shared D1, across Worker isolates/POPs. */
export async function reservePublicRequest(db, clientKey, now = Date.now()) {
  if (typeof clientKey !== "string" || clientKey.length !== 64) {
    throw new Error("Invalid public rate-limit client key");
  }
  if (!Number.isSafeInteger(now)) throw new Error("Invalid public rate-limit timestamp");

  await ensurePublicRateSchema(db);
  await prunePublicRateRequests(db, now);

  const inserted = await db
    .prepare(
      `INSERT INTO sportsdb_public_request_log (client_key, requested_at_ms)
       SELECT ?, ?
       WHERE (SELECT COUNT(*) FROM sportsdb_public_request_log
              WHERE client_key = ? AND requested_at_ms > ? - ?) < ?`,
    )
    .bind(clientKey, now, clientKey, now, PUBLIC_RATE_WINDOW_MS, PUBLIC_RATE_LIMIT)
    .run();
  if (Number(inserted?.meta?.changes) === 1) {
    return { allowed: true, limit: PUBLIC_RATE_LIMIT };
  }

  const usage = await readUsage(db, clientKey, now);
  return {
    allowed: false,
    limit: PUBLIC_RATE_LIMIT,
    remaining: 0,
    retryAfter: retryAfterSeconds(usage?.oldest_at_ms, now),
  };
}
