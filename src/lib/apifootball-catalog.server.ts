import type { TablesInsert } from "@/integrations/supabase/types";
import {
  apiFootballPlayerId,
  apiFootballProfileProjection,
  isFootballStaffRole,
} from "./apifootball-phases";
import { type AfImportResult } from "./apifootball-import.server";
import {
  type LeagueTarget,
  SOURCE,
  type TeamTarget,
  admin,
  af,
  afPage,
  mapPos,
  norm,
  pool,
  remainingQuota,
  saveRaw,
} from "./apifootball-client.server";

export type AfLeague = {
  league: { id: number; name: string; type: string; logo: string };
  country: { name: string; flag: string | null };
  seasons: { year: number; current: boolean; coverage?: Record<string, unknown> }[];
};

export async function importLeagues(): Promise<AfImportResult> {
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
    remainingQuota: remainingQuota(),
  };
}

export type AfVenue = {
  id: number;
  name?: string | null;
  city?: string | null;
  country?: string | null;
  capacity?: number | null;
  image?: string | null;
  team_id?: number;
};

export async function publishVenues(venues: AfVenue[]) {
  const rows = venues
    .filter(
      (venue) =>
        Number.isSafeInteger(venue.id) &&
        venue.id > 0 &&
        typeof venue.name === "string" &&
        venue.name.trim(),
    )
    .map((venue) => ({
      id: String(venue.id),
      name: venue.name!,
      city: venue.city ?? null,
      country: venue.country ?? null,
      capacity: venue.capacity ?? null,
      image: venue.image ?? null,
      team_id: venue.team_id ? String(venue.team_id) : null,
    }));
  if (!rows.length) return;
  const db = await admin();
  for (let index = 0; index < rows.length; index += 100) {
    const result = await db.rpc("enrich_football_venues", {
      p_venues: rows.slice(index, index + 100),
    });
    if (result.error) throw new Error("Official venues could not be materialized");
  }
}

export type AfTeam = {
  team: {
    id: number;
    name: string;
    code: string | null;
    country: string;
    founded: number | null;
    logo: string;
  };
  venue?: AfVenue | null;
};

export async function importTeams(
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
  const batch = await pool((leagues ?? []) as LeagueTarget[], 4, deadline, async (lg) => {
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
    const maps: (TablesInsert<"official_teams"> & { sport?: string })[] = [];
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
        sport: "Soccer",
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
    await publishVenues(
      teams.flatMap((row) =>
        row.venue ? [{ ...row.venue, country: row.team.country, team_id: row.team.id }] : [],
      ),
    );
    return true;
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
    remainingQuota: remainingQuota(),
  };
}

export type AfSquad = {
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

export async function importSquads(
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
  const batch = await pool((teams ?? []) as TeamTarget[], 4, deadline, async (t) => {
    let squad: AfSquad[];
    try {
      squad = await af<AfSquad>(`/players/squads?team=${t.source_id.slice(3)}`);
    } catch (e) {
      console.error("squad", t.source_id, e);
      throw e;
    }
    const players = (squad[0]?.players ?? []).filter(
      (p) => p && p.id && p.name && !isFootballStaffRole(p.position),
    );
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
          sync_status: "pending",
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
    return true;
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
    remainingQuota: remainingQuota(),
  };
}

export async function importVenues(
  offset: number,
  limit: number,
  deadline: number,
): Promise<AfImportResult> {
  const countries = (await af<{ name: string }>("/countries")).slice(offset, offset + limit);
  let created = 0;
  const batch = await pool(countries, 4, deadline, async (c) => {
    const v = await af<AfVenue>(`/venues?country=${encodeURIComponent(c.name)}`);
    if (!v.length) return false;
    created += await saveRaw(
      "venue",
      v.map((r) => ({ ref: String(r.id), payload: r })),
    );
    await publishVenues(v.map((venue) => ({ ...venue, country: venue.country ?? c.name })));
    return true;
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
    remainingQuota: remainingQuota(),
  };
}

export async function enrichProfiles(records: unknown[]): Promise<number> {
  const projected = records.flatMap((row) => {
    const profile = apiFootballProfileProjection(row);
    return profile ? [profile] : [];
  });
  const profiles = [...new Map(projected.map((profile) => [profile.source_id, profile])).values()];
  if (!profiles.length) return 0;
  const db = await admin();
  let changed = 0;
  for (let index = 0; index < profiles.length; index += 100) {
    const result = await db.rpc("enrich_existing_football_profiles", {
      p_profiles: profiles.slice(index, index + 100),
    });
    if (result.error) throw new Error("Existing player profiles could not be enriched");
    if (typeof result.data === "number") changed += result.data;
  }
  return changed;
}

export async function importPlayerProfiles(offset: number): Promise<AfImportResult> {
  // One provider page per lease; offset is a zero-based page checkpoint.
  const page = offset + 1;
  const body = await afPage<unknown>(`/players/profiles?page=${page}`);
  const total = body.paging?.total ?? page;
  if (
    !Number.isSafeInteger(total) ||
    total < page ||
    (body.paging?.current !== undefined && body.paging.current !== page)
  )
    throw new Error("Invalid profile page checkpoint");
  const rows = body.response.flatMap((payload) => {
    const id = apiFootballPlayerId(payload);
    return id ? [{ ref: id, payload }] : [];
  });
  const created = await saveRaw("player_profile", rows);
  const enriched = await enrichProfiles(body.response);
  return {
    ok: true,
    phase: "playerprofiles",
    processed: 1,
    created,
    linked: enriched,
    nextOffset: page < total ? offset + 1 : null,
    remainingQuota: remainingQuota(),
  };
}
