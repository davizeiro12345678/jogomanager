import { FIXTURE_ENDPOINTS, type Phase } from "./apifootball-phases";
import type { AfImportResult } from "./apifootball-import.server";
import {
  SOURCE,
  admin,
  af,
  afPage,
  guardedFootballFetch,
  importScope,
  leaguePage,
  pagedAll,
  pool,
  remainingQuota,
  saveRaw,
  seasonOf,
  sourceHasNoCoverage,
} from "./apifootball-client.server";
import { enrichProfiles } from "./apifootball-catalog.server";

// ---- Extra phases: fixtures/standings/predictions/odds/player stats ----
export type AfFixture = {
  fixture: {
    id: number;
    date: string;
    status: { short: string };
    venue: { name: string | null; id: number | null };
  };
  league: { id: number; season: number };
  teams: { home: { id: number; name: string }; away: { id: number; name: string } };
  goals: { home: number | null; away: number | null };
};

export async function fixturesFor(id: string, season: string) {
  const db = await admin();
  const list = await af<AfFixture>(`/fixtures?league=${id}&season=${season}`);
  // API-Football can supply null venue/score objects for unplayed fixtures.
  // One incomplete match must not abort a complete league-season import.
  const mapped = list
    .filter((f) => f?.fixture?.id && f.fixture.date && f?.teams?.home?.id && f?.teams?.away?.id)
    .map((f) => ({
      source_id: `af:${f.fixture.id}`,
      league_source_id: `af:${id}`,
      season,
      home_team_source_id: `af:${f.teams.home.id}`,
      away_team_source_id: `af:${f.teams.away.id}`,
      home_team_name: f.teams.home.name ?? "",
      away_team_name: f.teams.away.name ?? "",
      starts_at: f.fixture.date,
      home_score: f.goals?.home ?? null,
      away_score: f.goals?.away ?? null,
      status: f.fixture.status?.short ?? "NS",
      venue_source_id: f.fixture.venue?.id ? `af:${f.fixture.venue.id}` : null,
      venue_name: f.fixture.venue?.name ?? null,
      updated_at: new Date().toISOString(),
    }));
  const rows = [...new Map(mapped.map((row) => [row.source_id, row])).values()];
  let n = 0;
  for (let k = 0; k < rows.length; k += 500) {
    const { error } = await db
      .from("official_events")
      .upsert(rows.slice(k, k + 500), { onConflict: "source_id" });
    if (error) throw new Error(error.message);
    n += Math.min(500, rows.length - k);
  }
  return n;
}

export async function standingsFor(id: string, season: string) {
  const r = await af<unknown>(`/standings?league=${id}&season=${season}`);
  return r.length ? saveRaw("standings", [{ ref: `${id}:${season}`, payload: r }]) : 0;
}

export type AfPlayerStat = {
  player: {
    id: number;
    nationality: string | null;
    height: string | null;
    birth: { date: string | null };
  };
  statistics: unknown[];
};

export async function statsFor(id: string, season: string, deadline: number) {
  const db = await admin();
  const target = `af:${id}`;
  const { data: checkpoint, error } = await db
    .from("api_football_page_progress")
    .select("next_page")
    .eq("phase", "stats")
    .eq("target_id", target)
    .eq("season", season)
    .maybeSingle();
  if (error) throw new Error(error.message);

  let page = checkpoint?.next_page ?? 1;
  let written = 0;
  let pages = 0;
  // Four API pages at a time keeps the invocation within the short cron lease.
  while (pages < 4 && Date.now() + 5_000 < deadline) {
    if (page > 200) throw new Error(`Player statistics exceed 200 pages for ${target}`);
    const response = await afPage<AfPlayerStat>(
      `/players?league=${id}&season=${season}&page=${page}`,
    );
    const rows = response.response
      .filter((p) => p.player?.id)
      .map((p) => ({ ref: `${p.player.id}:${id}:${season}`, payload: p }));
    written += await saveRaw("player_stats", rows);
    await enrichProfiles(response.response);
    const total = Math.max(1, response.paging?.total ?? 1);
    if (page >= total) {
      const removed = await db
        .from("api_football_page_progress")
        .delete()
        .eq("phase", "stats")
        .eq("target_id", target)
        .eq("season", season);
      if (removed.error) throw new Error(removed.error.message);
      return { written, complete: true };
    }
    page++;
    // Retried pages are upserts: safe even if a crash occurred between
    // saving the payload and writing this checkpoint.
    const saved = await db.from("api_football_page_progress").upsert(
      {
        phase: "stats",
        target_id: target,
        season,
        next_page: page,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "phase,target_id,season" },
    );
    if (saved.error) throw new Error(saved.error.message);
    pages++;
  }
  return { written, complete: false };
}

export async function importStats(offset: number, deadline: number): Promise<AfImportResult> {
  // Exactly one league per call: page progress and global target progress
  // are separate checkpoints, so a partially fetched league never disappears.
  const [league] = await leaguePage(offset, 1);
  if (!league)
    return {
      ok: true,
      phase: "stats",
      processed: 0,
      created: 0,
      linked: 0,
      nextOffset: null,
      remainingQuota: remainingQuota(),
    };
  if (!league.current_season || sourceHasNoCoverage(league.coverage, "stats"))
    return {
      ok: true,
      phase: "stats",
      processed: 1,
      created: 0,
      linked: 0,
      skipped: 1,
      nextOffset: offset + 1,
      remainingQuota: remainingQuota(),
    };
  const result = await statsFor(league.source_id.slice(3), league.current_season, deadline);
  return {
    ok: true,
    phase: "stats",
    processed: result.complete ? 1 : 0,
    created: result.written,
    linked: 0,
    skipped: result.complete && result.written === 0 ? 1 : 0,
    nextOffset: result.complete ? offset + 1 : offset,
    remainingQuota: remainingQuota(),
  };
}

export async function upcomingFixtureIds(days: number, offset: number, limit: number) {
  const db = await admin();
  const now = new Date();
  const end = new Date(now.getTime() + days * 86400_000);
  const { data } = await db
    .from("official_events")
    .select("source_id")
    .like("source_id", "af:%")
    .gte("starts_at", now.toISOString())
    .lte("starts_at", end.toISOString())
    .order("source_id")
    .range(offset, offset + limit - 1);
  return (data ?? []).map((r) => r.source_id.slice(3));
}

export async function importPredictions(
  offset: number,
  limit: number,
  deadline: number,
): Promise<AfImportResult> {
  const ids = await upcomingFixtureIds(7, offset, limit);
  let created = 0;
  const batch = await pool(ids, 4, deadline, async (fid) => {
    const r = await af<unknown>(`/predictions?fixture=${fid}`);
    if (!r.length) return false;
    created += await saveRaw("prediction", [{ ref: fid, payload: r[0] }]);
    return true;
  });
  return {
    ok: true,
    phase: "predictions",
    processed: batch.done,
    created,
    linked: 0,
    skipped: batch.skipped,
    nextOffset: ids.length < limit && batch.done === ids.length ? null : offset + batch.done,
    remainingQuota: remainingQuota(),
  };
}

export async function importOdds(offset: number, deadline: number): Promise<AfImportResult> {
  // offset = day index from today (0..6); one date per call, all pages.
  if (offset > 6 || Date.now() > deadline) {
    return { ok: true, phase: "odds", processed: 0, created: 0, linked: 0, nextOffset: null };
  }
  const date = new Date(Date.now() + offset * 86400_000).toISOString().slice(0, 10);
  const list = await pagedAll<{ fixture: { id: number } }>(`/odds?date=${date}`, 200);
  const created = await saveRaw(
    "odds",
    list.map((o) => ({ ref: String(o.fixture.id), payload: o })),
  );
  return {
    ok: true,
    phase: "odds",
    processed: 1,
    created,
    linked: 0,
    nextOffset: offset < 6 ? offset + 1 : null,
    remainingQuota: remainingQuota(),
  };
}

// ---- Reference + depth phases (countries, venues, coaches, injuries, team stats, match details) ----
export async function importSimple(
  phase: Phase,
  path: string,
  kind: string,
  refOf: (r: unknown) => string,
): Promise<AfImportResult> {
  const list = await af<unknown>(path);
  const created = await saveRaw(
    kind,
    list.map((r) => ({ ref: refOf(r), payload: r })),
  );
  return {
    ok: true,
    phase,
    processed: 1,
    created,
    linked: 0,
    nextOffset: null,
    remainingQuota: remainingQuota(),
  };
}

export async function coachesFor(team: string) {
  const r = await af<{ id: number }>(`/coachs?team=${team}`);
  return saveRaw(
    "coach",
    r.map((c) => ({ ref: `${c.id}`, payload: c })),
  );
}

export async function teamStatsFor(team: string, league: string | null) {
  if (!league) return 0;
  const season = await seasonOf(league);
  if (!season) return 0;
  const res = await guardedFootballFetch(
    `/teams/statistics?team=${team}&league=${league}&season=${season}`,
  );
  const rem = res.headers.get("x-ratelimit-requests-remaining");
  if (rem && Number.isFinite(Number(rem))) importScope.getStore()!.remaining = Number(rem);
  if (!res.ok) throw new Error(`API-Football team stats returned HTTP ${res.status}`);
  const body = (await res.json()) as { response?: unknown };
  return body.response && !Array.isArray(body.response)
    ? saveRaw("team_stats", [{ ref: `${team}:${league}:${season}`, payload: body.response }])
    : 0;
}

export async function injuriesFor(id: string, season: string) {
  const r = await af<{ player: { id: number }; fixture: { id: number } }>(
    `/injuries?league=${id}&season=${season}`,
  );
  return saveRaw(
    "injury",
    r.map((x) => ({ ref: `${x.player.id}:${x.fixture.id}`, payload: x })),
  );
}

// Finished fixtures, 20 per request: events, lineups, team stats and player ratings in one payload.
export async function importDetails(
  offset: number,
  limit: number,
  deadline: number,
): Promise<AfImportResult> {
  const db = await admin();
  const { data, error } = await db
    .from("official_events")
    .select("source_id")
    .like("source_id", "af:%")
    .in("status", ["FT", "AET", "PEN"])
    .order("source_id")
    .range(offset, offset + limit - 1);
  if (error) throw new Error(error.message);
  const ids = (data ?? []).map((r) => r.source_id.slice(3));
  const batches: string[][] = [];
  for (let k = 0; k < ids.length; k += 20) batches.push(ids.slice(k, k + 20));
  let created = 0;
  let doneIds = 0;
  const batch = await pool(batches, 4, deadline, async (b) => {
    const r = await af<{ fixture: { id: number } }>(`/fixtures?ids=${b.join("-")}`);
    if (!r.length) {
      doneIds += b.length;
      return false;
    }
    created += await saveRaw(
      "fixture_detail",
      r.map((f) => ({ ref: String(f.fixture.id), payload: f })),
    );
    doneIds += b.length;
    return true;
  });
  return {
    ok: true,
    phase: "details",
    processed: doneIds,
    created,
    linked: 0,
    skipped: batch.skipped,
    nextOffset: ids.length < limit && doneIds === ids.length ? null : offset + doneIds,
    remainingQuota: remainingQuota(),
  };
}

export async function importPlayerRecords(
  phase: "playerseasons" | "trophies" | "sidelined",
  offset: number,
  limit: number,
  deadline: number,
): Promise<AfImportResult> {
  const db = await admin();
  // Canonical aliases hide duplicate people in the game, but their provider
  // IDs still own historical records and must remain ingestion targets.
  const targets = await db
    .from("players")
    .select("source_id")
    .eq("source", SOURCE)
    .eq("source_kind", "player")
    .not("source_id", "is", null)
    .order("source_id")
    .range(offset, offset + limit - 1);
  if (targets.error) throw new Error(targets.error.message);
  let created = 0;
  const endpoint = phase === "playerseasons" ? "/players/seasons" : `/${phase}`;
  const kind = phase === "playerseasons" ? "player_season" : phase;
  const batch = await pool(targets.data ?? [], 2, deadline, async (target) => {
    if (!target.source_id || !/^\d+$/.test(target.source_id)) return false;
    const list = await af<unknown>(`${endpoint}?player=${target.source_id}`);
    if (!list.length) return false;
    // A single stable parent record retains every career entry, including
    // repeated trophies in different seasons, without index-based identities.
    created += await saveRaw(kind, [{ ref: `player:${target.source_id}`, payload: list }]);
    return true;
  });
  return {
    ok: true,
    phase,
    processed: batch.done,
    created,
    linked: 0,
    skipped: batch.skipped,
    nextOffset:
      (targets.data?.length ?? 0) < limit && batch.done === (targets.data?.length ?? 0)
        ? null
        : offset + batch.done,
    remainingQuota: remainingQuota(),
  };
}

export async function importFixtureRecords(
  phase: keyof typeof FIXTURE_ENDPOINTS,
  offset: number,
  limit: number,
  deadline: number,
): Promise<AfImportResult> {
  const db = await admin();
  const targets = await db
    .from("official_events")
    .select("source_id")
    .like("source_id", "af:%")
    .in("status", ["FT", "AET", "PEN"])
    .order("source_id")
    .range(offset, offset + limit - 1);
  if (targets.error) throw new Error(targets.error.message);
  let created = 0;
  const kinds = {
    fixtureevents: "fixture_events",
    fixturelineups: "fixture_lineups",
    fixturestatistics: "fixture_statistics",
    fixtureplayers: "fixture_players",
  } as const;
  const batch = await pool(targets.data ?? [], 2, deadline, async (target) => {
    const id = target.source_id.slice(3);
    if (!/^\d+$/.test(id)) return false;
    const list = await af<unknown>(`${FIXTURE_ENDPOINTS[phase]}?fixture=${id}`);
    if (!list.length) return false;
    created += await saveRaw(kinds[phase], [{ ref: id, payload: list }]);
    return true;
  });
  return {
    ok: true,
    phase,
    processed: batch.done,
    created,
    linked: 0,
    skipped: batch.skipped,
    nextOffset:
      (targets.data?.length ?? 0) < limit && batch.done === (targets.data?.length ?? 0)
        ? null
        : offset + batch.done,
    remainingQuota: remainingQuota(),
  };
}
