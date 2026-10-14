export const SPORTSDB_API_LIMITS = Object.freeze({
  requestsPerMinute: 450,
  requestsPer24Hours: 75_000,
});

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

/** Reserve the next provider request atomically in D1 before calling TheSportsDB. */
export async function reserveSportsDbApiRequest(db, now = Date.now()) {
  const insert = await db
    .prepare(
      `INSERT INTO sportsdb_api_request_log (requested_at_ms)
       SELECT ?
       WHERE (SELECT COUNT(*) FROM sportsdb_api_request_log
              WHERE requested_at_ms > ? - 60000) < ${SPORTSDB_API_LIMITS.requestsPerMinute}
         AND (SELECT COUNT(*) FROM sportsdb_api_request_log
              WHERE requested_at_ms > ? - 86400000) < ${SPORTSDB_API_LIMITS.requestsPer24Hours}`,
    )
    .bind(now, now, now)
    .run();

  if (Number(insert.meta?.changes) === 1) {
    return Number(insert.meta.last_row_id);
  }

  const usage = await db
    .prepare(
      `SELECT
         SUM(CASE WHEN requested_at_ms > ? - 60000 THEN 1 ELSE 0 END) AS minute_count,
         MIN(CASE WHEN requested_at_ms > ? - 60000 THEN requested_at_ms END) AS minute_oldest,
         SUM(CASE WHEN requested_at_ms > ? - 86400000 THEN 1 ELSE 0 END) AS day_count,
         MIN(CASE WHEN requested_at_ms > ? - 86400000 THEN requested_at_ms END) AS day_oldest
       FROM sportsdb_api_request_log`,
    )
    .bind(now, now, now, now)
    .first();

  let retryAt = now + MINUTE_MS;
  if (Number(usage?.minute_count) >= SPORTSDB_API_LIMITS.requestsPerMinute) {
    retryAt = Math.max(retryAt, Number(usage.minute_oldest) + MINUTE_MS);
  }
  if (Number(usage?.day_count) >= SPORTSDB_API_LIMITS.requestsPer24Hours) {
    retryAt = Math.max(retryAt, Number(usage.day_oldest) + DAY_MS);
  }

  const error = new Error("TheSportsDB request quota reached");
  error.code = "SPORTSDB_QUOTA";
  error.retryAt = retryAt;
  throw error;
}

export async function recordSportsDbApiResponse(db, requestId, status) {
  if (!Number.isSafeInteger(Number(requestId)) || Number(requestId) <= 0) return;
  await db
    .prepare("UPDATE sportsdb_api_request_log SET response_status = ? WHERE id = ?")
    .bind(Number(status), Number(requestId))
    .run();
}

export async function pauseSportsDbImporter(db, reason, retryAt) {
  const safeReason = String(reason || "Import paused")
    .replace(/[\r\n\u0000-\u001f]/g, " ")
    .slice(0, 160);
  const safeRetryAt = Number.isFinite(Number(retryAt))
    ? Math.trunc(Number(retryAt))
    : Date.now() + 15 * MINUTE_MS;

  await db
    .prepare(
      `INSERT OR REPLACE INTO sportsdb_import_state
       (phase, offset_val, last_error, updated_at)
       VALUES ('__paused__', NULL, ?, datetime('now'))`,
    )
    .bind(`${safeReason}; retry_after_ms=${safeRetryAt}`)
    .run();
}

function parseSqliteTimestamp(value) {
  if (!value) return Number.NaN;
  const normalized = String(value).replace(" ", "T");
  const withZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized) ? normalized : `${normalized}Z`;
  return Date.parse(withZone);
}

export async function readSportsDbPause(db, now = Date.now()) {
  const row = await db
    .prepare("SELECT last_error, updated_at FROM sportsdb_import_state WHERE phase = '__paused__'")
    .first();
  if (!row) return null;

  const retryMatch = String(row.last_error || "").match(/retry_after_ms=(\d+)/);
  const retryAt = retryMatch
    ? Number(retryMatch[1])
    : parseSqliteTimestamp(row.updated_at) + 15 * MINUTE_MS;
  if (!Number.isFinite(retryAt) || now < retryAt) {
    return {
      reason: String(row.last_error || "Import paused").replace(/; retry_after_ms=\d+$/, ""),
      retryAt: Number.isFinite(retryAt) ? retryAt : now + 15 * MINUTE_MS,
    };
  }

  await db.prepare("DELETE FROM sportsdb_import_state WHERE phase = '__paused__'").run();
  return null;
}

export async function pruneSportsDbApiRequests(db, now = Date.now()) {
  await db
    .prepare("DELETE FROM sportsdb_api_request_log WHERE requested_at_ms <= ? - 86400000")
    .bind(now)
    .run();
}

export function retryAtFromResponse(retryAfter, now, fallbackMs) {
  const value = String(retryAfter || "").trim();
  let requestedAt = Number.NaN;
  if (/^\d+(?:\.\d+)?$/.test(value)) {
    requestedAt = now + Number(value) * 1000;
  } else if (value) {
    requestedAt = Date.parse(value);
  }
  const fallbackAt = now + fallbackMs;
  return Math.max(now + MINUTE_MS, Number.isFinite(requestedAt) ? requestedAt : fallbackAt);
}
