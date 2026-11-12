/**
 * Public-only local catalog read path.
 * The Supabase PostgreSQL database remains authoritative; this cache is replaceable.
 * Executed solely inside the localhost VPS bridge process as the unprivileged jmsbapi OS user.
 */
import pg from 'pg';

const pool = new pg.Pool({
  host: '/var/run/postgresql',
  database: 'jogomanager_local',
  user: 'jmsbapi',
  max: 3,
  min: 0,
  connectionTimeoutMillis: 350,
  idleTimeoutMillis: 10000,
  query_timeout: 2000,
  statement_timeout: 1500,
  options: '-c default_transaction_read_only=on',
  allowExitOnIdle: true,
});

pool.on('error', () => {
  // A disconnected idle client is discarded by the pool.
  // Sensitive connection details must never reach a public HTTP response.
});

/**
 * Null indicates that the mirror is absent, stale or unreachable.
 * In that case, the caller must read directly from the authoritative Supabase API.
 */
export async function cachedCompetitions(limit) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) return null;
  try {
    const result = await pool.query({
      text: `SELECT payload->>'id' AS id, payload->>'name' AS name
          FROM jm_cache.catalog_entries
          WHERE kind = 'competitions'
          AND EXISTS (
            SELECT 1 FROM jm_cache.sync_runs
            WHERE kind = 'competitions'
              AND finished_at >= CURRENT_TIMESTAMP - INTERVAL '3 hours'
          )
          ORDER BY payload->>'name'
          LIMIT $1::integer`,
      values: [limit],
    });
    if (result.rowCount === 0) return null;
    if (result.rows.some((row) => typeof row.id !== 'string' || typeof row.name !== 'string')) return null;
    return result.rows;
  } catch {
    return null;
  }
}
