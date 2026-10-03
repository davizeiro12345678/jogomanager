/** Idempotent, budgeted TheSportsDB premium graph import. All keys stay server-side. */
import { sdbV2, str, num } from "./thesportsdb-v2.server";
import type { Database, Json } from "@/integrations/supabase/types";

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];
type MediaRow = Database["public"]["Tables"]["official_media"]["Insert"];
export type PremiumPhase = "leagues" | "teams" | "players" | "schedule" | "events" | "details";

const MEDIA: Record<string, readonly [string, string][]> = {
  league: [
    ["badge", "strBadge"],
    ["logo", "strLogo"],
    ["trophy", "strTrophy"],
    ["poster", "strPoster"],
    ["banner", "strBanner"],
    ["fanart1", "strFanart1"],
    ["fanart2", "strFanart2"],
    ["fanart3", "strFanart3"],
    ["fanart4", "strFanart4"],
  ],
  team: [
    ["badge", "strBadge"],
    ["logo", "strLogo"],
    ["banner", "strBanner"],
    ["fanart1", "strFanart1"],
    ["fanart2", "strFanart2"],
    ["fanart3", "strFanart3"],
    ["fanart4", "strFanart4"],
  ],
  player: [
    ["cutout", "strCutout"],
    ["thumb", "strThumb"],
    ["render", "strRender"],
    ["banner", "strBanner"],
    ["poster", "strPoster"],
    ["fanart1", "strFanart1"],
    ["fanart2", "strFanart2"],
    ["fanart3", "strFanart3"],
    ["fanart4", "strFanart4"],
  ],
  venue: [
    ["thumb", "strThumb"],
    ["logo", "strLogo"],
    ["fanart1", "strFanart1"],
  ],
  event: [
    ["poster", "strPoster"],
    ["thumb", "strThumb"],
    ["square", "strSquare"],
    ["banner", "strBanner"],
    ["fanart", "strFanart"],
  ],
  equipment: [["image", "strEquipment"]],
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}
function mediaRows(type: string, sourceId: string, value: Record<string, unknown>): MediaRow[] {
  return (MEDIA[type] ?? []).flatMap(([kind, field]) => {
    const url = str(value[field]);
    if (!url || !/^https:\/\//i.test(url)) return [];
    return [{ source: "thesportsdb", entity_type: type, source_id: sourceId, kind, url }];
  });
}
async function saveMedia(db: Admin, rows: MediaRow[]) {
  if (!rows.length) return 0;
  const { error } = await db
    .from("official_media")
    .upsert(rows, { onConflict: "source,entity_type,source_id,kind" });
  if (error) throw new Error(error.message);
  return rows.length;
}
function dateTime(value: unknown): string | null {
  const raw = str(value);
  if (!raw || !/^\d{4}-\d{2}-\d{2}(?:[ T].+)?$/.test(raw)) return null;
  const time = new Date(raw);
  return Number.isNaN(time.getTime()) ? null : time.toISOString();
}
function score(value: unknown): number | null {
  const valueNumber = num(value);
  return valueNumber != null &&
    Number.isInteger(valueNumber) &&
    valueNumber >= 0 &&
    valueNumber < 100
    ? valueNumber
    : null;
}
async function saveVenue(db: Admin, venueId: string, localClubId?: string | null) {
  const venue = await sdbV2.lookupVenue(venueId);
  if (!venue) return 0;
  const name = str(venue["strVenue"]) ?? str(venue["strStadium"]);
  if (!name) return 0;
  const photo = str(venue["strThumb"]);
  const capacity = num(venue["intCapacity"]);
  const { data, error } = await db
    .from("stadiums")
    .upsert(
      {
        source_id: venueId,
        name,
        city: str(venue["strCity"]),
        country: str(venue["strCountry"]),
        capacity:
          capacity != null && capacity >= 0 && capacity < 500000 ? Math.round(capacity) : null,
        photo_url: photo?.startsWith("https://") ? photo : null,
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: "source_id" },
    )
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  if (localClubId && data?.id) {
    const result = await db.from("clubs").update({ stadium_id: data.id }).eq("id", localClubId);
    if (result.error) throw new Error(result.error.message);
  }
  return saveMedia(db, mediaRows("venue", venueId, venue));
}

export async function syncPremiumChain(options: {
  phase: PremiumPhase;
  limit: number;
  offset: number;
  budgetMs: number;
  leagueId?: string;
  season?: string;
}) {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const { phase, limit, offset, leagueId, season } = options;
  const deadline = Date.now() + options.budgetMs;
  let processed = 0;
  let imported = 0;
  let media = 0;
  let unavailable = 0;
  const withinBudget = () => Date.now() < deadline - 1500;

  if (phase === "leagues") {
    const all = (await sdbV2.allLeagues()).filter(
      (l) => str(l["strSport"]) === "Soccer" && str(l["idLeague"]),
    );
    for (const item of all.slice(offset, offset + limit)) {
      if (!withinBudget()) break;
      const id = str(item["idLeague"]);
      if (!id) continue;
      const league = await sdbV2.lookupLeague(id);
      const name = str(league?.["strLeague"]) ?? str(item["strLeague"]);
      processed++;
      if (!name || !league) {
        unavailable++;
        continue;
      }
      // Only link when a unique local competition has the same country and normalized name.
      const country = str(league["strCountry"]);
      let localId: string | null = null;
      if (country) {
        const { data: candidates } = await db
          .from("competitions")
          .select("id,name,country")
          .eq("country", country);
        const exact = (candidates ?? []).filter((c) => normalize(c.name) === normalize(name));
        if (exact.length === 1) localId = exact[0]?.id ?? null;
      }
      const result = await db.from("official_leagues").upsert({
        source_id: id,
        name,
        sport: "Soccer",
        country,
        current_season: str(league["strCurrentSeason"]),
        local_competition_id: localId,
      });
      if (result.error) throw new Error(result.error.message);
      if (localId) {
        const logo = str(league["strBadge"]) ?? str(league["strLogo"]);
        const update = await db
          .from("competitions")
          .update({
            external_source: "thesportsdb",
            external_id: id,
            ...(logo?.startsWith("https://") ? { logo_url: logo } : {}),
          })
          .eq("id", localId);
        if (update.error) throw new Error(update.error.message);
      }
      media += await saveMedia(db, mediaRows("league", id, league));
      imported++;
    }
    return {
      phase,
      processed,
      imported,
      media,
      unavailable,
      nextOffset: offset + processed,
      total: all.length,
    };
  }

  if (phase === "teams") {
    const { data: leagues, error } = await db
      .from("official_leagues")
      .select("source_id,local_competition_id")
      .order("source_id")
      .range(offset, offset + limit - 1);
    if (error) throw new Error(error.message);
    for (const linked of leagues ?? []) {
      if (!withinBudget()) break;
      const teams = await sdbV2.listTeams(linked.source_id);
      if (!teams.length) {
        unavailable++;
        processed++;
        continue;
      }
      const { data: locals } = linked.local_competition_id
        ? await db.from("clubs").select("id,name").eq("competition_id", linked.local_competition_id)
        : { data: null };
      for (const listed of teams) {
        // Finish the entire league before advancing its offset; retries upsert by source ID.
        const id = str(listed["idTeam"]);
        if (!id) continue;
        const team = (await sdbV2.lookupTeam(id)) ?? listed;
        const name = str(team["strTeam"]) ?? str(listed["strTeam"]);
        if (!name) continue;
        const match = (locals ?? []).filter((c) => normalize(c.name) === normalize(name));
        const localId = match.length === 1 ? (match[0]?.id ?? null) : null;
        const venueId = str(team["idVenue"]);
        const saved = await db.from("official_teams").upsert({
          source_id: id,
          league_source_id: linked.source_id,
          name,
          venue_source_id: venueId,
          local_club_id: localId,
        });
        if (saved.error) throw new Error(saved.error.message);
        if (localId) {
          const crest = str(team["strBadge"]);
          if (crest?.startsWith("https://")) {
            const update = await db.from("clubs").update({ crest_url: crest }).eq("id", localId);
            if (update.error) throw new Error(update.error.message);
          }
        }
        media += await saveMedia(db, mediaRows("team", id, team));
        if (venueId) media += await saveVenue(db, venueId, localId);
        const equipment = await sdbV2.teamEquipment(id);
        for (const kit of equipment) {
          const kitId = str(kit["idEquipment"]);
          if (!kitId) continue;
          media += await saveMedia(db, mediaRows("equipment", kitId, kit));
          if (localId) {
            const image = str(kit["strEquipment"]);
            const kindRaw = (str(kit["strType"]) ?? "home").toLowerCase();
            const kind = kindRaw.includes("away")
              ? "away"
              : kindRaw.includes("third")
                ? "third"
                : kindRaw.includes("goal")
                  ? "goalkeeper"
                  : "home";
            const seasonName = str(kit["strSeason"]);
            if (image?.startsWith("https://") && seasonName) {
              const savedKit = await db
                .from("kits")
                .upsert(
                  { club_id: localId, season: seasonName.slice(0, 30), kind, image_url: image },
                  { onConflict: "club_id,season,kind" },
                );
              if (savedKit.error) throw new Error(savedKit.error.message);
            }
          }
        }
        imported++;
      }
      processed++;
    }
    return {
      phase,
      processed,
      imported,
      media,
      unavailable,
      nextOffset: offset + processed,
      total: leagues?.length ?? 0,
    };
  }

  if (phase === "players") {
    const { data: players, error } = await db
      .from("players")
      .select("id,source_id")
      .eq("source", "thesportsdb")
      .not("source_id", "is", null)
      .order("id")
      .range(offset, offset + limit - 1);
    if (error) throw new Error(error.message);
    for (const p of players ?? []) {
      if (!withinBudget()) break;
      processed++;
      if (!p.source_id) continue;
      const player = await sdbV2.lookupPlayer(p.source_id);
      if (!player) {
        unavailable++;
        continue;
      }
      media += await saveMedia(db, mediaRows("player", p.source_id, player));
      const photo = str(player["strCutout"]) ?? str(player["strThumb"]);
      if (photo?.startsWith("https://")) {
        const result = await db
          .from("players")
          .update({ photo_url: photo, last_synced_at: new Date().toISOString() })
          .eq("id", p.id);
        if (result.error) throw new Error(result.error.message);
      }
      // The existing stats synchronizer persists player_stats separately by source ID.
      imported++;
    }
    return {
      phase,
      processed,
      imported,
      media,
      unavailable,
      nextOffset: offset + processed,
      total: players?.length ?? 0,
    };
  }

  if (phase === "schedule") {
    if (!leagueId || !season) throw new Error("League and season required");
    const { data: known } = await db
      .from("official_leagues")
      .select("source_id")
      .eq("source_id", leagueId)
      .maybeSingle();
    if (!known) throw new Error("Unknown league");
    const events = await sdbV2.schedule(leagueId, season);
    for (const listed of events.slice(offset, offset + limit)) {
      if (!withinBudget()) break;
      processed++;
      const id = str(listed["idEvent"]);
      if (!id) continue;
      const event = (await sdbV2.lookupEvent(id)) ?? listed;
      const upsert = await db.from("official_events").upsert({
        source_id: id,
        league_source_id: leagueId,
        season,
        home_team_source_id: str(event["idHomeTeam"]),
        away_team_source_id: str(event["idAwayTeam"]),
        home_team_name: str(event["strHomeTeam"]),
        away_team_name: str(event["strAwayTeam"]),
        starts_at: dateTime(event["strTimestamp"]) ?? dateTime(event["dateEvent"]),
        home_score: score(event["intHomeScore"]),
        away_score: score(event["intAwayScore"]),
        status: str(event["strStatus"]),
        venue_source_id: str(event["idVenue"]),
        venue_name: str(event["strVenue"]),
      });
      if (upsert.error) throw new Error(upsert.error.message);
      media += await saveMedia(db, mediaRows("event", id, event));
      imported++;
    }
    return {
      phase,
      processed,
      imported,
      media,
      unavailable,
      nextOffset: offset + processed,
      total: events.length,
    };
  }

  const { data: events, error } = await db
    .from("official_events")
    .select("source_id,venue_source_id")
    .order("source_id")
    .range(offset, offset + limit - 1);
  if (error) throw new Error(error.message);
  for (const item of events ?? []) {
    if (!withinBudget()) break;
    processed++;
    if (phase === "events") {
      const event = await sdbV2.lookupEvent(item.source_id);
      if (!event) {
        unavailable++;
        continue;
      }
      media += await saveMedia(db, mediaRows("event", item.source_id, event));
      const venueId = str(event["idVenue"]) ?? item.venue_source_id;
      if (venueId) media += await saveVenue(db, venueId);
    } else {
      const [lineup, stats, timeline] = await Promise.all([
        sdbV2.eventLineup(item.source_id),
        sdbV2.eventStats(item.source_id),
        sdbV2.eventTimeline(item.source_id),
      ]);
      for (const [kind, records, key] of [
        ["lineup", lineup, "idLineup"],
        ["stats", stats, "idStatistic"],
        ["timeline", timeline, "idTimeline"],
      ] as const) {
        const rows = records.slice(0, 300).flatMap((record) => {
          const detailId = str(record[key]);
          if (!detailId || str(record["idEvent"]) !== item.source_id) return [];
          return [
            {
              event_source_id: item.source_id,
              detail_type: kind,
              source_id: detailId,
              team_source_id: str(record["idTeam"]),
              player_source_id: str(record["idPlayer"]),
              minute: score(record["intTime"]),
              label:
                str(record["strTimeline"]) ??
                str(record["strStatistic"]) ??
                str(record["strPlayer"]),
              payload: record as unknown as Json,
            },
          ];
        });
        if (rows.length) {
          const saved = await db
            .from("official_event_details")
            .upsert(rows, { onConflict: "event_source_id,detail_type,source_id" });
          if (saved.error) throw new Error(saved.error.message);
          imported += rows.length;
        }
      }
    }
  }
  return {
    phase,
    processed,
    imported,
    media,
    unavailable,
    nextOffset: offset + processed,
    total: events?.length ?? 0,
  };
}
