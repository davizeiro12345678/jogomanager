/** Idempotent, budgeted TheSportsDB premium graph import. All keys stay server-side. */
import { sdbV2, str, num } from "./thesportsdb-v2.server";
import type { Database, Json } from "@/integrations/supabase/types";

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];
type MediaRow = Database["public"]["Tables"]["official_media"]["Insert"];
export type PremiumPhase =
  "leagues" | "teams" | "kits" | "players" | "schedule" | "events" | "details";

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
  const sourceUpdatedAt = dateTime(value["dateUpdated"]);
  return (MEDIA[type] ?? []).flatMap(([kind, field]) => {
    const url = str(value[field]);
    if (!url || !/^https:\/\//i.test(url)) return [];
    return [
      {
        source: "thesportsdb",
        entity_type: type,
        source_id: sourceId,
        parent_source_id: "",
        kind,
        url,
        source_updated_at: sourceUpdatedAt,
      },
    ];
  });
}
async function saveMedia(db: Admin, rows: MediaRow[]) {
  if (!rows.length) return 0;
  const { error } = await db
    .from("official_media")
    .upsert(rows, { onConflict: "source,entity_type,source_id,parent_source_id,kind" });
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
  const city = str(venue["strCity"]);
  const saveVenue = (venueName: string) =>
    db
      .from("stadiums")
      .upsert(
        {
          source_id: venueId,
          name: venueName,
          city,
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
  let { data, error } = await saveVenue(name);
  // Different real venues share common names. Keep source identity stable
  // while disambiguating the display name by city, then by provider ID.
  if (error?.message.includes("stadiums_name_key")) {
    ({ data, error } = await saveVenue(`${name} (${city ?? venueId})`.slice(0, 200)));
    if (error?.message.includes("stadiums_name_key")) {
      ({ data, error } = await saveVenue(`${name} (${venueId})`.slice(0, 200)));
    }
  }
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
      // Resolve by source identity or exact country/name, then collapse known local aliases.
      // Do not pick an arbitrary duplicate by roster size.
      const country = str(league["strCountry"]);
      let localId: string | null = null;
      const candidateIds = new Set<string>();
      const { data: bySourceId, error: sourceMatchError } = await db
        .from("competitions")
        .select("id")
        .in("source_id", [`x${id}`, `y${id}`]);
      if (sourceMatchError) throw new Error(sourceMatchError.message);
      for (const candidate of bySourceId ?? []) candidateIds.add(candidate.id);
      if (country) {
        const { data: candidates, error: nameMatchError } = await db
          .from("competitions")
          .select("id,name")
          .eq("country", country);
        if (nameMatchError) throw new Error(nameMatchError.message);
        for (const candidate of candidates ?? []) {
          if (normalize(candidate.name) === normalize(name)) candidateIds.add(candidate.id);
        }
      }
      if (candidateIds.size) {
        const ids = [...candidateIds];
        const { data: aliases, error: aliasError } = await db
          .from("sportsdb_competition_identity_aliases")
          .select("alias_id,canonical_id")
          .in("alias_id", ids);
        if (aliasError) throw new Error(aliasError.message);
        const canonicalByAlias = new Map(
          (aliases ?? []).map((alias) => [alias.alias_id, alias.canonical_id]),
        );
        const canonicalIds = new Set(
          ids.map((candidateId) => canonicalByAlias.get(candidateId) ?? candidateId),
        );
        if (canonicalIds.size === 1) localId = [...canonicalIds][0] ?? null;
      }
      const result = await db.from("official_leagues").upsert({
        source_id: id,
        name,
        sport: "Soccer",
        country,
        current_season: str(league["strCurrentSeason"]),
        ...(localId ? { local_competition_id: localId } : {}),
        source_updated_at: dateTime(league["dateUpdated"]) ?? dateTime(item["dateUpdated"]),
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
      .eq("sport", "Soccer")
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
      // Resume a large league from stable provider identities without advancing
      // its offset while teams still remain outside this invocation's budget.
      const { data: done, error: doneError } = await db
        .from("official_teams")
        .select("source_id")
        .eq("league_source_id", linked.source_id);
      if (doneError) throw new Error(doneError.message);
      const doneIds = new Set((done ?? []).map((row) => row.source_id));
      let leagueComplete = true;
      for (const listed of teams) {
        const id = str(listed["idTeam"]);
        if (!id || doneIds.has(id)) continue;
        if (!withinBudget()) {
          leagueComplete = false;
          break;
        }
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
          ...(localId ? { local_club_id: localId } : {}),
          source_updated_at: dateTime(team["dateUpdated"]) ?? dateTime(listed["dateUpdated"]),
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
      if (!leagueComplete) break;
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

  if (phase === "kits") {
    const { data: teams, error } = await db
      .from("official_teams")
      .select("source_id,local_club_id")
      .not("local_club_id", "is", null)
      .order("source_id")
      .range(offset, offset + limit - 1);
    if (error) throw new Error(error.message);
    for (const team of teams ?? []) {
      if (!withinBudget()) break;
      processed++;
      const localId = team.local_club_id;
      if (!localId) continue;
      const equipment = await sdbV2.teamEquipment(team.source_id);
      if (!equipment.length) unavailable++;
      for (const kit of equipment) {
        const image = str(kit["strEquipment"]);
        const seasonName = str(kit["strSeason"]);
        if (!image?.startsWith("https://") || !seasonName) continue;
        const kindRaw = (str(kit["strType"]) ?? "home").toLowerCase();
        const kind = kindRaw.includes("away")
          ? "away"
          : kindRaw.includes("third")
            ? "third"
            : kindRaw.includes("goal")
              ? "goalkeeper"
              : "home";
        const saved = await db
          .from("kits")
          .upsert(
            { club_id: localId, season: seasonName.slice(0, 30), kind, image_url: image },
            { onConflict: "club_id,season,kind" },
          );
        if (saved.error) throw new Error(saved.error.message);
        imported++;
      }
    }
    return {
      phase,
      processed,
      imported,
      media,
      unavailable,
      nextOffset: offset + processed,
      total: teams?.length ?? 0,
    };
  }

  if (phase === "players") {
    const { data: players, error } = await db
      .from("players")
      .select("id,source_id,source_updated_at")
      .eq("source", "thesportsdb")
      .not("source_id", "is", null)
      .order("id")
      .range(offset, offset + limit - 1);
    if (error) throw new Error(error.message);
    const playerIds = (players ?? []).flatMap((p) => (p.source_id ? [p.source_id] : []));
    const { data: aliases, error: aliasesError } = playerIds.length
      ? await db
          .from("sportsdb_player_aliases")
          .select("alias_source_id,canonical_source_id")
          .in("alias_source_id", playerIds)
      : { data: [], error: null };
    if (aliasesError) throw new Error(aliasesError.message);
    const canonicalPlayerId = new Map(
      (aliases ?? []).map((a) => [a.alias_source_id, a.canonical_source_id]),
    );
    for (const p of players ?? []) {
      if (!withinBudget()) break;
      processed++;
      if (!p.source_id) continue;
      const sourceId = canonicalPlayerId.get(p.source_id) ?? p.source_id;
      const player = await sdbV2.lookupPlayer(sourceId);
      if (!player) {
        unavailable++;
        continue;
      }
      media += await saveMedia(db, mediaRows("player", sourceId, player));
      const photo = str(player["strCutout"]) ?? str(player["strThumb"]);
      const sourceUpdatedAt = dateTime(player["dateUpdated"]);
      if (photo?.startsWith("https://") && sourceUpdatedAt) {
        const result = await db
          .from("players")
          .update({
            photo_url: photo,
            source_updated_at: sourceUpdatedAt,
            last_synced_at: new Date().toISOString(),
          })
          .eq("id", p.id)
          .or(`source_updated_at.is.null,source_updated_at.lt.${sourceUpdatedAt}`);
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
      .eq("sport", "Soccer")
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
        source_updated_at: dateTime(event["dateUpdated"]) ?? dateTime(listed["dateUpdated"]),
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
              source_updated_at: dateTime(record["dateUpdated"]),
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
