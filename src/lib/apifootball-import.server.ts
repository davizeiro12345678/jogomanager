// Bulk, resumable API-Football import. Each call processes one bounded page
// (offset/limit) so a runner can walk the whole catalog under the daily quota.
// Mappings live in official_leagues/official_teams with an "af:" prefix so they
// never collide with the other provider's ids.

const BASE = "https://v3.football.api-sports.io";
const SOURCE = "api-football";

type Phase = "leagues" | "teams" | "squads";
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

    const newClubs: Record<string, unknown>[] = [];
    const maps: Record<string, unknown>[] = [];
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
