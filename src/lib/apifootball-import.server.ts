// Bulk, resumable API-Football import. Each call processes one bounded page
// (offset/limit) so a runner can walk the whole catalog under the daily quota.
// Mappings live in official_leagues/official_teams with an "af:" prefix so they
// never collide with the other provider's ids.

import type { TablesInsert } from "@/integrations/supabase/types";

const BASE = "https://v3.football.api-sports.io";
const SOURCE = "api-football";

export type Phase = "leagues" | "teams" | "squads" | "fixtures" | "standings" | "predictions" | "odds" | "stats";
export type AfImportResult = {
  ok: boolean;
  phase: Phase;
  processed: number;
  created: number;
  linked: number;
  nextOffset: number | null;
  remainingQuota?: number | null;
  error?: string;
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

let lastRemaining: number | null = null;
async function af<T>(path: string, attempt = 0): Promise<T[]> {
  const key = process.env["APIFOOTBALL_API_KEY"];
  if (!key) throw new Error("APIFOOTBALL_API_KEY missing");
  const res = await fetch(`${BASE}${path}`, { headers: { "x-apisports-key": key } });
  const rem = res.headers.get("x-ratelimit-requests-remaining");
  if (rem) lastRemaining = Number(rem);
  const text = await res.text();
  // Per-minute cap: back off and retry instead of silently skipping the item.
  if ((res.status === 429 || text.includes('"rateLimit"')) && attempt < 10) {
    await new Promise((r) => setTimeout(r, 4_000 + attempt * 1_000));
    return af<T>(path, attempt + 1);
  }
  if (!res.ok) throw new Error(`API-Football ${res.status}: ${text.slice(0, 300)}`);
  const body = JSON.parse(text) as { response?: T[]; errors?: unknown };
  const errs = body.errors;
  if (errs && !Array.isArray(errs) && Object.keys(errs).length) {
    throw new Error(`API-Football: ${JSON.stringify(errs)}`);
  }
  return body.response ?? [];
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

async function pool<T>(items: T[], n: number, deadline: number, fn: (t: T) => Promise<void>) {
  let i = 0;
  let done = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (i < items.length && Date.now() < deadline) {
        const item = items[i++]!;
        try {
          await fn(item);
        } catch (e) {
          console.error("af item failed", e);
        }
        done++;
      }
    }),
  );
  return done;
}

type AfLeague = {
  league: { id: number; name: string; type: string; logo: string };
  country: { name: string; flag: string | null };
  seasons: { year: number; current: boolean }[];
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
  team: { id: number; name: string; code: string | null; country: string; founded: number | null; logo: string };
  venue: { city: string | null };
};

async function importTeams(offset: number, limit: number, deadline: number): Promise<AfImportResult> {
  const db = await admin();
  const { data: leagues, error } = await db
    .from("official_leagues")
    .select("source_id, current_season, local_competition_id, country")
    .like("source_id", "af:%")
    .order("source_id")
    .range(offset, offset + limit - 1);
  if (error) throw new Error(error.message);

  let created = 0;
  let linked = 0;
  const done = await pool(leagues ?? [], 4, deadline, async (lg) => {
    if (!lg.current_season) return;
    const id = lg.source_id.slice(3);
    let teams: AfTeam[] = [];
    try {
      teams = await af<AfTeam>(`/teams?league=${id}&season=${lg.current_season}`);
    } catch (e) {
      console.error("teams", id, e);
      return;
    }
    if (!teams.length) return;
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
      .in("source_id", teams.map((t) => `af:${t.team.id}`));
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
      if (r.error) console.error("clubs", r.error.message);
      created += r.data?.length ?? 0;
    }
    const m = await db.from("official_teams").upsert(maps, { onConflict: "source_id" });
    if (m.error) console.error("map", m.error.message);
  });
  const fetched = leagues?.length ?? 0;
  return {
    ok: true,
    phase: "teams",
    processed: done,
    created,
    linked,
    nextOffset: fetched < limit && done === fetched ? null : offset + done,
    remainingQuota: lastRemaining,
  };
}

type AfSquad = {
  team: { id: number };
  players: { id: number; name: string; age: number | null; number: number | null; position: string; photo: string }[];
};

async function importSquads(offset: number, limit: number, deadline: number): Promise<AfImportResult> {
  const db = await admin();
  const { data: teams, error } = await db
    .from("official_teams")
    .select("source_id, local_club_id")
    .like("source_id", "af:%")
    .not("local_club_id", "is", null)
    .order("source_id")
    .range(offset, offset + limit - 1);
  if (error) throw new Error(error.message);

  let created = 0;
  const done = await pool(teams ?? [], 4, deadline, async (t) => {
    let squad: AfSquad[] = [];
    try {
      squad = await af<AfSquad>(`/players/squads?team=${t.source_id.slice(3)}`);
    } catch (e) {
      console.error("squad", t.source_id, e);
      return;
    }
    const players = (squad[0]?.players ?? []).filter((p) => p && p.id && p.name);
    if (!players.length) return;
    const { data: have } = await db
      .from("players")
      .select("source_id")
      .eq("source", SOURCE)
      .in("source_id", players.map((p) => String(p.id)));
    const seen = new Set((have ?? []).map((p) => p.source_id));
    const rows = players
      .filter((p) => p.name && !seen.has(String(p.id)))
      .map((p) => {
        const age = p.age && p.age > 14 && p.age < 50 ? p.age : 24;
        const overall = 55 + ((p.id * 7) % 15);
        return {
          club_id: t.local_club_id!,
          name: p.name.slice(0, 80),
          position: mapPos(p.position),
          age,
          shirt_number: p.number && p.number > 0 && p.number < 100 ? p.number : null,
          overall,
          potential: Math.min(95, overall + (age && age < 23 ? 10 : 3)),
          photo_url: p.photo,
          source: SOURCE,
          source_id: String(p.id),
          sync_status: "synced",
        };
      });
    if (!rows.length) return;
    const r = await db.from("players").insert(rows).select("id");
    if (r.error) console.error("players", r.error.message);
    created += r.data?.length ?? 0;
  });
  const fetched = teams?.length ?? 0;
  return {
    ok: true,
    phase: "squads",
    processed: done,
    created,
    linked: 0,
    nextOffset: fetched < limit && done === fetched ? null : offset + done,
    remainingQuota: lastRemaining,
  };
}


// ---- Extra phases: fixtures/standings/predictions/odds/player stats ----
type AfFixture = {
  fixture: { id: number; date: string; status: { short: string }; venue: { name: string | null; id: number | null } };
  league: { id: number; season: number };
  teams: { home: { id: number; name: string }; away: { id: number; name: string } };
  goals: { home: number | null; away: number | null };
};

async function leaguePage(offset: number, limit: number) {
  const db = await admin();
  const { data, error } = await db
    .from("official_leagues")
    .select("source_id, current_season")
    .like("source_id", "af:%")
    .order("source_id")
    .range(offset, offset + limit - 1);
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
    if (error) console.error("raw", kind, error.message);
    else n += chunk.length;
  }
  return n;
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
  const done = await pool(leagues, phase === "stats" ? 2 : 4, deadline, async (lg) => {
    if (!lg.current_season) return;
    created += await fn(lg.source_id.slice(3), lg.current_season);
  });
  return {
    ok: true,
    phase,
    processed: done,
    created,
    linked: 0,
    nextOffset: leagues.length < limit && done === leagues.length ? null : offset + done,
    remainingQuota: lastRemaining,
  };
}

async function fixturesFor(id: string, season: string) {
  const db = await admin();
  const list = await af<AfFixture>(`/fixtures?league=${id}&season=${season}`);
  const rows = list.map((f) => ({
    source_id: `af:${f.fixture.id}`,
    league_source_id: `af:${id}`,
    season,
    home_team_source_id: `af:${f.teams.home.id}`,
    away_team_source_id: `af:${f.teams.away.id}`,
    home_team_name: f.teams.home.name,
    away_team_name: f.teams.away.name,
    starts_at: f.fixture.date,
    home_score: f.goals.home,
    away_score: f.goals.away,
    status: f.fixture.status.short,
    venue_source_id: f.fixture.venue.id ? `af:${f.fixture.venue.id}` : null,
    venue_name: f.fixture.venue.name,
    updated_at: new Date().toISOString(),
  }));
  let n = 0;
  for (let k = 0; k < rows.length; k += 500) {
    const { error } = await db
      .from("official_events")
      .upsert(rows.slice(k, k + 500), { onConflict: "source_id" });
    if (error) console.error("fixtures", error.message);
    else n += Math.min(500, rows.length - k);
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
    const key = process.env["APIFOOTBALL_API_KEY"]!;
    let body: { response?: T[]; paging?: { total: number } } | null = null;
    for (let tries = 0; tries < 12; tries++) {
      const res = await fetch(`${BASE}${path}${sep}page=${page}`, { headers: { "x-apisports-key": key } });
      const rem = res.headers.get("x-ratelimit-requests-remaining");
      if (rem) lastRemaining = Number(rem);
      const text = await res.text();
      if (res.status === 429 || text.includes('"rateLimit"')) {
        await new Promise((r) => setTimeout(r, 4000 + tries * 1000));
        continue;
      }
      if (!res.ok) break;
      body = JSON.parse(text);
      break;
    }
    if (!body) break;
    out.push(...(body.response ?? []));
    if (!body.paging || page >= body.paging.total) break;
  }
  return out;
}

type AfPlayerStat = {
  player: { id: number; nationality: string | null; height: string | null; birth: { date: string | null } };
  statistics: unknown[];
};

async function statsFor(id: string, season: string) {
  const list = await pagedAll<AfPlayerStat>(`/players?league=${id}&season=${season}`, 200);
  return saveRaw(
    "player_stats",
    list.map((p) => ({ ref: `${p.player.id}:${id}:${season}`, payload: p })),
  );
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

async function importPredictions(offset: number, limit: number, deadline: number): Promise<AfImportResult> {
  const ids = await upcomingFixtureIds(7, offset, limit);
  let created = 0;
  const done = await pool(ids, 4, deadline, async (fid) => {
    const r = await af<unknown>(`/predictions?fixture=${fid}`);
    if (r.length) created += await saveRaw("prediction", [{ ref: fid, payload: r[0] }]);
  });
  return {
    ok: true, phase: "predictions", processed: done, created, linked: 0,
    nextOffset: ids.length < limit && done === ids.length ? null : offset + done,
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
    ok: true, phase: "odds", processed: 1, created, linked: 0,
    nextOffset: offset < 6 ? offset + 1 : null, remainingQuota: lastRemaining,
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
    if (opts.phase === "stats")
      return await perLeague("stats", opts.offset, opts.limit, deadline, statsFor);
    if (opts.phase === "predictions") return await importPredictions(opts.offset, opts.limit, deadline);
    if (opts.phase === "odds") return await importOdds(opts.offset, deadline);
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
