import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`)
          h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export interface OfficialAssets {
  crests: Record<string, string>;
  kits: Record<string, string>;
}

/** Public read: official crest + kit image URLs, keyed by the game's club id. */
export const getOfficialAssets = createServerFn({ method: "GET" }).handler(
  async (): Promise<OfficialAssets> => {
    const db = publicClient();
    const crests: Record<string, string> = {};
    const kits: Record<string, string> = {};

    // Escudo oficial importado; quando ele falta, usa o logo do site oficial
    // do clube pelo Logo.dev (chave public�vel, pode ir para o cliente).
    const logoToken = process.env["LOGO_DEV_API_KEY"];
    const { data: clubs } = await db.from("clubs").select("id, crest_url, website");
    for (const c of clubs ?? []) {
      if (c.crest_url) crests[c.id] = c.crest_url;
      else if (c.website && logoToken) {
        crests[c.id] = `https://img.logo.dev/${c.website}?token=${logoToken}&size=256&format=png`;
      }
    }


    const { data: kitRows } = await db
      .from("kits")
      .select("club_id, image_url")
      .eq("kind", "home")
      .not("image_url", "is", null);
    for (const k of kitRows ?? []) if (k.image_url) kits[k.club_id] = k.image_url;

    // Cloudflare D1 is the primary cache for premium TheSportsDB artwork.
    // Keep Supabase as a fallback while the resumable D1 import is filling.
    try {
      const { data: links } = await db
        .from("club_external_ids")
        .select("club_id, external_id")
        .eq("source", "thesportsdb");
      const clubBySourceId = new Map((links ?? []).map((link) => [link.external_id, link.club_id]));
      if (clubBySourceId.size) {
        const sportsDb = await import("./sportsdb-cloudflare.server");
        const [teams, equipment] = await Promise.all([
          sportsDb.getSportsDbRecords("team"),
          sportsDb.getSportsDbRecords("equipment"),
        ]);
        for (const row of teams) {
          const clubId = clubBySourceId.get(row.sourceId);
          const crest = row.data["strBadge"] ?? row.data["strTeamBadge"] ?? row.data["strLogo"];
          if (clubId && typeof crest === "string" && crest.startsWith("https://")) crests[clubId] = crest;
        }
        for (const row of equipment) {
          const clubId = clubBySourceId.get(row.parentId);
          const image = row.data["strEquipment"];
          const kind = String(row.data["strType"] ?? "home").toLowerCase();
          if (clubId && image && typeof image === "string" && image.startsWith("https://") && (kind.includes("home") || !kind)) {
            kits[clubId] = image;
          }
        }
      }
    } catch {
      // The first deployment or local preview may not have the D1 binding yet.
    }

    return { crests, kits };
  },
);

/** Public read: real squad rows for one club, when they were imported. */
export const getRealSquad = createServerFn({ method: "GET" })
  .inputValidator((input: { clubId: string }) => input)
  .handler(async ({ data }) => {
    const db = publicClient();
    try {
      const { data: links } = await db
        .from("club_external_ids")
        .select("external_id, clubs(strength, competitions(tier))")
        .eq("club_id", data.clubId)
        .eq("source", "thesportsdb")
        .limit(1);
      const link = links?.[0];
      const teamId = link?.external_id;
      if (teamId) {
        const sportsDb = await import("./sportsdb-cloudflare.server");
        const imported = await sportsDb.getSportsDbPlayersForTeam(teamId);
        if (imported.length) {
          const [{ computeOverall }, { ageFrom, mapPosition }] = await Promise.all([
            import("@/game/overall"),
            import("./football-api.server"),
          ]);
          const club = link.clubs as unknown as {
            strength: number | null;
            competitions: { tier: number | null } | null;
          } | null;
          return imported.flatMap(({ sourceId, data: player }) => {
            const name = player["strPlayer"];
            if (typeof name !== "string" || !name.trim()) return [];
            const position = mapPosition(typeof player["strPosition"] === "string" ? player["strPosition"] : undefined);
            const birth = typeof player["dateBorn"] === "string" ? player["dateBorn"] : "";
            const age = (birth ? ageFrom(birth) : undefined)
              ?? (Number(player["intAge"]) > 0 ? Number(player["intAge"]) : 24);
            const breakdown = computeOverall({
              seed: `thesportsdb:${sourceId}`,
              leagueTier: club?.competitions?.tier ?? 1,
              clubStrength: club?.strength ?? 65,
              position,
              age,
            });
            const shirt = Number(player["strNumber"]);
            const image = player["strCutout"] ?? player["strThumb"];
            return [{
              name: name.trim().slice(0, 120),
              position,
              age,
              shirt_number: Number.isFinite(shirt) && shirt >= 1 && shirt <= 99 ? Math.round(shirt) : null,
              nationality: typeof player["strNationality"] === "string" ? player["strNationality"] : null,
              overall: breakdown.overall,
              photo_url: typeof image === "string" && image.startsWith("https://") ? image : null,
            }];
          });
        }
      }
    } catch {
      // Fall back to the existing source table until D1 has imported this squad.
    }
    const { data: rows } = await db
      .from("players")
      .select("name, position, age, shirt_number, nationality, overall, photo_url")
      .eq("club_id", data.clubId)
      .limit(30);
    return rows ?? [];
  });

export interface MarketSearchInput {
  q?: string;
  pos?: string;
  minAge?: number;
  maxAge?: number;
  minOvr?: number;
  maxOvr?: number;
  clubId?: string;
  page?: number;
}

export interface MarketRow {
  id: string;
  name: string;
  position: string;
  age: number;
  shirt_number: number | null;
  nationality: string | null;
  overall: number;
  photo_url: string | null;
  club_id: string;
}

const PAGE = 24;

/** Public read: paginated search across every imported real player. */
export const searchRealPlayers = createServerFn({ method: "GET" })
  .inputValidator((input: MarketSearchInput) => input)
  .handler(async ({ data }): Promise<{ rows: MarketRow[]; page: number; hasMore: boolean }> => {
    const db = publicClient();
    const page = Math.max(0, data.page ?? 0);
    let query = db
      .from("players")
      .select("id, name, position, age, shirt_number, nationality, overall, photo_url, club_id")
      .order("overall", { ascending: false })
      .range(page * PAGE, page * PAGE + PAGE);

    if (data.q?.trim()) query = query.ilike("name", `%${data.q.trim()}%`);
    if (data.pos && data.pos !== "ALL") query = query.eq("position", data.pos);
    if (data.clubId) query = query.eq("club_id", data.clubId);
    if (data.minAge) query = query.gte("age", data.minAge);
    if (data.maxAge) query = query.lte("age", data.maxAge);
    if (data.minOvr) query = query.gte("overall", data.minOvr);
    if (data.maxOvr) query = query.lte("overall", data.maxOvr);

    const { data: rows } = await query;
    const list = (rows ?? []) as MarketRow[];
    return { rows: list.slice(0, PAGE), page, hasMore: list.length > PAGE };
  });

