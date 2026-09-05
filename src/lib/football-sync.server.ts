/**
 * Server-only importer: seeds the football database from the bundled league
 * data and then enriches it with official crests / kit images / stadium data
 * from the public APIs.
 */
import { LEAGUES } from "@/game/data/leagues";
import { sdbSearchTeam, apiFootballTeamId, apiFootballSquad, footballDataSquad } from "./football-api.server";

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

async function admin(): Promise<Admin> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Push every bundled competition + club into the database (idempotent). */
export async function seedFromBundledData() {
  const db = await admin();
  const competitions = LEAGUES.map((l) => ({
    id: l.id,
    name: l.name,
    country: l.country,
    flag: l.flag,
    club_count: l.clubs.length,
  }));
  const clubs = LEAGUES.flatMap((l) =>
    l.clubs.map((c) => ({
      id: c.id,
      competition_id: l.id,
      name: c.name,
      short_name: c.short,
      country: l.country,
      primary_color: c.primary,
      secondary_color: c.secondary,
      strength: c.strength,
    })),
  );

  const compRes = await db.from("competitions").upsert(competitions, { onConflict: "id" });
  if (compRes.error) throw new Error(compRes.error.message);

  for (let i = 0; i < clubs.length; i += 100) {
    const chunk = clubs.slice(i, i + 100);
    const res = await db.from("clubs").upsert(chunk, { onConflict: "id" });
    if (res.error) throw new Error(res.error.message);
  }
  return { competitions: competitions.length, clubs: clubs.length };
}

/**
 * Enrich a batch of clubs with official crest / kit / stadium data.
 * Batched because the free API tiers are rate limited.
 */
export async function enrichClubs(limit = 40, offset = 0) {
  const db = await admin();
  const { data: rows, error } = await db
    .from("clubs")
    .select("id, name, country, crest_url")
    .order("strength", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw new Error(error.message);

  let imported = 0;
  const failures: string[] = [];

  for (const club of rows ?? []) {
    if (club.crest_url) continue;
    const remote = await sdbSearchTeam(club.name, club.country ?? undefined);
    if (!remote) {
      failures.push(club.name);
      continue;
    }

    let stadiumId: string | null = null;
    if (remote.stadium) {
      const { data: st } = await db
        .from("stadiums")
        .upsert(
          {
            name: remote.stadium,
            city: remote.city ?? null,
            country: remote.country ?? club.country,
            capacity: remote.stadiumCapacity ?? null,
          },
          { onConflict: "name" },
        )
        .select("id")
        .maybeSingle();
      stadiumId = st?.id ?? null;
    }

    await db
      .from("clubs")
      .update({
        crest_url: remote.crestUrl ?? null,
        founded: remote.founded ?? null,
        city: remote.city ?? null,
        ...(stadiumId ? { stadium_id: stadiumId } : {}),
      })
      .eq("id", club.id);

    if (remote.externalId) {
      await db
        .from("club_external_ids")
        .upsert(
          { club_id: club.id, source: "thesportsdb", external_id: remote.externalId, confirmed: true },
          { onConflict: "club_id,source" },
        );
    }

    if (remote.apiFootballId) {
      await db
        .from("club_external_ids")
        .upsert(
          {
            club_id: club.id,
            source: "api-football",
            external_id: remote.apiFootballId,
            confirmed: true,
          },
          { onConflict: "club_id,source" },
        );
    }

    if (remote.kitUrl) {
      await db.from("kits").upsert(
        {
          club_id: club.id,
          season: "2025-2026",
          kind: "home",
          image_url: remote.kitUrl,
        },
        { onConflict: "club_id,season,kind" },
      );
    }

    imported += 1;
  }

  return { imported, scanned: rows?.length ?? 0, failures };
}

/** Import real squads for a batch of clubs, using whichever squad API has a key. */
export async function importSquads(limit = 10, offset = 0) {
  const db = await admin();
  const { data: rows, error } = await db
    .from("clubs")
    .select("id, name, country")
    .order("strength", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw new Error(error.message);

  let imported = 0;
  for (const club of rows ?? []) {
    const { data: existing } = await db.from("players").select("id").eq("club_id", club.id).limit(1);
    if (existing && existing.length) continue;

    const { data: ext } = await db
      .from("club_external_ids")
      .select("source, external_id")
      .eq("club_id", club.id);

    let players = [] as Awaited<ReturnType<typeof apiFootballSquad>>;
    const fd = ext?.find((e) => e.source === "football-data");
    if (fd) players = await footballDataSquad(fd.external_id);

    if (!players.length) {
      const af =
        ext?.find((e) => e.source === "api-football")?.external_id ??
        (await apiFootballTeamId(club.name, club.country ?? undefined));
      if (af) {
        players = await apiFootballSquad(af);
        await db
          .from("club_external_ids")
          .upsert(
            { club_id: club.id, source: "api-football", external_id: af, confirmed: true },
            { onConflict: "club_id,source" },
          );
      }
    }

    if (!players.length) continue;

    const rowsToInsert = players.slice(0, 26).map((p) => ({
      club_id: club.id,
      name: p.name,
      position: p.position,
      age: p.age ?? 24,
      shirt_number: p.shirtNumber ?? null,
      nationality: p.nationality ?? null,
      photo_url: p.photoUrl ?? null,
      source: p.source,
    }));
    const res = await db.from("players").insert(rowsToInsert);
    if (!res.error) imported += rowsToInsert.length;
  }
  return { imported };
}

export async function runSync(opts: { scope?: string; limit?: number; offset?: number }) {
  const db = await admin();
  const scope = opts.scope ?? "clubs";
  const { data: run } = await db
    .from("import_runs")
    .insert({ source: "multi", scope, status: "running" })
    .select("id")
    .maybeSingle();

  try {
    let items = 0;
    if (scope === "seed") {
      const r = await seedFromBundledData();
      items = r.clubs;
    } else if (scope === "squads") {
      items = (await importSquads(opts.limit ?? 10, opts.offset ?? 0)).imported;
    } else {
      items = (await enrichClubs(opts.limit ?? 40, opts.offset ?? 0)).imported;
    }
    if (run?.id) {
      await db
        .from("import_runs")
        .update({ status: "done", items_imported: items, finished_at: new Date().toISOString() })
        .eq("id", run.id);
    }
    return { ok: true as const, scope, items };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (run?.id) {
      await db
        .from("import_runs")
        .update({ status: "error", error: message, finished_at: new Date().toISOString() })
        .eq("id", run.id);
    }
    return { ok: false as const, scope, error: message };
  }
}
