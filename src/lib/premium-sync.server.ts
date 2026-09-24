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
