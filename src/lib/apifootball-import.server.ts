// Bulk, resumable API-Football import. Each call processes one bounded page
// (offset/limit) so a runner can walk the whole catalog under the daily quota.
// Mappings live in official_leagues/official_teams with an "af:" prefix so they
// never collide with the other provider's ids.

import type { TablesInsert } from "@/integrations/supabase/types";

const BASE = "https://v3.football.api-sports.io";
const SOURCE = "api-football";

export type Phase =
  | "leagues"
  | "teams"
  | "squads"
  | "fixtures"
  | "standings"
  | "predictions"
  | "odds"
  | "stats"
  | "countries"
  | "timezones"
  | "venues"
  | "coaches"
  | "injuries"
  | "teamstats"
  | "details";
export type AfImportResult = {
  ok: boolean;
  phase: Phase;
  processed: number;
  created: number;
  linked: number;
  skipped?: number;
  nextOffset: number | null;
  remainingQuota?: number | null;
  error?: string;
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

let lastRemaining: number | null = null;

/** Every outbound API-Football request reserves a global database quota token. */
async function guardedFootballFetch(path: string): Promise<Response> {
  const key = process.env["APIFOOTBALL_API_KEY"];
  if (!key) throw new Error("API-Football server credential is not configured");
  const db = await admin();
  const quota = await db.rpc("reserve_api_football_quota");
  if (quota.error || quota.data !== true) {
    throw new Error(`API-Football quota blocked: ${quota.error?.message ?? "no token"}`);
  }
  return fetch(`${BASE}${path}`, {
    headers: { "x-apisports-key": key },
    signal: AbortSignal.timeout(20_000),
  });
}

/**
 * Read and validate one API-Football response. A missing record (404) is not
 * fatal to the surrounding batch; auth, schema and upstream errors are.
 */
type ApiFootballPage<T> = {
  response: T[];
  paging?: { current?: number; total?: number };
};

async function afPage<T>(path: string): Promise<ApiFootballPage<T>> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await guardedFootballFetch(path);
    const rem = res.headers.get("x-ratelimit-requests-remaining");
    if (rem !== null && Number.isFinite(Number(rem))) lastRemaining = Number(rem);
    const text = await res.text();
    const limited = res.status === 429 || /"rateLimit"/i.test(text);
    if ((limited || res.status >= 500) && attempt < 2) {
      const hint = Number(res.headers.get("retry-after"));
      const delay =
        Number.isFinite(hint) && hint > 0 ? Math.min(8_000, hint * 1_000) : 2_000 * (attempt + 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
      continue;
    }
    if (res.status === 404) return { response: [] };
    if (!res.ok) throw new Error(`API-Football HTTP ${res.status}: ${text.slice(0, 200)}`);
    let body: {
      response?: unknown;
      errors?: unknown;
      paging?: { current?: number; total?: number };
    };
    try {
      body = JSON.parse(text) as typeof body;
    } catch {
      throw new Error("API-Football returned invalid JSON");
    }
    if (body.errors && typeof body.errors === "object" && Object.keys(body.errors).length > 0) {
      throw new Error(`API-Football provider error: ${JSON.stringify(body.errors).slice(0, 200)}`);
    }
    if (!Array.isArray(body.response)) {
      throw new Error("API-Football returned an unexpected response shape");
    }
    return { response: body.response as T[], ...(body.paging ? { paging: body.paging } : {}) };
  }
  throw new Error("API-Football retry limit exceeded");
}

async function af<T>(path: string): Promise<T[]> {
  return (await afPage<T>(path)).response;
}

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

function mapPos(p?: string) {
  if (!p) return "MF";
  if (p.startsWith("Goal")) return "GK";
  if (p.startsWith("Def")) return "DF";
  if (p.startsWith("Att")) return "FW";
  return "MF";
}

/**
 * Missing data is a skip, not a failed batch. True failures preserve the
 * checkpoint so the job can retry without silently losing an item.
 */
async function pool<T>(
  items: T[],
  n: number,
  deadline: number,
  fn: (t: T) => Promise<boolean | void>,
): Promise<{ done: number; skipped: number }> {
  let i = 0;
  let done = 0;
  let skipped = 0;
  const failures: string[] = [];
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (i < items.length && Date.now() < deadline) {
        const item = items[i++]!;
        try {
          if ((await fn(item)) === false) skipped++;
        } catch (e) {
          failures.push(e instanceof Error ? e.message : String(e));
        }
        done++;
      }
    }),
  );
  if (failures.length) {
    throw new Error(`API-Football batch: ${failures.length} failed items; first: ${failures[0]}`);
  }
  return { done, skipped };
}

type AfLeague = {
  league: { id: number; name: string; type: string; logo: string };
  country: { name: string; flag: string | null };
  seasons: { year: number; current: boolean; coverage?: Record<string, unknown> }[];
};

async function importLeagues(): Promise<AfImportResult> {
  const db = await admin();
  const rows = await af<AfLeague>("/leagues");
  let created = 0;
  for (let k = 0; k < rows.length; k += 200) {
    const chunk = rows.slice(k, k + 200);
    const comps = chunk.map((r) => ({
      id: `af${r.league.id}`,
      name: r.league.name.slice(0, 120),
      country: r.country.name,
      flag: r.country.flag ?? "",
      tier: 1,
      club_count: 0,
      logo_url: r.league.logo,
      external_source: SOURCE,
      external_id: String(r.league.id),
      source_id: String(r.league.id),
      kind: r.league.type === "Cup" ? "national_cup" : "league",
      sync_status: "synced",
    }));
    const { data, error } = await db
      .from("competitions")
      .upsert(comps, { onConflict: "id", ignoreDuplicates: true })
      .select("id");
    if (error) throw new Error(error.message);
    created += data?.length ?? 0;
    const off = chunk.map((r) => {
      const seasons = r.seasons ?? [];
      const cur = seasons.find((s) => s.current) ?? seasons[seasons.length - 1];
      return {
        source_id: `af:${r.league.id}`,
        name: r.league.name,
        sport: "Soccer",
        country: r.country.name,
        current_season: cur ? String(cur.year) : null,
        local_competition_id: `af${r.league.id}`,
        updated_at: new Date().toISOString(),
      };
    });
    const up = await db.from("official_leagues").upsert(off, { onConflict: "source_id" });
    if (up.error) throw new Error(up.error.message);
    const covered = chunk.flatMap((r) => {
      const seasons = r.seasons ?? [];
      const current = seasons.find((season) => season.current) ?? seasons[seasons.length - 1];
      return current
        ? [
            {
              league_source_id: `af:${r.league.id}`,
              season: String(current.year),
              coverage: (current.coverage ?? {}) as never,
              updated_at: new Date().toISOString(),
            },
          ]
        : [];
    });
    if (covered.length) {
      const saved = await db
        .from("api_football_season_coverage")
        .upsert(covered, { onConflict: "league_source_id,season" });
      if (saved.error) throw new Error(saved.error.message);
    }
  }
  return {
    ok: true,
    phase: "leagues",
    processed: rows.length,
    created,
    linked: rows.length,
    nextOffset: null,
    remainingQuota: lastRemaining,
  };
}

type AfTeam = {
  team: {
    id: number;
    name: string;
    code: string | null;
    country: string;
    founded: number | null;
    logo: string;
  };
  venue: { city: string | null };
};

async function importTeams(
  offset: number,
  limit: number,
  deadline: number,
): Promise<AfImportResult> {
  const db = await admin();
  const { data: leagues, error } = await db.rpc("list_api_football_league_targets", {
    p_offset: offset,
    p_limit: limit,
  });
  if (error) throw new Error(error.message);

  let created = 0;
  let linked = 0;
  const batch = await pool(leagues ?? [], 4, deadline, async (lg) => {
    if (!lg.current_season) return false;
    const id = lg.source_id.slice(3);
    let teams: AfTeam[];
    try {
      teams = await af<AfTeam>(`/teams?league=${id}&season=${lg.current_season}`);
    } catch (e) {
      console.error("teams", id, e);
      throw e;
    }
    if (!teams.length) return false;
    const country = teams[0]!.team.country;
    const { data: existing } = await db
      .from("clubs")
      .select("id, name")
      .eq("country", country)
      .limit(5000);
    const byName = new Map((existing ?? []).map((c) => [norm(c.name), c.id]));
    const { data: already } = await db
      .from("official_teams")
      .select("source_id, local_club_id")
      .in(
        "source_id",
        teams.map((t) => `af:${t.team.id}`),
      );
    const known = new Map((already ?? []).map((r) => [r.source_id, r.local_club_id]));

    const newClubs: TablesInsert<"clubs">[] = [];
    const maps: TablesInsert<"official_teams">[] = [];
    for (const t of teams) {
      const sid = `af:${t.team.id}`;
      let local = known.get(sid) ?? byName.get(norm(t.team.name)) ?? null;
      if (!local) {
        local = `af${t.team.id}`;
        newClubs.push({
          id: local,
          competition_id: lg.local_competition_id,
          name: t.team.name.slice(0, 80),
          short_name: (t.team.code ?? t.team.name.slice(0, 3)).toUpperCase().slice(0, 4),
          full_name: t.team.name,
          city: t.venue?.city ?? null,
          country: t.team.country,
          founded: t.team.founded,
          primary_color: "#1f4fa0",
          secondary_color: "#ffffff",
          strength: 55,
          crest_url: t.team.logo,
          data_source: SOURCE,
          source_id: String(t.team.id),
          sync_status: "synced",
        });
      } else if (!known.has(sid)) {
        linked++;
      }
      maps.push({
        source_id: sid,
        league_source_id: lg.source_id,
        name: t.team.name,
        local_club_id: local,
        updated_at: new Date().toISOString(),
      });
    }
    if (newClubs.length) {
      const r = await db
        .from("clubs")
        .upsert(newClubs, { onConflict: "id", ignoreDuplicates: true })
        .select("id");
      if (r.error) throw new Error(r.error.message);
      created += r.data?.length ?? 0;
    }
    const m = await db.from("official_teams").upsert(maps, { onConflict: "source_id" });
    if (m.error) throw new Error(m.error.message);
  });
  const fetched = leagues?.length ?? 0;
  return {
    ok: true,
    phase: "teams",
    processed: batch.done,
    created,
    linked,
    skipped: batch.skipped,
    nextOffset: fetched < limit && batch.done === fetched ? null : offset + batch.done,
    remainingQuota: lastRemaining,
  };
}

type AfSquad = {
  team: { id: number };
  players: {
    id: number;
    name: string;
    age: number | null;
    number: number | null;
    position: string;
    photo: string;
  }[];
};

async function importSquads(
  offset: number,
  limit: number,
  deadline: number,
): Promise<AfImportResult> {
  const db = await admin();
  const { data: teams, error } = await db.rpc("list_api_football_team_targets", {
    p_offset: offset,
    p_limit: limit,
    p_squads_only: true,
  });
  if (error) throw new Error(error.message);

  let created = 0;
  const batch = await pool(teams ?? [], 4, deadline, async (t) => {
    let squad: AfSquad[];
    try {
      squad = await af<AfSquad>(`/players/squads?team=${t.source_id.slice(3)}`);
    } catch (e) {
      console.error("squad", t.source_id, e);
      throw e;
    }
    const players = (squad[0]?.players ?? []).filter((p) => p && p.id && p.name);
    if (!players.length) return false;
    const rows = players
      .filter((p) => p.name)
      .map((p) => {
        const age = p.age && p.age > 14 && p.age < 50 ? p.age : 24;
        // Squads have no measured OVR: neutral placeholder, never fake an ID-based rating.
        const overall = 55;
        return {
          club_id: t.local_club_id!,
          name: p.name.slice(0, 80),
          position: mapPos(p.position),
          age,
          shirt_number: p.number && p.number > 0 && p.number < 100 ? p.number : null,
          overall,
          potential: Math.min(95, overall + (age && age < 23 ? 10 : 3)),
          photo_url: p.photo || null,
          source: SOURCE,
          source_id: String(p.id),
          sync_status: "partial",
        };
      });
    // Squads may list the same athlete twice, or another worker may insert
    // the player concurrently. Deduplicate before one conflict-safe upsert.
    const unique = [...new Map(rows.map((r) => [r.source_id, r])).values()];
    if (!unique.length) return false;
    // One atomic statement per bounded squad; no N per-player retries.
    // Existing records (including manually reviewed ratings) are preserved.
    const r = await db
      .from("players")
      .upsert(unique, {
        onConflict: "source,source_id",
        ignoreDuplicates: true,
      })
      .select("id");
    if (r.error) throw new Error(`Squad upsert failed: ${r.error.message}`);
    created += r.data?.length ?? 0;
  });
  const fetched = teams?.length ?? 0;
  return {
    ok: true,
    phase: "squads",
    processed: batch.done,
    created,
    linked: 0,
    skipped: batch.skipped,
    nextOffset: fetched < limit && batch.done === fetched ? null : offset + batch.done,
    remainingQuota: lastRemaining,
  };
}

// ---- Extra phases: fixtures/standings/predictions/odds/player stats ----
type AfFixture = {
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

async function leaguePage(offset: number, limit: number) {
  const db = await admin();
  const { data, error } = await db.rpc("list_api_football_league_targets", {
    p_offset: offset,
    p_limit: limit,
  });
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function saveRaw(kind: string, rows: { ref: string; payload: unknown }[]) {
  if (!rows.length) return 0;
  rows = [...new Map(rows.map((r) => [r.ref, r])).values()];
  const db = await admin();
  let n = 0;
  for (let k = 0; k < rows.length; k += 100) {
    const chunk = rows.slice(k, k + 100).map((r) => ({
      kind,
      ref: r.ref,
      payload: r.payload as never,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await db.from("api_football_data").upsert(chunk, { onConflict: "kind,ref" });
    if (error) throw new Error(error.message);
    n += chunk.length;
  }
  return n;
}

function sourceHasNoCoverage(coverage: unknown, phase: Phase): boolean {
  if (!coverage || typeof coverage !== "object" || Array.isArray(coverage)) return false;
  const c = coverage as Record<string, unknown>;
  if (phase === "standings") return c["standings"] === false;
  if (phase === "injuries") return c["injuries"] === false;
  if (phase === "stats") return c["players"] === false;
  return false;
}

async function perLeague(
  phase: Phase,
  offset: number,
  limit: number,
  deadline: number,
  fn: (id: string, season: string) => Promise<number>,
): Promise<AfImportResult> {
  const leagues = await leaguePage(offset, limit);
  let created = 0;
  // Paginated phases (stats) stay sequential to respect the per-minute cap.
  const batch = await pool(leagues, phase === "stats" ? 2 : 4, deadline, async (lg) => {
    if (!lg.current_season || sourceHasNoCoverage(lg.coverage, phase)) return false;
    const written = await fn(lg.source_id.slice(3), lg.current_season);
    created += written;
    if (written === 0) return false;
  });
  return {
    ok: true,
    phase,
    processed: batch.done,
    created,
    linked: 0,
    skipped: batch.skipped,
    nextOffset:
      leagues.length < limit && batch.done === leagues.length ? null : offset + batch.done,
    remainingQuota: lastRemaining,
  };
}

async function fixturesFor(id: string, season: string) {
  const db = await admin();
  const list = await af<AfFixture>(`/fixtures?league=${id}&season=${season}`);
  // API-Football can supply null venue/score objects for unplayed fixtures.
  // One incomplete match must not abort a complete league-season import.
  const rows = list
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

async function standingsFor(id: string, season: string) {
  const r = await af<unknown>(`/standings?league=${id}&season=${season}`);
  return r.length ? saveRaw("standings", [{ ref: `${id}:${season}`, payload: r }]) : 0;
}

async function pagedAll<T>(path: string, maxPages: number) {
  const out: T[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const sep = path.includes("?") ? "&" : "?";
    const body = await afPage<T>(`${path}${sep}page=${page}`);
    out.push(...body.response);
    const total = body.paging?.total ?? 1;
    if (page >= total) return out;
  }
  // Silent truncation makes a partially imported league look complete.
  throw new Error(`API-Football pagination exceeded ${maxPages} pages: ${path}`);
}

type AfPlayerStat = {
  player: {
    id: number;
    nationality: string | null;
    height: string | null;
    birth: { date: string | null };
  };
  statistics: unknown[];
};

async function statsFor(id: string, season: string, deadline: number) {
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

async function importStats(offset: number, deadline: number): Promise<AfImportResult> {
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
      remainingQuota: lastRemaining,
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
      remainingQuota: lastRemaining,
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
    remainingQuota: lastRemaining,
  };
}

async function upcomingFixtureIds(days: number, offset: number, limit: number) {
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

async function importPredictions(
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
  });
  return {
    ok: true,
    phase: "predictions",
    processed: batch.done,
    created,
    linked: 0,
    skipped: batch.skipped,
    nextOffset: ids.length < limit && batch.done === ids.length ? null : offset + batch.done,
    remainingQuota: lastRemaining,
  };
}

async function importOdds(offset: number, deadline: number): Promise<AfImportResult> {
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
    remainingQuota: lastRemaining,
  };
}

// ---- Reference + depth phases (countries, venues, coaches, injuries, team stats, match details) ----
async function importSimple(
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
    remainingQuota: lastRemaining,
  };
}

async function importVenues(
  offset: number,
  limit: number,
  deadline: number,
): Promise<AfImportResult> {
  const countries = (await af<{ name: string }>("/countries")).slice(offset, offset + limit);
  let created = 0;
  const batch = await pool(countries, 4, deadline, async (c) => {
    const v = await af<{ id: number }>(`/venues?country=${encodeURIComponent(c.name)}`);
    if (!v.length) return false;
    created += await saveRaw(
      "venue",
      v.map((r) => ({ ref: String(r.id), payload: r })),
    );
  });
  return {
    ok: true,
    phase: "venues",
    processed: batch.done,
    created,
    linked: 0,
    skipped: batch.skipped,
    nextOffset:
      countries.length < limit && batch.done === countries.length ? null : offset + batch.done,
    remainingQuota: lastRemaining,
  };
}

async function teamPage(offset: number, limit: number) {
  const db = await admin();
  const { data, error } = await db.rpc("list_api_football_team_targets", {
    p_offset: offset,
    p_limit: limit,
    p_squads_only: false,
  });
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function perTeam(
  phase: Phase,
  offset: number,
  limit: number,
  deadline: number,
  fn: (team: string, league: string | null) => Promise<number>,
): Promise<AfImportResult> {
  const teams = await teamPage(offset, limit);
  let created = 0;
  const batch = await pool(teams, 4, deadline, async (t) => {
    const written = await fn(
      t.source_id.slice(3),
      t.league_source_id?.startsWith("af:") ? t.league_source_id.slice(3) : null,
    );
    created += written;
    if (written === 0) return false;
  });
  return {
    ok: true,
    phase,
    processed: batch.done,
    created,
    linked: 0,
    skipped: batch.skipped,
    nextOffset: teams.length < limit && batch.done === teams.length ? null : offset + batch.done,
    remainingQuota: lastRemaining,
  };
}

const seasonCache = new Map<string, string | null>();
async function seasonOf(league: string) {
  if (seasonCache.has(league)) return seasonCache.get(league)!;
  const db = await admin();
  const { data } = await db
    .from("official_leagues")
    .select("current_season")
    .eq("source_id", `af:${league}`)
    .maybeSingle();
  seasonCache.set(league, data?.current_season ?? null);
  return data?.current_season ?? null;
}

async function coachesFor(team: string) {
  const r = await af<{ id: number }>(`/coachs?team=${team}`);
  return saveRaw(
    "coach",
    r.map((c) => ({ ref: `${c.id}`, payload: c })),
  );
}

async function teamStatsFor(team: string, league: string | null) {
  if (!league) return 0;
  const season = await seasonOf(league);
  if (!season) return 0;
  const res = await guardedFootballFetch(
    `/teams/statistics?team=${team}&league=${league}&season=${season}`,
  );
  const rem = res.headers.get("x-ratelimit-requests-remaining");
  if (rem) lastRemaining = Number(rem);
  if (!res.ok) throw new Error(`API-Football team stats returned HTTP ${res.status}`);
  const body = (await res.json()) as { response?: unknown };
  return body.response && !Array.isArray(body.response)
    ? saveRaw("team_stats", [{ ref: `${team}:${league}:${season}`, payload: body.response }])
    : 0;
}

async function injuriesFor(id: string, season: string) {
  const r = await af<{ player: { id: number }; fixture: { id: number } }>(
    `/injuries?league=${id}&season=${season}`,
  );
  return saveRaw(
    "injury",
    r.map((x) => ({ ref: `${x.player.id}:${x.fixture.id}`, payload: x })),
  );
}

// Finished fixtures, 20 per request: events, lineups, team stats and player ratings in one payload.
async function importDetails(
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
  });
  return {
    ok: true,
    phase: "details",
    processed: doneIds,
    created,
    linked: 0,
    skipped: batch.skipped,
    nextOffset: ids.length < limit && doneIds === ids.length ? null : offset + doneIds,
    remainingQuota: lastRemaining,
  };
}

export async function runApiFootballImport(opts: {
  phase: Phase;
  offset: number;
  limit: number;
  budgetMs: number;
}): Promise<AfImportResult> {
  const deadline = Date.now() + opts.budgetMs;
  try {
    if (opts.phase === "leagues") return await importLeagues();
    if (opts.phase === "teams") return await importTeams(opts.offset, opts.limit, deadline);
    if (opts.phase === "fixtures")
      return await perLeague("fixtures", opts.offset, opts.limit, deadline, fixturesFor);
    if (opts.phase === "standings")
      return await perLeague("standings", opts.offset, opts.limit, deadline, standingsFor);
    if (opts.phase === "stats") return await importStats(opts.offset, deadline);
    if (opts.phase === "predictions")
      return await importPredictions(opts.offset, opts.limit, deadline);
    if (opts.phase === "odds") return await importOdds(opts.offset, deadline);
    if (opts.phase === "countries")
      return await importSimple("countries", "/countries", "country", (r) =>
        String((r as { name?: unknown }).name ?? ""),
      );
    if (opts.phase === "timezones")
      return await importSimple("timezones", "/timezone", "timezone", (r) => String(r));
    if (opts.phase === "venues") return await importVenues(opts.offset, opts.limit, deadline);
    if (opts.phase === "coaches")
      return await perTeam("coaches", opts.offset, opts.limit, deadline, coachesFor);
    if (opts.phase === "teamstats")
      return await perTeam("teamstats", opts.offset, opts.limit, deadline, teamStatsFor);
    if (opts.phase === "injuries")
      return await perLeague("injuries", opts.offset, opts.limit, deadline, injuriesFor);
    if (opts.phase === "details") return await importDetails(opts.offset, opts.limit, deadline);
    return await importSquads(opts.offset, opts.limit, deadline);
  } catch (e) {
    return {
      ok: false,
      phase: opts.phase,
      processed: 0,
      created: 0,
      linked: 0,
      nextOffset: opts.offset,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
