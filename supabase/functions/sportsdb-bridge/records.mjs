export const SOURCE_URL =
  "https://stadium-stewards.davizeiro10-jogos.workers.dev/api/public/sportsdb";
export const PHASES = [
  "catalog",
  "leagues",
  "teams-index",
  "teams",
  "players",
  "schedules",
  "rounds",
  "tables",
  "events",
];
export const TYPES = [
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
];

const text = (value) =>
  typeof value === "string" || typeof value === "number" ? String(value) : "";
export function footballRecord(value) {
  const sport = text(value?.strSport).toLowerCase();
  return !sport || sport === "soccer";
}

export function sourceComplete(status) {
  return PHASES.every((phase) =>
    status.phases?.some((p) => p.phase === phase && p.complete === true),
  );
}

export function manifest(status) {
  if (status.source !== "TheSportsDB" || !Array.isArray(status.counts))
    throw new Error("Invalid source manifest");
  if (!Number.isSafeInteger(status.archive?.objects))
    throw new Error("Missing source archive inventory");
  return [
    ...status.counts
      .filter((c) => TYPES.includes(c.entity_type))
      .map((c) => ({
        entity_type: c.entity_type,
        source_total: c.records,
        fingerprint: `${c.records}:${c.updated_at ?? ""}`,
        priority: TYPES.indexOf(c.entity_type),
      })),
    {
      entity_type: "archive_catalog",
      source_total: status.archive.objects,
      fingerprint: String(status.archive.objects),
      priority: TYPES.length,
    },
  ];
}

export function pageRecords(entity, page) {
  if (
    page.entityType !== entity ||
    !Array.isArray(page.rows) ||
    !Number.isSafeInteger(page.total)
  ) {
    throw new Error("Invalid source page");
  }
  return page.rows
    .filter((row) => row.data && footballRecord(row.data))
    .map((row) => ({
      entity_type: entity,
      source_id: text(row.sourceId),
      parent_id: text(row.parentId),
      season: text(row.season),
      source_updated_at: row.updatedAt,
      payload: row.data,
    }));
}

// Archive names come from the source manifest, never from the incoming request.
export function archiveContext(key) {
  if (key.includes("..")) throw new Error("Invalid archive key");
  const match = /^sportsdb\/v2\/(.+)\/([^/]+)\/([^/]+)\/([^/]+)\.json$/.exec(key);
  if (!match) throw new Error("Invalid archive key");
  const [, endpoint, source, parent, season] = match;
  return {
    endpoint,
    source: source === "_" ? "" : source,
    parent: parent === "_" ? "" : parent,
    season: season === "_" ? "" : season,
  };
}

const ENDPOINTS = {
  "all/leagues": ["league_index", "idLeague"],
  "all/countries": ["country", "name_en"],
  "lookup/league": ["league", "idLeague"],
  "lookup/team": ["team", "idTeam"],
  "list/teams": ["team_index", "idTeam"],
  "list/seasons": ["season", "strSeason"],
  "list/players": ["player_index", "idPlayer"],
  "lookup/player": ["player", "idPlayer"],
  "lookup/team_equipment": ["equipment", "idEquipment"],
  "lookup/venue": ["venue", "idVenue"],
  "lookup/event": ["event", "idEvent"],
  "livescore/soccer": ["livescore", "idEvent"],
  lookuptable: ["table_row", "idTeam"],
  eventsround: ["event_index", "idEvent"],
};

export function isFootballArchive(key) {
  const { endpoint } = archiveContext(key);
  return (
    Object.hasOwn(ENDPOINTS, endpoint) ||
    endpoint.startsWith("schedule/") ||
    (/^lookup\/(event_|player_)/.test(endpoint) && TYPES.includes(endpoint.slice("lookup/".length)))
  );
}

export async function archiveRecords(key, payload, updatedAt) {
  if (payload && typeof payload === "object" && Object.hasOwn(payload, "error")) {
    throw new Error("Provider archive contains an error");
  }
  const context = archiveContext(key);
  const arrays = Object.values(payload ?? {}).filter(Array.isArray);
  let mapping = ENDPOINTS[context.endpoint];
  if (!mapping && context.endpoint.startsWith("schedule/")) mapping = ["event_index", "idEvent"];
  if (!mapping && /^lookup\/(event_|player_)/.test(context.endpoint)) {
    const type = context.endpoint.slice("lookup/".length);
    const keys = {
      event_lineup: "idLineup",
      event_results: "idResult",
      event_stats: "idStatistic",
      event_timeline: "idTimeline",
      event_tv: "id",
      event_highlights: "idEvent",
      player_contracts: "idContract",
      player_results: "idResult",
      player_honours: "id",
      player_milestones: "id",
      player_teams: "id",
      player_stats: "idStatistic",
    };
    if (TYPES.includes(type)) mapping = [type, keys[type]];
  }
  if (!mapping) throw new Error(`Unsupported archive endpoint: ${context.endpoint}`);
  const [entity, idField] = mapping;
  const rows = [];
  for (const data of arrays.flat().filter(footballRecord)) {
    if (!data || typeof data !== "object" || Array.isArray(data))
      throw new Error("Invalid archive record");
    let sourceId = text(data[idField]);
    if (!sourceId) {
      // Content identity for provider records without an ID; never presented as a provider ID.
      const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(JSON.stringify(data)),
      );
      sourceId =
        "sha256:" +
        Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
    }
    let parent = context.parent;
    if (context.endpoint === "list/teams" || context.endpoint === "list/seasons")
      parent ||= context.source;
    if (context.endpoint === "list/players") parent = text(data.idTeam) || context.source;
    if (/lookup\/(event_|player_)/.test(context.endpoint)) parent = context.source;
    rows.push({
      entity_type: entity,
      source_id: sourceId,
      parent_id: parent,
      season: context.season,
      source_updated_at: updatedAt,
      payload: data,
    });
  }
  return rows;
}
