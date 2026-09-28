/**
 * Server-only importer: seeds the football database from the bundled league
 * data and then enriches it with official crests / kit images / stadium data
 * from the public APIs.
 */
import { LEAGUES } from "@/game/data/leagues";
import { makeRng } from "@/game/rng";
import {
  sdbSearchTeam,
  sdbAllTeams,
  sdbSearchLeague,
  sdbSquad,
  footballDataSquad,
  sdbTeamKits,
  sdbTeamHonours,
  type RemotePlayer,
} from "./football-api.server";
import { validateRemotePlayers } from "./football-ingestion-validation";

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

const FICTIONAL_POSITIONS = [
  "GK",
  "GK",
  "GK",
  "DF",
  "DF",
  "DF",
  "DF",
  "DF",
  "DF",
  "DF",
  "DF",
  "MF",
  "MF",
  "MF",
  "MF",
  "MF",
  "MF",
  "MF",
  "MF",
  "FW",
  "FW",
  "FW",
  "FW",
  "FW",
] as const;

/**
 * Reserva legal para clubes sem elenco nas fontes gratuitas. Os atletas são
 * determinísticos e explicitamente fictícios; nunca simulam identidades reais.
 */
export function generatedSquad(clubId: string, country: string | null): RemotePlayer[] {
  const random = makeRng(`free-squad:${clubId}`);
  return FICTIONAL_POSITIONS.map((position, index) => ({
    source: "generated-fictional",
    externalId: `${clubId}-fictional-${index + 1}`,
    name: `Jogador fictício ${String(index + 1).padStart(2, "0")}`,
    position,
    age: 18 + Math.floor(random() * 17),
    shirtNumber: index + 1,
    nationality: country ?? "Internacional",
  }));
}

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
          photo_url: remote.stadiumPhotoUrl ?? remote.stadiumPhoto ?? null,
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
      ...(remote.crestUrl ? { crest_url: remote.crestUrl } : {}),
      ...(remote.website
        ? {
            website: remote.website
              .replace(/^https?:\/\//, "")
              .replace(/^www\./, "")
              .split("/")[0],
          }
        : {}),
      ...(remote.founded ? { founded: remote.founded } : {}),
      ...(remote.city ? { city: remote.city } : {}),
      ...(remote.description ? { description: remote.description } : {}),
      data_source: "thesportsdb",
      data_updated_at: new Date().toISOString(),
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
    await db
      .from("kits")
      .upsert(
        { club_id: club.id, season: "2025-2026", kind: "home", image_url: remote.kitUrl },
        { onConflict: "club_id,season,kind" },
      );
  }

  if (remote.externalId) {
    const equipment = await sdbTeamKits(remote.externalId);
    if (equipment.length) {
      await db.from("kits").upsert(
        equipment.map((item) => ({
          club_id: club.id,
          season: item.season,
          kind: item.kind,
          image_url: item.imageUrl,
        })),
        { onConflict: "club_id,season,kind" },
      );
    }
    const honours = await sdbTeamHonours(remote.externalId);
    if (honours.length) {
      await db.from("club_honours").upsert(
        honours.map((honour) => ({
          club_id: club.id,
          competition: honour.competition,
          title_count: honour.count,
          seasons: honour.seasons,
          source: "thesportsdb",
          external_id: honour.externalId ?? null,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: "club_id,competition,source" },
      );
    }
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

/** Our competition id -> the league name TheSportsDB indexes teams under. */
const SDB_LEAGUE: Record<string, string> = {
  bra: "Brazilian Serie A",
  bra2: "Brazilian Serie B",
  eng: "English Premier League",
  eng2: "English League Championship",
  esp: "Spanish La Liga",
  esp2: "Spanish La Liga 2",
  ita: "Italian Serie A",
  ita2: "Italian Serie B",
  ger: "German Bundesliga",
  ger2: "German 2. Bundesliga",
  fra: "French Ligue 1",
  fra2: "French Ligue 2",
  por: "Portuguese Primeira Liga",
  ned: "Dutch Eredivisie",
  bel: "Belgian Pro League",
  tur: "Turkish Super Lig",
  sco: "Scottish Premier League",
  arg: "Argentinian Primera Division",
  mex: "Mexican Primera League",
  usa: "American Major League Soccer",
  sau: "Saudi Pro League",
  jpn: "Japanese J1 League",
  gre: "Greek Superleague Greece",
  sui: "Swiss Super League",
  aut: "Austrian Football Bundesliga",
  den: "Danish Superliga",
  nor: "Norwegian Eliteserien",
  swe: "Swedish Allsvenskan",
  pol: "Polish Ekstraklasa",
  ukr: "Ukrainian Premier League",
  chi: "Chile Primera Division",
  col: "Colombian Primera A",
  uru: "Uruguayan Primera Division",
  aus: "Australian A-League",
  kor: "South Korean K League 1",
  egy: "Egyptian Premier League",
  hrv: "Croatian 1. HNL",
  srb: "Serbian SuperLiga",
  cze: "Czech Fortuna Liga",
  rou: "Romanian Liga I",
  per: "Peruvian Primera Division",
  ecu: "Ecuadorian Serie A",
  par: "Paraguayan Primera Division",
  bol: "Bolivian Primera Division",
  nga: "Nigerian Premier League",
  rsa: "South African Premier Division",
  mar: "Moroccan Botola Pro",
  qat: "Qatar Stars League",
  uae: "UAE Arabian Gulf League",
  tha: "Thai League 1",
  idn: "Indonesian Liga 1",
  rus: "Russian Football Premier League",
  isr: "Israeli Premier League",
  hun: "Hungarian NB I",
  bul: "Bulgarian A PFG",
  svk: "Slovakian Super Liga",
  svn: "Slovenian PrvaLiga",
  cyp: "Cypriot First Division",
  irl: "Irish Premier Division",
  fin: "Finnish Veikkausliiga",
  isl: "Icelandic Ur.deild karla",
  ven: "Venezuelan Primera Division",
  crc: "Costa Rican Primera Division",
  ind: "Indian Super League",
  chn: "Chinese Super League",
  mas: "Malaysian Super League",
  vie: "Vietnamese V League 1",
  alg: "Algerian Ligue 1",
  tun: "Tunisian Ligue Professionnelle 1",
  gha: "Ghanaian Premier League",
  ken: "Kenyan Premier League",
  ang: "Angolan Girabola",
  por2: "Portuguese Segunda Liga",
  ned2: "Dutch Eerste Divisie",
  bra3: "Brazilian Serie C",
  arg2: "Argentinian Primera B Nacional",
  tur2: "Turkish 1. Lig",
  sco2: "Scottish Championship",
  can: "Canadian Premier League",
};

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(fc|cf|sc|ac|afc|cd|club|de|do|da|of|the)\b/g, "")
    .replace(/[^a-z0-9]/g, "");

/**
 * Bulk import: one request per league brings back every team with its crest,
 * kit and stadium, which we then match against the bundled clubs locally.
 */
export async function importLeagues(budgetMs = 60_000, concurrency = 4) {
  const db = await admin();
  const deadline = Date.now() + budgetMs;
  let matched = 0;
  let fetchedTeams = 0;
  const unmatched: string[] = [];

  await pool(LEAGUES, concurrency, deadline, async (league) => {
    const sdbName = SDB_LEAGUE[league.id];
    if (!sdbName) return;

    try {
      const logo = await sdbSearchLeague(sdbName);
      if (logo) {
        await db.from("competitions").update({ logo_url: logo }).eq("id", league.id);
      }
    } catch {
      /* ignore league logo failures */
    }

    const remote = await sdbAllTeams(sdbName);
    if (!remote.length) return;
    fetchedTeams += remote.length;

    const index = new Map<string, (typeof remote)[number]>();
    for (const t of remote) {
      index.set(norm(t.name), t);
      for (const alt of (t.alternate ?? "").split(",")) {
        const k = norm(alt);
        if (k.length > 3 && !index.has(k)) index.set(k, t);
      }
    }

    for (const club of league.clubs) {
      const key = norm(club.name);
      let hit = index.get(key);
      if (!hit) {
        hit = remote.find((t) => {
          const n = norm(t.name);
          return n.includes(key) || key.includes(n);
        });
      }
      if (!hit) {
        unmatched.push(club.name);
        continue;
      }

      let stadiumId: string | null = null;
      if (hit.stadium) {
        const { data: st } = await db
          .from("stadiums")
          .upsert(
            {
              name: hit.stadium,
              city: hit.city ?? null,
              country: hit.country ?? league.country,
              capacity: hit.stadiumCapacity ?? null,
              photo_url: hit.stadiumPhotoUrl ?? hit.stadiumPhoto ?? null,
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
          ...(hit.crestUrl ? { crest_url: hit.crestUrl } : {}),
          ...(hit.founded ? { founded: hit.founded } : {}),
          ...(hit.city ? { city: hit.city } : {}),
          ...(hit.description ? { description: hit.description } : {}),
          data_source: "thesportsdb",
          data_updated_at: new Date().toISOString(),
          ...(stadiumId ? { stadium_id: stadiumId } : {}),
        })
        .eq("id", club.id);

      if (hit.externalId) {
        await db.from("club_external_ids").upsert(
          {
            club_id: club.id,
            source: "thesportsdb",
            external_id: hit.externalId,
            confirmed: true,
          },
          { onConflict: "club_id,source" },
        );
      }
      if (hit.apiFootballId) {
        await db.from("club_external_ids").upsert(
          {
            club_id: club.id,
            source: "api-football",
            external_id: hit.apiFootballId,
            confirmed: true,
          },
          { onConflict: "club_id,source" },
        );
      }
      if (hit.kitUrl) {
        await db
          .from("kits")
          .upsert(
            { club_id: club.id, season: "2025-2026", kind: "home", image_url: hit.kitUrl },
            { onConflict: "club_id,season,kind" },
          );
      }
      if (hit.externalId && Date.now() < deadline) {
        try {
          const equipment = await sdbTeamKits(hit.externalId);
          if (equipment.length) {
            await db.from("kits").upsert(
              equipment.map((item) => ({
                club_id: club.id,
                season: item.season,
                kind: item.kind,
                image_url: item.imageUrl,
              })),
              { onConflict: "club_id,season,kind" },
            );
          }
        } catch {
          // O uniforme principal e os outros clubes ainda podem ser importados.
        }
        try {
          const honours = await sdbTeamHonours(hit.externalId);
          if (honours.length) {
            await db.from("club_honours").upsert(
              honours.map((honour) => ({
                club_id: club.id,
                competition: honour.competition,
                title_count: honour.count,
                seasons: honour.seasons,
                source: "thesportsdb",
                external_id: honour.externalId ?? null,
                updated_at: new Date().toISOString(),
              })),
              { onConflict: "club_id,competition,source" },
            );
          }
        } catch {
          // A ausência de honrarias não invalida escudo, estádio ou uniformes.
        }
      }
      matched += 1;
    }
  });

  return { matched, fetchedTeams, unmatched };
}

/** Importa fontes gratuitas primeiro e garante cobertura com reservas fictícios rotulados. */
export async function importSquads(limit = 200, offset = 0, concurrency = 6, budgetMs = 45_000) {
  const db = await admin();

  // Clubes que já têm elenco: buscados uma vez para não gastar o lote em quem
  // já está pronto (antes o lote batia sempre nos mesmos clubes fortes).
  const withPlayers = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data } = await db
      .from("players")
      .select("club_id")
      .range(from, from + 999);
    if (!data?.length) break;
    for (const r of data) if (r.club_id) withPlayers.add(r.club_id);
    if (data.length < 1000) break;
  }

  // Varre os clubes por força até juntar `limit` candidatos sem elenco.
  const rows: { id: string; name: string; country: string | null; strength: number | null }[] = [];
  for (let from = offset; rows.length < limit; from += 500) {
    const { data, error } = await db
      .from("clubs")
      .select("id, name, country, strength")
      .order("strength", { ascending: false })
      .range(from, from + 499);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    for (const c of data) {
      if (!withPlayers.has(c.id)) rows.push(c as (typeof rows)[number]);
      if (rows.length >= limit) break;
    }
    if (data.length < 500) break;
  }

  const deadline = Date.now() + budgetMs;
  let imported = 0;
  let rejected = 0;

  await pool(rows, concurrency, deadline, async (club) => {
    const { data: ext } = await db
      .from("club_external_ids")
      .select("source, external_id")
      .eq("club_id", club.id);

    let players: RemotePlayer[] = [];
    const sdb = ext?.find((e) => e.source === "thesportsdb");
    if (sdb) players = await sdbSquad(sdb.external_id);

    if (!players.length) {
      const fd = ext?.find((e) => e.source === "football-data");
      if (fd) players = await footballDataSquad(fd.external_id);
    }

    if (!players.length) players = generatedSquad(club.id, club.country);

    const validation = validateRemotePlayers(players);
    rejected += validation.rejected.length;
    players = validation.accepted;
    // Se uma fonte remota devolveu apenas dados inválidos, usa o elenco
    // fictício determinístico em vez de inserir uma equipe incompleta.
    if (!players.length)
      players = validateRemotePlayers(generatedSquad(club.id, club.country)).accepted;

    const rowsToInsert = players.slice(0, 30).map((p) => {
      const base = club.strength ?? 70;
      const random = makeRng(`${club.id}:${p.externalId}`);
      const variation = Math.floor(random() * 12) - 6; // -6 to +5
      const ovr = Math.min(99, Math.max(45, base + variation));
      return {
        club_id: club.id,
        name: p.name,
        position: p.position,
        age: p.age ?? 24,
        shirt_number: p.shirtNumber ?? null,
        nationality: p.nationality ?? null,
        photo_url: p.photoUrl ?? null,
        overall: ovr,
        source: p.source,
      };
    });
    const res = await db.from("players").insert(rowsToInsert);
    if (!res.error) imported += rowsToInsert.length;
  });

  return { imported, rejected };
}

/** Importa biografia e honrarias mesmo para clubes que já possuem escudo. */
export async function importClubHeritage(
  limit = 120,
  offset = 0,
  concurrency = 4,
  budgetMs = 45_000,
) {
  const db = await admin();
  const { data: ids, error } = await db
    .from("club_external_ids")
    .select("club_id, external_id")
    .eq("source", "thesportsdb")
    .eq("confirmed", true)
    .order("club_id")
    .range(offset, offset + limit - 1);
  if (error) throw new Error(error.message);

  const deadline = Date.now() + budgetMs;
  let clubsUpdated = 0;
  let honoursImported = 0;
  await pool(ids ?? [], concurrency, deadline, async (external) => {
    const { data: club } = await db
      .from("clubs")
      .select("id, name, country, description")
      .eq("id", external.club_id)
      .maybeSingle();
    if (!club) return;

    const [remote, honours] = await Promise.all([
      club.description
        ? Promise.resolve(null)
        : sdbSearchTeam(club.name, club.country ?? undefined),
      sdbTeamHonours(external.external_id),
    ]);
    if (remote?.description) {
      const result = await db
        .from("clubs")
        .update({
          description: remote.description,
          data_source: "thesportsdb",
          data_updated_at: new Date().toISOString(),
        })
        .eq("id", club.id);
      if (!result.error) clubsUpdated += 1;
    }
    if (honours.length) {
      const result = await db.from("club_honours").upsert(
        honours.map((honour) => ({
          club_id: club.id,
          competition: honour.competition,
          title_count: honour.count,
          seasons: honour.seasons,
          source: "thesportsdb",
          external_id: honour.externalId ?? null,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: "club_id,competition,source" },
      );
      if (!result.error) honoursImported += honours.length;
    }
  });
  return { scanned: ids?.length ?? 0, clubsUpdated, honoursImported };
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
  const limit = opts.limit ?? 900;
  const offset = opts.offset ?? 0;
  const concurrency = opts.concurrency ?? 8;
  const total = opts.budgetMs ?? 120_000;
  const started = Date.now();
  const left = () => total - (Date.now() - started);

  const seeded = await seedFromBundledData();

  // 1) Bulk pass: one API request per league covers every club in it.
  const bulk = await importLeagues(Math.min(Math.floor(total * 0.4), Math.max(5_000, left())), 4);

  // 2) Fill the gaps club by club for whatever the bulk pass missed.
  const enrichBudget = opts.squads === false ? left() : Math.floor(left() * 0.6);
  const enriched = await enrichClubs(limit, offset, concurrency, Math.max(5_000, enrichBudget));

  let squads = { imported: 0 };
  if (opts.squads !== false && left() > 5_000) {
    squads = await importSquads(limit, offset, Math.max(4, concurrency - 2), left());
  }

  return {
    seeded,
    bulkMatched: bulk.matched,
    bulkTeamsFetched: bulk.fetchedTeams,
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
  leagueId?: string;
  season?: string;
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
    if (scope === "premium-chain") {
      const { syncPremiumChain } = await import("./premium-chain.server");
      const phase = opts.phase;
      if (!phase) throw new Error("Premium phase required");
      const r = await syncPremiumChain({ phase, limit: opts.limit ?? 20, offset: opts.offset ?? 0, budgetMs: opts.budgetMs ?? 45_000, leagueId: opts.leagueId, season: opts.season });
      detail = r;
      items = r.imported;
    } else if (scope === "seed") {
      const r = await seedFromBundledData();
      items = r.clubs;
    } else if (scope === "premium") {
      const { premiumSyncSquads } = await import("./premium-sync.server");
      const r = await premiumSyncSquads(opts.limit ?? 40, opts.offset ?? 0, opts.budgetMs ?? 45_000);
      detail = r;
      items = r.inserted + r.updated;
    } else if (scope === "stats") {
      const { premiumSyncStats } = await import("./premium-sync.server");
      const r = await premiumSyncStats(opts.limit ?? 400, opts.offset ?? 0, opts.budgetMs ?? 45_000, opts.concurrency ?? 8);
      detail = r;
      items = r.seasons;
    } else if (scope === "career") {
      const { premiumSyncPlayerCareer } = await import("./premium-sync.server");
      const r = await premiumSyncPlayerCareer(opts.limit ?? 2000, opts.offset ?? 0, opts.budgetMs ?? 50_000, opts.concurrency ?? 8);
      detail = r;
      items = r.honours + r.clubs;
    } else if (scope === "squads") {
      items = (
        await importSquads(
          opts.limit ?? 200,
          opts.offset ?? 0,
          opts.concurrency ?? 6,
          opts.budgetMs ?? 45_000,
        )
      ).imported;
    } else if (scope === "history") {
      const r = await importClubHeritage(
        opts.limit ?? 120,
        opts.offset ?? 0,
        Math.min(4, opts.concurrency ?? 4),
        opts.budgetMs ?? 45_000,
      );
      detail = r;
      items = r.clubsUpdated + r.honoursImported;
    } else if (scope === "all") {
      const r = await importEverything(opts);
      detail = r;
      items = r.bulkMatched + r.clubsEnriched + r.playersImported;
    } else {
      items = (
        await enrichClubs(
          opts.limit ?? 400,
          opts.offset ?? 0,
          opts.concurrency ?? 8,
          opts.budgetMs ?? 45_000,
        )
      ).imported;
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
