import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { catalogImageUrl } from "./catalog-media";

/** A bounded public projection; private saves and raw provider payloads never leave the server. */
export const getClubDatabaseProfile = createServerFn({ method: "GET" })
  .validator((input: unknown) =>
    z.object({ clubId: z.string().trim().min(1).max(120) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { createFootballPublicClient } = await import("./football-public.server");
    const db = createFootballPublicClient();
    const { cachedPublicRead } = await import("./public-read-cache.server");
    return cachedPublicRead("club", `database:${data.clubId}`, async () => {
      const clubResult = await db
        .from("clubs")
        .select(
          "id,name,crest_url,city,country,founded,updated_at,stadiums(name,capacity,photo_url)",
        )
        .eq("id", data.clubId)
        .maybeSingle();
      if (clubResult.error) throw new Error("Não foi possível carregar a identidade do clube.");
      const club = clubResult.data;
      if (!club) return null;
      const links = await db
        .from("club_catalog_links")
        .select("source_club_id")
        .eq("club_id", club.id)
        .limit(4);
      if (links.error) throw new Error("Não foi possível resolver a identidade do elenco.");
      const clubIds = [club.id, ...(links.data ?? []).map((link) => link.source_club_id)];
      const playersResult = await db
        .from("players")
        .select("id,name,position,photo_url,nationality")
        .in("club_id", clubIds)
        .eq("source_kind", "player")
        .is("canonical_player_id", null)
        .order("name")
        .order("id")
        .limit(8);
      if (playersResult.error) throw new Error("Não foi possível carregar os atletas oficiais.");
      const teamResult = await db
        .from("official_teams")
        .select("source_id,venue_source_id")
        .eq("local_club_id", club.id)
        .order("source_id")
        .limit(5);
      if (teamResult.error) throw new Error("Não foi possível resolver o clube na base oficial.");
      const ids = (teamResult.data ?? []).map((team) => team.source_id);
      type Stadium = { name: string; capacity: number | null; photo_url: string | null } | null;
      let stadium = (Array.isArray(club.stadiums) ? (club.stadiums[0] ?? null) : club.stadiums) as Stadium;
      if (!stadium) {
        const venueIds = (teamResult.data ?? []).flatMap((team) =>
          team.venue_source_id ? [team.venue_source_id] : [],
        );
        if (venueIds.length) {
          const venue = await db
            .from("official_venues")
            .select("name,capacity,photo_url")
            .in("source_id", venueIds)
            .order("source_id")
            .limit(1)
            .maybeSingle();
          if (venue.error) throw new Error("Não foi possível carregar o estádio oficial.");
          stadium = venue.data as Stadium;
        }
      }
      const matches = [];
      if (ids.length) {
        const read = (side: "home_team_source_id" | "away_team_source_id") =>
          db
            .from("official_events")
            .select(
              "source_id,starts_at,home_team_name,away_team_name,home_score,away_score,status",
            )
            .in(side, ids)
            .in("status", ["FT", "AET", "PEN"])
            .lte("starts_at", new Date().toISOString())
            .order("starts_at", { ascending: false })
            .order("source_id")
            .limit(8);
        const [home, away] = await Promise.all([
          read("home_team_source_id"),
          read("away_team_source_id"),
        ]);
        if (home.error || away.error)
          throw new Error("Não foi possível carregar os resultados oficiais.");
        const unique = [
          ...new Map(
            [...(home.data ?? []), ...(away.data ?? [])]
              .filter((event) => event.source_id)
              .map((event) => [event.source_id, event]),
          ).values(),
        ];
        matches.push(
          ...unique
            .sort(
              (a, b) =>
                (b.starts_at ?? "").localeCompare(a.starts_at ?? "") ||
                (a.source_id ?? "").localeCompare(b.source_id ?? ""),
            )
            .slice(0, 6),
        );
      }
      return {
        id: club.id,
        name: club.name,
        crest: catalogImageUrl(club.crest_url),
        city: club.city,
        country: club.country,
        founded: club.founded,
        updatedAt: club.updated_at,
        stadium: stadium
          ? {
              name: stadium.name,
              capacity: stadium.capacity,
              photo: catalogImageUrl(stadium.photo_url),
            }
          : null,
        matches,
        players: (playersResult.data ?? []).map((player) => ({
          ...player,
          photo: catalogImageUrl(player.photo_url),
          photo_url: undefined,
        })),
      };
    });
  });
