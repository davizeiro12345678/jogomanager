/**
 * Server-only importer: seeds the football database from the bundled league
 * data and then enriches it with official crests / kit images / stadium data
 * from the public APIs.
 */
import { LEAGUES } from "@/game/data/leagues";
import {
  sdbSearchTeam,
  sdbSquad,
  apiFootballTeamId,
  apiFootballSquad,
  footballDataSquad,
} from "./football-api.server";

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

type ClubRow = { id: string; name: string; country: string | null; crest_url?: string | null };

/** Enrich a single club with crest / kit / stadium / external ids. */
async function enrichOne(db: Admin, club: ClubRow): Promise<boolean> {
  const remote = await sdbSearchTeam(club.name, club.country ?? undefined);
  if (!remote) return false;

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

  const externals = [
    remote.externalId ? { source: "thesportsdb", external_id: remote.externalId } : null,
    remote.apiFootballId ? { source: "api-football", external_id: remote.apiFootballId } : null,
  ].filter(Boolean) as { source: string; external_id: string }[];

  for (const e of externals) {
    await db
      .from("club_external_ids")
      .upsert({ club_id: club.id, ...e, confirmed: true }, { onConflict: "club_id,source" });
  }

  if (remote.kitUrl) {
    await db.from("kits").upsert(
      { club_id: club.id, season: "2025-2026", kind: "home", image_url: remote.kitUrl },
      { onConflict: "club_id,season,kind" },
    );
  }

  return true;
}

/** Run tasks with a bounded number of parallel workers, honouring a deadline. */
async function pool<T>(
  items: T[],
  concurrency: number,
  deadline: number,
  worker: (item: T) => Promise<void>,
) {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length && Date.now() < deadline) {
      const item = items[cursor++]!;
      try {
        await worker(item);
      } catch {
        /* keep going: one bad club must not stop the import */
      }
    }
  });
  await Promise.all(runners);
}

/**
 * Enrich clubs with official crest / kit / stadium data.
 * Runs several lookups in parallel and stops when the time budget runs out.
 */
export async function enrichClubs(limit = 400, offset = 0, concurrency = 8, budgetMs = 45_000) {
  const db = await admin();
  const { data: rows, error } = await db
    .from("clubs")
    .select("id, name, country, crest_url")
    .is("crest_url", null)
    .order("strength", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw new Error(error.message);

  const deadline = Date.now() + budgetMs;
  let imported = 0;
  const failures: string[] = [];

  await pool(rows ?? [], concurrency, deadline, async (club) => {
    const ok = await enrichOne(db, club);
    if (ok) imported += 1;
    else failures.push(club.name);
  });

  return { imported, scanned: rows?.length ?? 0, failures };
}


/** Import real squads for a batch of clubs, using whichever squad API has a key. */
export async function importSquads(limit = 200, offset = 0, concurrency = 6, budgetMs = 45_000) {
  const db = await admin();
  const { data: rows, error } = await db
    .from("clubs")
    .select("id, name, country")
    .order("strength", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw new Error(error.message);

  const deadline = Date.now() + budgetMs;
  let imported = 0;

  await pool(rows ?? [], concurrency, deadline, async (club) => {
    const { data: existing } = await db.from("players").select("id").eq("club_id", club.id).limit(1);
    if (existing && existing.length) return;

    const { data: ext } = await db
      .from("club_external_ids")
      .select("source, external_id")
      .eq("club_id", club.id);

    let players = [] as Awaited<ReturnType<typeof apiFootballSquad>>;
    const sdb = ext?.find((e) => e.source === "thesportsdb");
    if (sdb) players = await sdbSquad(sdb.external_id);

    if (!players.length) {
      const fd = ext?.find((e) => e.source === "football-data");
      if (fd) players = await footballDataSquad(fd.external_id);
    }

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

    if (!players.length) return;

    const rowsToInsert = players.slice(0, 30).map((p) => ({
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
  });

  return { imported };
}

/**
 * One-shot importer: seeds every bundled competition/club, enriches as many
 * clubs as fit in the time budget, then pulls squads for the same batch.
 */
export async function importEverything(opts: {
  limit?: number;
  offset?: number;
  concurrency?: number;
  budgetMs?: number;
  squads?: boolean;
}) {
  const limit = opts.limit ?? 600;
  const offset = opts.offset ?? 0;
  const concurrency = opts.concurrency ?? 8;
  const total = opts.budgetMs ?? 90_000;
  const started = Date.now();

  const seeded = await seedFromBundledData();
  const enrichBudget = opts.squads === false ? total : Math.floor(total * 0.6);
  const enriched = await enrichClubs(
    limit,
    offset,
    concurrency,
    Math.max(5_000, enrichBudget - (Date.now() - started)),
  );

  let squads = { imported: 0 };
  if (opts.squads !== false) {
    const left = total - (Date.now() - started);
    if (left > 5_000) squads = await importSquads(limit, offset, Math.max(4, concurrency - 2), left);
  }

  return {
    seeded,
    clubsEnriched: enriched.imported,
    clubsScanned: enriched.scanned,
    playersImported: squads.imported,
    failures: enriched.failures.slice(0, 25),
    elapsedMs: Date.now() - started,
  };
}

export async function runSync(opts: {
  scope?: string;
  limit?: number;
  offset?: number;
  concurrency?: number;
  budgetMs?: number;
}) {
  const db = await admin();
  const scope = opts.scope ?? "clubs";
  const { data: run } = await db
    .from("import_runs")
    .insert({ source: "multi", scope, status: "running" })
    .select("id")
    .maybeSingle();

  try {
    let items = 0;
    let detail: unknown = null;
    if (scope === "seed") {
      const r = await seedFromBundledData();
      items = r.clubs;
    } else if (scope === "squads") {
      items = (await importSquads(opts.limit ?? 200, opts.offset ?? 0, opts.concurrency ?? 6, opts.budgetMs ?? 45_000)).imported;
    } else if (scope === "all") {
      const r = await importEverything(opts);
      detail = r;
      items = r.clubsEnriched + r.playersImported;
    } else {
      items = (await enrichClubs(opts.limit ?? 400, opts.offset ?? 0, opts.concurrency ?? 8, opts.budgetMs ?? 45_000)).imported;
    }
    if (run?.id) {
      await db
        .from("import_runs")
        .update({ status: "done", items_imported: items, finished_at: new Date().toISOString() })
        .eq("id", run.id);
    }
    return { ok: true as const, scope, items, detail };
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
