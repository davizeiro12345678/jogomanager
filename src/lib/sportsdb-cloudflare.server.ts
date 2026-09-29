/** Cloudflare D1 cache and resumable importer for the TheSportsDB v2 API. */
import { getCloudflareBindings } from "./cloudflare-bindings.server";

type D1Statement = {
  bind: (...values: unknown[]) => D1Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results?: T[] }>;
  run(): Promise<unknown>;
};
type D1Database = {
  prepare(query: string): D1Statement;
  batch(statements: D1Statement[]): Promise<unknown[]>;
  exec(query: string): Promise<unknown>;
};
type R2ObjectBody = {
  body: ReadableStream;
  size: number;
  httpMetadata?: { contentType?: string };
};
type R2Bucket = {
  put(key: string, value: string, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  get(key: string): Promise<R2ObjectBody | null>;
  head(key: string): Promise<{ size: number } | null>;
};
type SportsDbBindings = {
  SPORTS_DB?: D1Database;
  SPORTS_ARCHIVE?: R2Bucket;
  THESPORTSDB_API_KEY?: string;
  THESPORTSDB_IMPORT_SECRET?: string;
};
type Json = Record<string, unknown>;
type StoredRow = {
  record_key: string;
  endpoint: string;
  entity_type: string;
  source_id: string;
  parent_id: string;
  season: string;
  payload_json: string;
  updated_at: string;
};

const API_BASE = "https://www.thesportsdb.com/api/v2/json";
const MAX_PAGE = 8;
const ARCHIVE_BUDGET_BYTES = 2_500_000_000;
const IMPORT_PHASES = ["catalog", "leagues", "teams-index", "teams", "players", "schedules", "events"] as const;
const PAUSE_PHASE = "__paused__";
export type SportsDbImportPhase = (typeof IMPORT_PHASES)[number];
let schemaReady: Promise<void> | undefined;

function bindings(): SportsDbBindings {
  return getCloudflareBindings<SportsDbBindings>() ?? {};
}

export function isSportsDbImportPhase(value: string): value is SportsDbImportPhase {
  return IMPORT_PHASES.some((phase) => phase === value);
}

export function hasSportsDbD1(): boolean {
  return Boolean(bindings().SPORTS_DB);
}

export function authorizeSportsDbImport(provided: string | null): boolean {
  const expected = bindings().THESPORTSDB_IMPORT_SECRET;
  if (!expected || !provided || expected.length !== provided.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  return diff === 0;
}

function db(): D1Database {
  const database = bindings().SPORTS_DB;
  if (!database) throw new Error("Cloudflare D1 binding SPORTS_DB is missing");
  return database;
}

export async function ensureSportsDbSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = db().exec(`
    CREATE TABLE IF NOT EXISTS sportsdb_records (
      record_key TEXT PRIMARY KEY,
      endpoint TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      source_id TEXT NOT NULL DEFAULT '',
      parent_id TEXT NOT NULL DEFAULT '',
      season TEXT NOT NULL DEFAULT '',
      payload_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sportsdb_records_entity_source
      ON sportsdb_records(entity_type, source_id);
    CREATE INDEX IF NOT EXISTS sportsdb_records_entity_parent
      ON sportsdb_records(entity_type, parent_id, source_id);
    CREATE INDEX IF NOT EXISTS sportsdb_records_endpoint_scope
      ON sportsdb_records(endpoint, parent_id, season, source_id);
    CREATE TABLE IF NOT EXISTS sportsdb_import_state (
      phase TEXT PRIMARY KEY,
      next_offset INTEGER NOT NULL DEFAULT 0,
      complete INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sportsdb_archives (
      archive_key TEXT PRIMARY KEY,
      endpoint TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      source_id TEXT NOT NULL DEFAULT '',
      parent_id TEXT NOT NULL DEFAULT '',
      season TEXT NOT NULL DEFAULT '',
      content_bytes INTEGER NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sportsdb_archives_endpoint
      ON sportsdb_archives(endpoint, source_id, parent_id, season);
    CREATE TABLE IF NOT EXISTS sportsdb_archive_usage (
      singleton INTEGER PRIMARY KEY CHECK(singleton = 1),
      used_bytes INTEGER NOT NULL DEFAULT 0,
      max_bytes INTEGER NOT NULL DEFAULT ${ARCHIVE_BUDGET_BYTES}
    );
    INSERT OR IGNORE INTO sportsdb_archive_usage(singleton, used_bytes, max_bytes)
      VALUES(1, 0, ${ARCHIVE_BUDGET_BYTES});
    CREATE TRIGGER IF NOT EXISTS sportsdb_archive_budget_insert
      BEFORE INSERT ON sportsdb_archives
      WHEN (SELECT used_bytes + NEW.content_bytes > max_bytes FROM sportsdb_archive_usage WHERE singleton = 1)
      BEGIN SELECT RAISE(ABORT, 'SPORTSDB_ARCHIVE_LIMIT'); END;
    CREATE TRIGGER IF NOT EXISTS sportsdb_archive_budget_update
      BEFORE UPDATE OF content_bytes ON sportsdb_archives
      WHEN (SELECT used_bytes - OLD.content_bytes + NEW.content_bytes > max_bytes FROM sportsdb_archive_usage WHERE singleton = 1)
      BEGIN SELECT RAISE(ABORT, 'SPORTSDB_ARCHIVE_LIMIT'); END;
    CREATE TRIGGER IF NOT EXISTS sportsdb_archive_usage_insert
      AFTER INSERT ON sportsdb_archives
      BEGIN UPDATE sportsdb_archive_usage SET used_bytes = used_bytes + NEW.content_bytes WHERE singleton = 1; END;
    CREATE TRIGGER IF NOT EXISTS sportsdb_archive_usage_update
      AFTER UPDATE OF content_bytes ON sportsdb_archives
      BEGIN UPDATE sportsdb_archive_usage SET used_bytes = used_bytes - OLD.content_bytes + NEW.content_bytes WHERE singleton = 1; END;
    CREATE TRIGGER IF NOT EXISTS sportsdb_archive_usage_delete
      AFTER DELETE ON sportsdb_archives
      BEGIN UPDATE sportsdb_archive_usage SET used_bytes = MAX(0, used_bytes - OLD.content_bytes) WHERE singleton = 1; END;
    `).then(() => undefined).catch((error: unknown) => {
      schemaReady = undefined;
      throw error;
    });
  }
  await schemaReady;
}

function archiveObjectKey(endpoint: string, sourceId: string, parentId: string, season: string): string {
  const segment = (value: string) => encodeURIComponent(value || "_");
  return `sportsdb/v2/${endpoint}/${segment(sourceId)}/${segment(parentId)}/${segment(season)}.json`;
}

function getArchiveBucket(): R2Bucket {
  const bucket = bindings().SPORTS_ARCHIVE;
  if (!bucket) throw new Error("Cloudflare R2 binding SPORTS_ARCHIVE is missing");
  return bucket;
}

async function archiveResponse(
  endpoint: string,
  entityType: string,
  sourceId: string,
  parentId: string,
  season: string,
  body: Json | null,
): Promise<{ archiveKey: string | null; contentBytes: number }> {
  if (body === null) return { archiveKey: null, contentBytes: 0 };
  const archiveKey = archiveObjectKey(endpoint, sourceId, parentId, season);
  const content = JSON.stringify(body);
  const contentBytes = new TextEncoder().encode(content).byteLength;
  const existing = await db().prepare("SELECT content_bytes FROM sportsdb_archives WHERE archive_key = ?")
    .bind(archiveKey).first<{ content_bytes: number }>();
  const previousBytes = existing?.content_bytes ?? null;
  const now = new Date().toISOString();

  // Update the D1 manifest first: its trigger enforces the hard 2.5 GB cap.
  await db().prepare(`INSERT INTO sportsdb_archives
    (archive_key, endpoint, entity_type, source_id, parent_id, season, content_bytes, updated_at)
    VALUES(?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(archive_key) DO UPDATE SET endpoint = excluded.endpoint,
      entity_type = excluded.entity_type, source_id = excluded.source_id,
      parent_id = excluded.parent_id, season = excluded.season,
      content_bytes = excluded.content_bytes, updated_at = excluded.updated_at`)
    .bind(archiveKey, endpoint, entityType, sourceId, parentId, season, contentBytes, now).run();

  try {
    const bucket = getArchiveBucket();
    const oldObject = previousBytes === contentBytes ? await bucket.head(archiveKey) : null;
    if (!oldObject || oldObject.size !== contentBytes) {
      await bucket.put(archiveKey, content, { httpMetadata: { contentType: "application/json; charset=utf-8" } });
    }
  } catch (error) {
    if (previousBytes === null) {
      await db().prepare("DELETE FROM sportsdb_archives WHERE archive_key = ?").bind(archiveKey).run();
    } else {
      await db().prepare("UPDATE sportsdb_archives SET content_bytes = ?, updated_at = ? WHERE archive_key = ?")
        .bind(previousBytes, now, archiveKey).run();
    }
    throw error;
  }
  return { archiveKey, contentBytes };
}

const INDEX_FIELDS: Record<string, readonly string[]> = {
  sport: ["strSport", "strFormat", "strSportThumb", "strSportIconGreen"],
  country: ["name_en"],
  league_index: ["idLeague", "strLeague", "strSport", "strCountry", "strBadge", "strLogo", "strGender"],
  livescore: ["idEvent", "idLeague", "idHomeTeam", "idAwayTeam", "strLeague", "strEvent", "strHomeTeam", "strAwayTeam", "dateEvent", "strTime", "intHomeScore", "intAwayScore", "strStatus"],
  livescore_all: ["idEvent", "idLeague", "idHomeTeam", "idAwayTeam", "strLeague", "strEvent", "strHomeTeam", "strAwayTeam", "dateEvent", "strTime", "intHomeScore", "intAwayScore", "strStatus"],
  team_index: ["idTeam", "strTeam", "strTeamShort", "strAlternate", "strLeague", "strCountry", "strTeamBadge", "strBadge", "strTeamLogo", "idVenue", "strVenue"],
  team: ["idTeam", "strTeam", "strTeamShort", "strAlternate", "strLeague", "strCountry", "strTeamBadge", "strBadge", "strTeamLogo", "strTeamFanart1", "strTeamFanart2", "strTeamBanner", "strWebsite", "idVenue", "strVenue", "strStadiumThumb", "strStadiumDescription", "intFormedYear", "strManager", "strDescriptionEN"],
  equipment: ["idEquipment", "idTeam", "strType", "strEquipment", "strSeason"],
  player_index: ["idPlayer", "strPlayer", "strPlayerAlternate", "strTeam", "strTeam2", "strPosition", "strNumber", "strNationality", "dateBorn", "intAge", "strHeight", "strWeight", "strThumb", "strCutout", "strRender", "strSigning", "strWage"],
  player: ["idPlayer", "strPlayer", "strPlayerAlternate", "strTeam", "strPosition", "strNumber", "strNationality", "dateBorn", "intAge", "strHeight", "strWeight", "strThumb", "strCutout", "strRender", "strSigning", "strWage"],
  season: ["strSeason", "idLeague", "strLeague"],
  event_index: ["idEvent", "idLeague", "idHomeTeam", "idAwayTeam", "strLeague", "strSeason", "strEvent", "strHomeTeam", "strAwayTeam", "dateEvent", "strTime", "intHomeScore", "intAwayScore", "strVenue", "strStatus"],
  event: ["idEvent", "idLeague", "idHomeTeam", "idAwayTeam", "strLeague", "strSeason", "strEvent", "strHomeTeam", "strAwayTeam", "dateEvent", "strTime", "intHomeScore", "intAwayScore", "strVenue", "strStatus"],
};

function compactData(type: string, item: Json, archiveKey: string | null, contentBytes: number): Json {
  const fields = INDEX_FIELDS[type];
  const compact: Json = {};
  if (fields) {
    for (const field of fields) {
      const value = item[field];
      if (value !== undefined && value !== null) compact[field] = value;
    }
  }
  if (archiveKey) compact.archiveKey = archiveKey;
  if (contentBytes) compact.archiveBytes = contentBytes;
  return compact;
}

function keyOf(endpoint: string, sourceId: string, parentId: string, season: string): string {
  return JSON.stringify([endpoint, sourceId, parentId, season]);
}

async function putRecords(
  rows: Array<Omit<StoredRow, "updated_at">>,
): Promise<void> {
  if (!rows.length) return;
  const now = new Date().toISOString();
  const statement = `INSERT INTO sportsdb_records
    (record_key, endpoint, entity_type, source_id, parent_id, season, payload_json, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(record_key) DO UPDATE SET
      payload_json = excluded.payload_json, updated_at = excluded.updated_at`;
  const statements = rows.map((row) =>
    db().prepare(statement).bind(
      row.record_key,
      row.endpoint,
      row.entity_type,
      row.source_id,
      row.parent_id,
      row.season,
      row.payload_json,
      now,
    ),
  );
  for (let i = 0; i < statements.length; i += 100) {
    await db().batch(statements.slice(i, i + 100));
  }
}

async function saveResponse(
  endpoint: string,
  entityType: string,
  sourceId: string,
  parentId: string,
  season: string,
  body: Json | null,
  itemType?: string,
  itemIdField?: string,
): Promise<number> {
  if (body === null) return 0;
  const response = body ?? {};
  const archive = await archiveResponse(endpoint, entityType, sourceId, parentId, season, body);
  const items = Object.values(response).find(Array.isArray) as Json[] | undefined;
  const rows: Array<Omit<StoredRow, "updated_at">> = [{
    record_key: keyOf(endpoint, sourceId, parentId, season),
    endpoint,
    entity_type: `snapshot_${entityType.replace(/[^a-z0-9_]/gi, "_")}`,
    source_id: sourceId,
    parent_id: parentId,
    season,
    payload_json: JSON.stringify({ archiveKey: archive.archiveKey, contentBytes: archive.contentBytes, itemCount: items?.length ?? 0 }),
  }];
  if (items && itemType && itemIdField) {
    for (const item of items) {
      const candidate = item[itemIdField] ?? item["id"] ?? item["strCountry"] ?? item["name"];
      const itemId = typeof candidate === "string" || typeof candidate === "number"
        ? String(candidate)
        : "";
      if (!itemId) continue;
      rows.push({
        record_key: keyOf(itemType, itemId, parentId, season),
        endpoint: itemType,
        entity_type: itemType,
        source_id: itemId,
        parent_id: parentId,
        season,
        payload_json: JSON.stringify(compactData(itemType, item, archive.archiveKey, archive.contentBytes)),
      });
    }
  } else if (!itemType) {
    const item = items?.[0] ?? response;
    rows.push({
      record_key: keyOf(entityType, sourceId, parentId, season),
      endpoint,
      entity_type: entityType,
      source_id: sourceId,
      parent_id: parentId,
      season,
      payload_json: JSON.stringify(compactData(entityType, item, archive.archiveKey, archive.contentBytes)),
    });
  }
  await putRecords(rows);
  return items?.length ?? 0;
}

async function fetchV2(path: string): Promise<Json | null> {
  const key = bindings().THESPORTSDB_API_KEY;
  if (!key) throw new Error("TheSportsDB API secret is not configured on this Worker");
  const response = await fetch(`${API_BASE}/${path}`, {
    headers: { "X-API-KEY": key, accept: "application/json" },
    signal: AbortSignal.timeout(9_000),
  });
  if (response.status === 429) {
    const error = new Error("TheSportsDB rate limit reached; resume this phase after the quota window");
    error.name = "SportsDbRateLimitError";
    throw error;
  }
  if (response.status === 404) return null;
  if (response.status === 401 || response.status === 403) {
    throw new Error(`TheSportsDB rejected the configured API credential (HTTP ${response.status})`);
  }
  if (!response.ok) throw new Error(`TheSportsDB returned HTTP ${response.status}`);
  const payload: unknown = await response.json();
  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    throw new Error("TheSportsDB returned an unexpected response format");
  }
  return payload as Json;
}

function listOf(body: Json | null): Json[] {
  if (!body) return [];
  return Object.values(body).find(Array.isArray) as Json[] | undefined ?? [];
}

function asString(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

async function getCursor(phase: SportsDbImportPhase): Promise<{ offset: number; complete: boolean }> {
  const row = await db().prepare(
    "SELECT next_offset, complete FROM sportsdb_import_state WHERE phase = ?",
  ).bind(phase).first<{ next_offset: number; complete: number }>();
  return row ? { offset: row.next_offset, complete: row.complete === 1 } : { offset: 0, complete: false };
}

async function setCursor(phase: SportsDbImportPhase, offset: number, complete: boolean): Promise<void> {
  await db().prepare(`INSERT INTO sportsdb_import_state(phase, next_offset, complete, last_error, updated_at)
    VALUES(?, ?, ?, NULL, ?)
    ON CONFLICT(phase) DO UPDATE SET next_offset = excluded.next_offset,
      complete = excluded.complete, last_error = NULL, updated_at = excluded.updated_at`)
    .bind(phase, offset, complete ? 1 : 0, new Date().toISOString()).run();
}

async function sourcePage(entityType: string, offset: number, limit: number): Promise<StoredRow[]> {
  const result = await db().prepare(`SELECT record_key, endpoint, entity_type, source_id, parent_id, season,
      payload_json, updated_at
    FROM sportsdb_records WHERE entity_type = ? ORDER BY source_id, parent_id, season LIMIT ? OFFSET ?`)
    .bind(entityType, limit, offset).all<StoredRow>();
  return result.results ?? [];
}

async function sourcePageUnique(entityType: string, offset: number, limit: number): Promise<StoredRow[]> {
  const result = await db().prepare(`SELECT '' AS record_key, entity_type, MIN(endpoint) AS endpoint,
      source_id, MIN(parent_id) AS parent_id, MIN(season) AS season,
      MIN(payload_json) AS payload_json, MIN(updated_at) AS updated_at
    FROM sportsdb_records WHERE entity_type = ? GROUP BY source_id
    ORDER BY source_id LIMIT ? OFFSET ?`)
    .bind(entityType, limit, offset).all<StoredRow>();
  return result.results ?? [];
}

function fromStored(row: StoredRow): Json {
  return JSON.parse(row.payload_json) as Json;
}

async function catalog(): Promise<number> {
  const endpoints = [
    ["all/sports", "sport", "strSport", ""],
    ["all/countries", "country", "name_en", ""],
    ["all/leagues", "league_index", "idLeague", ""],
    ["livescore/soccer", "livescore", "idEvent", "soccer"],
    ["livescore/all", "livescore_all", "idEvent", "all"],
  ] as const;
  let records = 0;
  for (const [path, type, idField, scope] of endpoints) {
    const body = await fetchV2(path);
    const items = listOf(body);
    await saveResponse(path, `snapshot:${type}`, scope || "all", "", "", body, type, idField);
    records += items.length;
  }
  const leagues = await sourcePage("league_index", 0, 3000);
  for (const row of leagues) {
    const league = fromStored(row);
    if (asString(league["strSport"]).toLowerCase() !== "soccer") {
      await db().prepare("DELETE FROM sportsdb_records WHERE record_key = ?").bind(row.record_key).run();
    }
  }
  return records;
}

async function importLeagues(offset: number, limit: number, deadline: number) {
  const rows = await sourcePage("league_index", offset, limit);
  let processed = 0;
  for (const row of rows) {
    if (Date.now() > deadline) break;
    const leagueId = row.source_id;
    const league = await fetchV2(`lookup/league/${encodeURIComponent(leagueId)}`);
    await saveResponse("lookup/league", "league", leagueId, "", "", league);
    processed++;
  }
  const complete = processed === rows.length && rows.length < limit;
  await setCursor("leagues", offset + processed, complete);
  return { processed, imported: processed, complete };
}

async function importTeams(offset: number, limit: number, deadline: number) {
  const rows = await sourcePage("team_index", offset, limit);
  let processed = 0;
  for (const row of rows) {
    if (Date.now() > deadline) break;
    const teamId = row.source_id;
    const [team, equipment, players] = await Promise.all([
      fetchV2(`lookup/team/${encodeURIComponent(teamId)}`),
      fetchV2(`lookup/team_equipment/${encodeURIComponent(teamId)}`),
      fetchV2(`list/players/${encodeURIComponent(teamId)}`),
    ]);
    await saveResponse("lookup/team", "team", teamId, row.parent_id, "", team);
    await saveResponse("lookup/team_equipment", "team_equipment", teamId, teamId, "", equipment, "equipment", "idEquipment");
    await saveResponse("list/players", "player_list", teamId, teamId, "", players, "player_index", "idPlayer");
    const teamDetails = listOf(team)[0] ?? team;
    const venueId = asString(teamDetails?.["idVenue"]);
    if (venueId) {
      const venue = await fetchV2(`lookup/venue/${encodeURIComponent(venueId)}`);
      await saveResponse("lookup/venue", "venue", venueId, teamId, "", venue);
    }
    processed++;
  }
  const complete = processed === rows.length && rows.length < limit;
  await setCursor("teams", offset + processed, complete);
  return { processed, imported: processed, complete };
}

async function importPlayers(offset: number, limit: number, deadline: number) {
  const rows = await sourcePageUnique("player_index", offset, limit);
  const endpoints = ["player", "player_contracts", "player_results", "player_honours", "player_milestones", "player_teams", "player_stats"] as const;
  let processed = 0;
  for (const row of rows) {
    if (Date.now() > deadline) break;
    const playerId = row.source_id;
    for (const endpoint of endpoints) {
      const body = await fetchV2(`lookup/${endpoint}/${encodeURIComponent(playerId)}`);
      const entityType = endpoint === "player" ? "player" : endpoint;
      await saveResponse(`lookup/${endpoint}`, entityType, playerId, "", "", body);
    }
    processed++;
  }
  const complete = processed === rows.length && rows.length < limit;
  await setCursor("players", offset + processed, complete);
  return { processed, imported: processed, complete };
}

async function importSchedules(offset: number, limit: number, deadline: number) {
  const rows = await sourcePage("season", offset, limit);
  let processed = 0;
  for (const row of rows) {
    if (Date.now() > deadline) break;
    const leagueId = row.parent_id;
    const season = asString(fromStored(row)["strSeason"]) || row.source_id;
    if (!leagueId || !season) { processed++; continue; }
    const body = await fetchV2(`schedule/league/${encodeURIComponent(leagueId)}/${encodeURIComponent(season)}`);
    await saveResponse("schedule/league", "event_list", leagueId, leagueId, season, body, "event_index", "idEvent");
    for (const event of listOf(body)) {
      const eventId = asString(event["idEvent"]);
      if (!eventId) continue;
      const eventRecord = {
        record_key: keyOf("event_index", eventId, leagueId, season),
        endpoint: "event_index",
        entity_type: "event_index",
        source_id: eventId,
        parent_id: leagueId,
        season,
        payload_json: JSON.stringify(event),
      };
      await putRecords([eventRecord]);
    }
    processed++;
  }
  const complete = processed === rows.length && rows.length < limit;
  await setCursor("schedules", offset + processed, complete);
  return { processed, imported: processed, complete };
}

async function importEvents(offset: number, limit: number, deadline: number) {
  const rows = await sourcePageUnique("event_index", offset, limit);
  const endpoints = ["event", "event_lineup", "event_results", "event_stats", "event_timeline", "event_tv", "event_highlights"] as const;
  let processed = 0;
  for (const row of rows) {
    if (Date.now() > deadline) break;
    const eventId = row.source_id;
    for (const endpoint of endpoints) {
      const body = await fetchV2(`lookup/${endpoint}/${encodeURIComponent(eventId)}`);
      await saveResponse(`lookup/${endpoint}`, endpoint, eventId, "", "", body);
    }
    processed++;
  }
  const complete = processed === rows.length && rows.length < limit;
  await setCursor("events", offset + processed, complete);
  return { processed, imported: processed, complete };
}

export async function runSportsDbImportBatch(phase: SportsDbImportPhase, requestedLimit = 2) {
  await ensureSportsDbSchema();
  const limit = Math.max(1, Math.min(MAX_PAGE, Math.floor(requestedLimit)));
  const cursor = await getCursor(phase);
  if (cursor.complete) {
    return { ok: true, phase, nextOffset: cursor.offset, complete: true, processed: 0, imported: 0, alreadyComplete: true };
  }
  const start = Date.now();
  let result: { processed: number; imported: number; complete: boolean };
  if (phase === "catalog") {
    const imported = await catalog();
    await setCursor(phase, 1, true);
    result = { processed: 1, imported, complete: true };
  } else if (phase === "leagues") {
    result = await importLeagues(cursor.offset, limit, start + 23_000);
  } else if (phase === "teams-index") {
    const rows = await sourcePage("league_index", cursor.offset, limit);
    let processed = 0;
    for (const row of rows) {
      if (Date.now() > start + 23_000) break;
      const leagueId = row.source_id;
      const [teams, seasons] = await Promise.all([
        fetchV2(`list/teams/${encodeURIComponent(leagueId)}`),
        fetchV2(`list/seasons/${encodeURIComponent(leagueId)}`),
      ]);
      await saveResponse("list/teams", "team_list", leagueId, leagueId, "", teams, "team_index", "idTeam");
      await saveResponse("list/seasons", "season_list", leagueId, leagueId, "", seasons, "season", "strSeason");
      processed++;
    }
    const complete = processed === rows.length && rows.length < limit;
    await setCursor(phase, cursor.offset + processed, complete);
    result = { processed, imported: processed, complete };
  } else if (phase === "teams") {
    result = await importTeams(cursor.offset, limit, start + 23_000);
  } else if (phase === "players") {
    result = await importPlayers(cursor.offset, Math.min(limit, 2), start + 23_000);
  } else if (phase === "schedules") {
    result = await importSchedules(cursor.offset, limit, start + 23_000);
  } else {
    result = await importEvents(cursor.offset, Math.min(limit, 2), start + 23_000);
  }
  return {
    ok: true,
    phase,
    nextOffset: cursor.offset + result.processed,
    complete: result.complete,
    processed: result.processed,
    imported: result.imported,
    elapsedMs: Date.now() - start,
  };
}

export async function runNextSportsDbImportBatch(requestedLimit = 2) {
  await ensureSportsDbSchema();
  const paused = await db().prepare("SELECT last_error FROM sportsdb_import_state WHERE phase = ? AND complete = 1")
    .bind(PAUSE_PHASE).first<{ last_error: string | null }>();
  if (paused) {
    return { ok: false, phase: "paused", complete: false, paused: true, reason: paused.last_error, processed: 0, imported: 0 };
  }
  for (const phase of IMPORT_PHASES) {
    const cursor = await getCursor(phase);
    if (!cursor.complete) return runSportsDbImportBatch(phase, requestedLimit);
  }
  return { ok: true, phase: "complete", nextOffset: 0, complete: true, processed: 0, imported: 0, alreadyComplete: true };
}

export async function pauseSportsDbImport(reason: string): Promise<void> {
  await ensureSportsDbSchema();
  await db().prepare(`INSERT INTO sportsdb_import_state(phase, next_offset, complete, last_error, updated_at)
    VALUES(?, 0, 1, ?, ?)
    ON CONFLICT(phase) DO UPDATE SET complete = 1, last_error = excluded.last_error, updated_at = excluded.updated_at`)
    .bind(PAUSE_PHASE, reason.slice(0, 240), new Date().toISOString()).run();
}

export async function resumeSportsDbImport(): Promise<void> {
  await ensureSportsDbSchema();
  await db().prepare("DELETE FROM sportsdb_import_state WHERE phase = ?").bind(PAUSE_PHASE).run();
}

export async function readSportsDbStatus() {
  await ensureSportsDbSchema();
  const [counts, phases, archiveUsage, archiveCount] = await Promise.all([
    db().prepare("SELECT entity_type, COUNT(*) as records, MAX(updated_at) as updated_at FROM sportsdb_records GROUP BY entity_type ORDER BY entity_type")
      .all<{ entity_type: string; records: number; updated_at: string | null }>(),
    db().prepare("SELECT phase, next_offset, complete, updated_at FROM sportsdb_import_state ORDER BY phase")
      .all<{ phase: string; next_offset: number; complete: number; updated_at: string }>(),
    db().prepare("SELECT used_bytes, max_bytes FROM sportsdb_archive_usage WHERE singleton = 1")
      .first<{ used_bytes: number; max_bytes: number }>(),
    db().prepare("SELECT COUNT(*) as total FROM sportsdb_archives")
      .first<{ total: number }>(),
  ]);
  return {
    source: "TheSportsDB",
    attribution: "https://www.thesportsdb.com/",
    counts: counts.results ?? [],
    phases: (phases.results ?? []).map((p) => ({ ...p, complete: p.complete === 1 })),
    archive: {
      objects: archiveCount?.total ?? 0,
      bytes: archiveUsage?.used_bytes ?? 0,
      budgetBytes: archiveUsage?.max_bytes ?? ARCHIVE_BUDGET_BYTES,
      storage: "Cloudflare R2",
    },
  };
}

export async function listSportsDbArchives(limit = 50, offset = 0) {
  await ensureSportsDbSchema();
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  const safeOffset = Math.max(0, Math.min(1_000_000, Math.floor(offset)));
  const [rows, count] = await Promise.all([
    db().prepare(`SELECT archive_key, endpoint, entity_type, source_id, parent_id, season, content_bytes, updated_at
      FROM sportsdb_archives ORDER BY endpoint, source_id LIMIT ? OFFSET ?`)
      .bind(safeLimit, safeOffset).all<Record<string, string | number>>(),
    db().prepare("SELECT COUNT(*) as total FROM sportsdb_archives").first<{ total: number }>(),
  ]);
  return { rows: rows.results ?? [], total: count?.total ?? 0, limit: safeLimit, offset: safeOffset };
}

export async function readSportsDbArchive(archiveKey: string): Promise<Response | null> {
  if (!archiveKey.startsWith("sportsdb/v2/") || archiveKey.includes("..")) return null;
  const object = await getArchiveBucket().get(archiveKey);
  if (!object) return null;
  return new Response(object.body, {
    headers: {
      "content-type": object.httpMetadata?.contentType ?? "application/json; charset=utf-8",
      "content-length": String(object.size),
      "cache-control": "public, max-age=86400, stale-while-revalidate=604800",
      "x-content-type-options": "nosniff",
    },
  });
}

export async function querySportsDbRecords(input: {
  entityType: string;
  query?: string;
  parentId?: string;
  limit?: number;
  offset?: number;
}) {
  await ensureSportsDbSchema();
  const entityType = input.entityType.trim();
  if (!/^[a-z_]{1,40}$/.test(entityType)) throw new Error("Invalid sports data type");
  const limit = Math.max(1, Math.min(100, Math.floor(input.limit ?? 50)));
  const offset = Math.max(0, Math.min(100_000, Math.floor(input.offset ?? 0)));
  const where = ["entity_type = ?"];
  const params: unknown[] = [entityType];
  if (input.parentId) { where.push("parent_id = ?"); params.push(input.parentId.slice(0, 80)); }
  const query = input.query?.trim().slice(0, 100);
  if (query) {
    const field = entityType === "player_index" || entityType === "player"
      ? "strPlayer"
      : entityType.includes("team")
        ? "strTeam"
        : entityType.includes("league")
          ? "strLeague"
          : entityType.includes("event") || entityType.includes("livescore")
            ? "strEvent"
            : null;
    if (field) { where.push("json_extract(payload_json, '$." + field + "') LIKE ?"); params.push(`%${query}%`); }
  }
  const clause = where.join(" AND ");
  const [rows, count] = await Promise.all([
    db().prepare(`SELECT source_id, parent_id, season, payload_json, updated_at
      FROM sportsdb_records WHERE ${clause} ORDER BY source_id LIMIT ? OFFSET ?`)
      .bind(...params, limit, offset).all<{ source_id: string; parent_id: string; season: string; payload_json: string; updated_at: string }>(),
    db().prepare(`SELECT COUNT(*) as total FROM sportsdb_records WHERE ${clause}`)
      .bind(...params).first<{ total: number }>(),
  ]);
  return {
    entityType,
    rows: (rows.results ?? []).map((row) => ({
      sourceId: row.source_id,
      parentId: row.parent_id,
      season: row.season,
      updatedAt: row.updated_at,
      data: JSON.parse(row.payload_json) as Json,
    })),
    total: count?.total ?? 0,
    limit,
    offset,
  };
}

export async function getSportsDbPlayersForTeam(teamId: string) {
  await ensureSportsDbSchema();
  const rows = await db().prepare(`SELECT source_id, parent_id, season, payload_json, updated_at
    FROM sportsdb_records WHERE entity_type = 'player_index' AND parent_id = ?
    ORDER BY source_id LIMIT 200`)
    .bind(teamId).all<{ source_id: string; parent_id: string; season: string; payload_json: string; updated_at: string }>();
  return (rows.results ?? []).map((row) => ({
    sourceId: row.source_id,
    parentId: row.parent_id,
    season: row.season,
    updatedAt: row.updated_at,
    data: JSON.parse(row.payload_json) as Json,
  }));
}

export async function getSportsDbRecords(entityType: string, limit = 8_000) {
  await ensureSportsDbSchema();
  const safeLimit = Math.max(1, Math.min(20_000, Math.floor(limit)));
  const rows = await db().prepare(`SELECT source_id, parent_id, season, payload_json, updated_at
    FROM sportsdb_records WHERE entity_type = ? ORDER BY source_id LIMIT ?`)
    .bind(entityType, safeLimit).all<{ source_id: string; parent_id: string; season: string; payload_json: string; updated_at: string }>();
  return (rows.results ?? []).map((row) => ({
    sourceId: row.source_id,
    parentId: row.parent_id,
    season: row.season,
    updatedAt: row.updated_at,
    data: JSON.parse(row.payload_json) as Json,
  }));
}

