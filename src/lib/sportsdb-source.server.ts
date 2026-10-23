type D1Row = Record<string, unknown>;

type D1Statement = {
  bind: (...values: unknown[]) => D1Statement;
  all: <T extends D1Row>() => Promise<{ results: T[] }>;
  first: <T extends D1Row>() => Promise<T | null>;
};

type D1Database = {
  prepare: (query: string) => D1Statement;
};

type R2Object = {
  body: ReadableStream<Uint8Array>;
};

type R2Bucket = {
  get: (key: string) => Promise<R2Object | null>;
};

type WorkerEnvironment = Record<string, unknown>;

const SOURCE_ENTITY_TYPES = [
  "league_index",
  "league",
  "team_index",
  "team",
  "player_index",
  "player",
  "season",
  "equipment",
  "venue",
  "event_index",
  "event",
  "event_lineup",
  "event_results",
  "event_stats",
  "event_timeline",
  "event_tv",
  "event_highlights",
  "player_contracts",
  "player_results",
  "player_honours",
  "player_milestones",
  "player_teams",
  "player_stats",
  "round",
  "table",
  "table_row",
  "country",
  "livescore",
] as const;

const SOURCE_PHASES = [
  "catalog",
  "leagues",
  "teams-index",
  "teams",
  "players",
  "schedules",
  "rounds",
  "tables",
  "events",
] as const;

// The project URL is public configuration, not a credential. Keep this fallback
// so the Worker can still reach the bridge when a deployment keeps an older
// vars snapshot; credentials are always supplied at request time.
const DEFAULT_SUPABASE_URL = "https://lguqnwvsfeefxamzeyos.supabase.co";

function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function envString(env: WorkerEnvironment, name: string): string | undefined {
  const value = env[name];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getBearerToken(request: Request): string | undefined {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+([^\s,]+)$/i.exec(header.trim());
  return match?.[1];
}

type AuthorizationResult =
  true | "missing-token" | `supabase-http-${number}` | "supabase-false" | "supabase-error";

async function authorize(request: Request, env: WorkerEnvironment): Promise<AuthorizationResult> {
  const token = getBearerToken(request);
  const base = envString(env, "SUPABASE_URL") ?? DEFAULT_SUPABASE_URL;
  if (!token) return "missing-token";

  const headers: Record<string, string> = {
    accept: "application/json",
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  };

  try {
    const response = await fetch(`${base}/functions/v1/sportsdb-bridge/authorize`, {
      method: "POST",
      headers,
      body: "{}",
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return `supabase-http-${response.status}`;
    const result: unknown = await response.json();
    return result === true || (Array.isArray(result) && result[0] === true)
      ? true
      : "supabase-false";
  } catch {
    return "supabase-error";
  }
}

function parsePayload(payload: string): Record<string, unknown> {
  const value: unknown = JSON.parse(payload);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid SportsDB payload");
  }
  return value as Record<string, unknown>;
}

async function sourceStatus(db: D1Database): Promise<Record<string, unknown>> {
  const [counts, archive, budget, phases] = await Promise.all([
    db
      .prepare(
        `SELECT entity_type, COUNT(*) AS records, MAX(updated_at) AS updated_at
         FROM sportsdb_records
         WHERE entity_type IN (${SOURCE_ENTITY_TYPES.map(() => "?").join(",")})
         GROUP BY entity_type`,
      )
      .bind(...SOURCE_ENTITY_TYPES)
      .all<{ entity_type: string; records: number; updated_at: string | null }>(),
    db
      .prepare(
        "SELECT COUNT(*) AS objects, COALESCE(SUM(content_bytes), 0) AS bytes FROM sportsdb_archives",
      )
      .first<{
        objects: number;
        bytes: number;
      }>(),
    db.prepare("SELECT max_bytes FROM sportsdb_archive_usage WHERE singleton = 1").first<{
      max_bytes: number;
    }>(),
    db.prepare("SELECT phase, complete, last_error, updated_at FROM sportsdb_import_state").all<{
      phase: string;
      complete: number;
      last_error: string | null;
      updated_at: string | null;
    }>(),
  ]);

  const state = new Map(phases.results.map((row) => [row.phase, row]));
  return {
    source: "TheSportsDB",
    counts: counts.results.map((row) => ({
      entity_type: row.entity_type,
      records: Number(row.records),
      updated_at: row.updated_at ?? undefined,
    })),
    archive: {
      objects: Number(archive?.objects ?? 0),
      bytes: Number(archive?.bytes ?? 0),
      storage: "Cloudflare R2",
      budgetBytes: Number(budget?.max_bytes ?? 0),
    },
    phases: SOURCE_PHASES.map((phase) => {
      const row = state.get(phase) ?? state.get(phase === "teams-index" ? "teams" : phase);
      return {
        phase,
        complete: row?.complete === 1,
        ...(row?.last_error ? { last_error: row.last_error } : {}),
        ...(row?.updated_at ? { updated_at: row.updated_at } : {}),
      };
    }),
  };
}

async function sourcePage(
  db: D1Database,
  entity: string,
  limit: number,
  offset: number,
): Promise<Record<string, unknown>> {
  if (!SOURCE_ENTITY_TYPES.includes(entity as (typeof SOURCE_ENTITY_TYPES)[number])) {
    throw new Error("Unsupported source entity");
  }

  const total = await db
    .prepare("SELECT COUNT(*) AS total FROM sportsdb_records WHERE entity_type = ?")
    .bind(entity)
    .first<{ total: number }>();
  const rows = await db
    .prepare(
      `SELECT source_id, parent_id, season, updated_at, payload_json
       FROM sportsdb_records
       WHERE entity_type = ?
       ORDER BY record_key
       LIMIT ? OFFSET ?`,
    )
    .bind(entity, limit, offset)
    .all<{
      source_id: string;
      parent_id: string;
      season: string;
      updated_at: string;
      payload_json: string;
    }>();

  return {
    entityType: entity,
    total: Number(total?.total ?? 0),
    rows: rows.results.map((row) => ({
      sourceId: row.source_id,
      parentId: row.parent_id,
      season: row.season,
      updatedAt: row.updated_at,
      data: parsePayload(row.payload_json),
    })),
  };
}

async function archivePage(
  db: D1Database,
  limit: number,
  offset: number,
): Promise<Record<string, unknown>> {
  const total = await db.prepare("SELECT COUNT(*) AS total FROM sportsdb_archives").first<{
    total: number;
  }>();
  const rows = await db
    .prepare(
      `SELECT archive_key, updated_at
       FROM sportsdb_archives
       ORDER BY archive_key
       LIMIT ? OFFSET ?`,
    )
    .bind(limit, offset)
    .all<{ archive_key: string; updated_at: string }>();

  return {
    entityType: "archive_catalog",
    total: Number(total?.total ?? 0),
    rows: rows.results.map((row) => ({
      archive_key: row.archive_key,
      source_updated_at: row.updated_at,
    })),
  };
}

function archiveKeyIsSafe(key: string): boolean {
  return (
    /^sportsdb\/v2\/[A-Za-z0-9_/-]+\.json$/.test(key) && !key.includes("..") && key.length <= 512
  );
}

async function archiveObject(bucket: R2Bucket, key: string): Promise<Response> {
  if (!archiveKeyIsSafe(key)) return json({ error: "Invalid archive key" }, 400);
  const object = await bucket.get(key);
  if (!object) return json({ error: "Archive not found" }, 404);
  return new Response(object.body, {
    status: 200,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
      "x-content-type-options": "nosniff",
    },
  });
}

/**
 * Serves the already archived SportsDB snapshot to the Supabase bridge.
 * Auth is delegated to the scheduler-token RPC in Supabase so the token is
 * never duplicated into Cloudflare configuration.
 */
export async function handleSportsDbSourceRequest(
  request: Request,
  rawEnv: unknown,
): Promise<Response> {
  if (request.method !== "GET") return json({ error: "GET required" }, 405);
  const env = (rawEnv && typeof rawEnv === "object" ? rawEnv : {}) as WorkerEnvironment;
  const authorization = await authorize(request, env);
  if (authorization !== true) {
    const response = json({ error: "Unauthorized" }, 401);
    response.headers.set("x-sportsdb-auth-reason", authorization);
    return response;
  }

  const db = env["SPORTS_DB"] as D1Database | undefined;
  const bucket = env["SPORTSDB_RAW"] as R2Bucket | undefined;
  if (!db || !bucket) return json({ error: "SportsDB source bindings are unavailable" }, 503);

  try {
    const params = new URL(request.url).searchParams;
    const rawLimit = Number(params.get("limit") ?? "100");
    const rawOffset = Number(params.get("offset") ?? "0");
    const limit = Number.isSafeInteger(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 0;
    const offset = Number.isSafeInteger(rawOffset)
      ? Math.min(Math.max(rawOffset, 0), 1_000_000)
      : -1;
    if (!limit || offset < 0) return json({ error: "Invalid pagination" }, 400);

    const archiveKey = params.get("archiveKey");
    if (archiveKey) return archiveObject(bucket, archiveKey);
    if (params.get("status") === "1") return json(await sourceStatus(db));
    if (params.get("archives") === "1") return json(await archivePage(db, limit, offset));

    const entity = params.get("entity");
    if (entity) return json(await sourcePage(db, entity, limit, offset));
    return json({ error: "status, archives, entity or archiveKey is required" }, 400);
  } catch (error) {
    console.error("SportsDB source request failed", error);
    return json({ error: "SportsDB source failed" }, 503);
  }
}
