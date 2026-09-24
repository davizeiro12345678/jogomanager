/**
 * Sincronização Premium (TheSportsDB v2): elencos com overall algorítmico e
 * metadados de sincronização. Idempotente: atualiza pelo id da fonte.
 */
import { computeOverall } from "@/game/overall";
import { ageFrom, mapPosition } from "./football-api.server";
import { sdbV2, str, num } from "./thesportsdb-v2.server";

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

const SOURCE = "thesportsdb";

export async function premiumSyncSquads(limit = 40, offset = 0, budgetMs = 45_000) {
  const { supabaseAdmin: db } = (await import("@/integrations/supabase/client.server")) as {
    supabaseAdmin: Admin;
  };
  const deadline = Date.now() + budgetMs;
  const now = new Date().toISOString();

  const { data: links, error } = await db
    .from("club_external_ids")
    .select("club_id, external_id, clubs(strength, competitions(tier))")
    .eq("source", SOURCE)
    .order("club_id")
    .range(offset, offset + limit - 1);
  if (error) throw new Error(error.message);

  let clubs = 0;
  let inserted = 0;
  let updated = 0;
  let failed = 0;

  for (const link of links ?? []) {
    if (Date.now() > deadline) break;
    const clubRel = link.clubs as unknown as {
      strength: number | null;
      competitions: { tier: number | null } | null;
    } | null;
    const strength = clubRel?.strength ?? 65;
    const tier = clubRel?.competitions?.tier ?? 1;

    const remote = await sdbV2.listPlayers(link.external_id);
    if (!remote.length) {
      failed++;
      continue;
    }

    const { data: existing } = await db
      .from("players")
      .select("id, source_id")
      .eq("club_id", link.club_id)
      .eq("source", SOURCE);
    const bySource = new Map((existing ?? []).map((p) => [p.source_id, p.id]));

    const rows = remote.slice(0, 40).flatMap((p) => {
      const sourceId = str(p["idPlayer"]);
      const name = str(p["strPlayer"]);
      if (!sourceId || !name) return [];
      const position = mapPosition(str(p["strPosition"]) ?? undefined);
      const birth = str(p["dateBorn"]);
      const age = birth ? (ageFrom(birth) ?? null) : null;
      const breakdown = computeOverall({
        seed: `${SOURCE}:${sourceId}`,
        leagueTier: tier,
        clubStrength: strength,
        position,
        age,
      });
      const shirt = num(p["strNumber"]);
      const height = num(str(p["strHeight"])?.replace(/[^0-9.]/g, ""));
      const photo = str(p["strCutout"]) ?? str(p["strThumb"]);
      return [
        {
          id: bySource.get(sourceId),
          club_id: link.club_id,
          name: name.slice(0, 120),
          position,
          age: age ?? 24,
          birth_date: birth && /^\d{4}-\d{2}-\d{2}$/.test(birth) ? birth : null,
          height_cm: height && height > 100 && height < 230 ? Math.round(height) : null,
          preferred_foot: str(p["strSide"]),
          shirt_number: shirt && shirt >= 1 && shirt <= 99 ? Math.round(shirt) : null,
          nationality: str(p["strNationality"]),
          photo_url: photo?.startsWith("https://") ? photo : null,
          overall: breakdown.overall,
          potential: breakdown.potential,
          overall_breakdown: { ...breakdown },
          source: SOURCE,
          source_id: sourceId,
          source_updated_at: str(p["dateUpdated"]),
          last_synced_at: now,
          sync_status: "synced",
        },
      ];
    });

    const toUpdate = rows.filter((r) => r.id);
    const toInsert = rows.filter((r) => !r.id).map(({ id: _id, ...r }) => r);
    if (toInsert.length) {
      const res = await db.from("players").insert(toInsert);
      if (res.error) failed++;
      else inserted += toInsert.length;
    }
    for (const r of toUpdate) {
      const { id, ...patch } = r;
      const res = await db.from("players").update(patch).eq("id", id as string);
      if (!res.error) updated++;
    }
    await db
      .from("clubs")
      .update({ last_synced_at: now, sync_status: "synced", source_id: link.external_id })
      .eq("id", link.club_id);
    clubs++;
  }

  return { clubs, inserted, updated, failed, nextOffset: offset + (links?.length ?? 0) };
}

const STAT_MAP: Record<string, "appearances" | "starts" | "minutes" | "goals" | "assists" | "yellow_cards" | "red_cards" | "clean_sheets"> = {
  appearances: "appearances",
  starts: "starts",
  "mins played": "minutes",
  "minutes played": "minutes",
  minutes: "minutes",
  goals: "goals",
  assists: "assists",
  "yellow cards": "yellow_cards",
  "red cards": "red_cards",
  "clean sheets": "clean_sheets",
};

const nonNeg = (v: unknown): number | null => {
  const n = num(v);
  return n == null ? null : Math.max(0, Math.round(n));
};

/** Títulos individuais e clubes anteriores de cada jogador (idempotente por id da fonte). */
export async function premiumSyncPlayerCareer(limit = 2000, offset = 0, budgetMs = 50_000, concurrency = 16) {
  const { supabaseAdmin: db } = (await import("@/integrations/supabase/client.server")) as {
    supabaseAdmin: Admin;
  };
  const deadline = Date.now() + budgetMs;
  const { data: players, error } = await db
    .from("players")
    .select("id, source_id")
    .eq("source", SOURCE)
    .not("source_id", "is", null)
    .order("id")
    .range(offset, offset + limit - 1);
  if (error) throw new Error(error.message);

  let done = 0;
  let honours = 0;
  let clubs = 0;
  const queue = [...(players ?? [])];
  const worker = async () => {
    while (queue.length && Date.now() < deadline) {
      const p = queue.shift()!;
      const sid = p.source_id as string;
      const [h, t] = await Promise.all([sdbV2.playerHonours(sid), sdbV2.playerTeams(sid)]);
      done++;
      const hRows = h.flatMap((r) => {
        const id = str(r["id"]);
        const honour = str(r["strHonour"]);
        if (!id || !honour) return [];
        const trophy = str(r["strHonourTrophy"]);
        return [{
          player_id: p.id,
          source_id: `h${id}`,
          honour: honour.slice(0, 200),
          team_name: str(r["strTeam"])?.slice(0, 120) ?? null,
          season: str(r["strSeason"])?.slice(0, 20) ?? null,
          trophy_url: trophy?.startsWith("https://") ? trophy : null,
        }];
      });
      const tRows = t.flatMap((r) => {
        const id = str(r["id"]);
        const team = str(r["strFormerTeam"]);
        if (!id || !team) return [];
        const badge = str(r["strBadge"]);
        return [{
          player_id: p.id,
          source_id: `t${id}`,
          team_name: team.slice(0, 120),
          move_type: str(r["strMoveType"])?.slice(0, 40) ?? null,
          joined: str(r["strJoined"])?.slice(0, 20) ?? null,
          departed: str(r["strDeparted"])?.slice(0, 20) ?? null,
          appearances: nonNeg(r["intAppearances"]),
          goals: nonNeg(r["intGoals"]),
          badge_url: badge?.startsWith("https://") ? badge : null,
        }];
      });
      if (hRows.length && !(await db.from("player_honours").upsert(hRows, { onConflict: "source_id" })).error)
        honours += hRows.length;
      if (tRows.length && !(await db.from("player_career_clubs").upsert(tRows, { onConflict: "source_id" })).error)
        clubs += tRows.length;
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  return { processed: done, honours, clubs, nextOffset: offset + done, total: players?.length ?? 0 };
}

/** Estatísticas por temporada + recálculo do overall com a temporada mais recente. */
export async function premiumSyncStats(limit = 400, offset = 0, budgetMs = 45_000, concurrency = 8) {
  const { supabaseAdmin: db } = (await import("@/integrations/supabase/client.server")) as {
    supabaseAdmin: Admin;
  };
  const deadline = Date.now() + budgetMs;
  const now = new Date().toISOString();
  const { data: players, error } = await db
    .from("players")
    .select("id, club_id, position, age, source_id, clubs(strength, competitions(tier))")
    .eq("source", SOURCE)
    .not("source_id", "is", null)
    .order("id")
    .range(offset, offset + limit - 1);
  if (error) throw new Error(error.message);

  let done = 0;
  let seasons = 0;
  const queue = [...(players ?? [])];
  const worker = async () => {
    while (queue.length && Date.now() < deadline) {
      const p = queue.shift()!;
      const raw = await sdbV2.playerStats(p.source_id as string);
      done++;
      if (!raw.length) continue;
      const bySeason = new Map<string, Record<string, number>>();
      for (const r of raw) {
        const season = str(r["strSeason"]);
        const key = STAT_MAP[(str(r["strStatistic"]) ?? "").toLowerCase()];
        const value = num(r["strValue"]);
        if (!season || !key || value == null) continue;
        const acc = bySeason.get(season) ?? {};
        acc[key] = (acc[key] ?? 0) + Math.max(0, Math.round(value));
        bySeason.set(season, acc);
      }
      if (!bySeason.size) continue;
      const rows = [...bySeason].map(([season, s]) => {
        const appearances = s["appearances"] ?? 0;
        return {
          player_id: p.id,
          club_id: null,
          competition_id: null,
          season: season.slice(0, 20),
          ...s,
          appearances,
          starts: Math.min(s["starts"] ?? 0, appearances),
          source: SOURCE,
          source_id: `${p.source_id}:${season}`,
          last_synced_at: now,
          sync_status: "synced",
        };
      });
      await db.from("player_season_stats").delete().eq("player_id", p.id).eq("source", SOURCE);
      const ins = await db.from("player_season_stats").insert(rows);
      if (ins.error) continue;
      seasons += rows.length;

      const latest = [...bySeason.keys()].sort().at(-1)!;
      const s = bySeason.get(latest)!;
      const rel = p.clubs as unknown as { strength: number | null; competitions: { tier: number | null } | null } | null;
      const b = computeOverall({
        seed: `${SOURCE}:${p.source_id}`,
        leagueTier: rel?.competitions?.tier ?? 1,
        clubStrength: rel?.strength ?? 65,
        position: p.position as "GK" | "DF" | "MF" | "FW",
        age: p.age,
        stats: {
          appearances: s["appearances"] ?? 0,
          minutes: s["minutes"] ?? 0,
          goals: s["goals"] ?? 0,
          assists: s["assists"] ?? 0,
          cleanSheets: s["clean_sheets"] ?? 0,
        },
      });
      await db
        .from("players")
        .update({ overall: b.overall, potential: b.potential, overall_breakdown: { ...b } })
        .eq("id", p.id);
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  return { processed: done, seasons, nextOffset: offset + done, total: players?.length ?? 0 };
}
