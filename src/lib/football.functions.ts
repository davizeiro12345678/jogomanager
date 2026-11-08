import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { publicClient, readPublicPages } from "./football-public-db.server";

export interface OfficialAssets {
  crests: Record<string, string>;
  kits: Record<string, string>;
}

/** Public read: official crest + kit image URLs, keyed by the game's club id. */
export const getOfficialAssets = createServerFn({ method: "GET" }).handler(
  async (): Promise<OfficialAssets> => {
    const { readOfficialAssets } = await import("./football-assets.server");
    return readOfficialAssets();
  },
);

/** Public read: real squad rows for one club, when they were imported. */
async function clubIdentityIds(clubId: string) {
  const { cachedPublicRead } = await import("./public-read-cache.server");
  return cachedPublicRead("club", `identities:${clubId}`, async () => {
    const result = await publicClient()
      .from("club_catalog_links")
      .select("source_club_id")
      .eq("club_id", clubId)
      .limit(4);
    if (result.error) throw new Error("Não foi possível carregar os vínculos do clube.");
    return [clubId, ...(result.data ?? []).map((link) => link.source_club_id)];
  });
}

async function attachPublicIdentityAliases<T extends { id: string }>(
  rows: T[],
): Promise<(T & { identity_aliases?: string[] })[]> {
  if (!rows.length) return rows;
  const db = publicClient();
  const keys = new Map<string, string[]>();
  for (let index = 0; index < rows.length; index += 100) {
    const ids = rows.slice(index, index + 100).map((row) => row.id);
    const aliases = await readPublicPages((cursor) => {
      const query = db
        .from("player_identity_aliases")
        .select("id:player_id,canonical_player_id,source,source_id")
        .in("canonical_player_id", ids)
        .order("player_id")
        .limit(100);
      return cursor ? query.gt("player_id", cursor) : query;
    }, 2000);
    for (const alias of aliases) {
      const list = keys.get(alias.canonical_player_id) ?? [];
      list.push(`record:${alias.id}`);
      if (alias.source && alias.source_id) list.push(`provider:${alias.source}:${alias.source_id}`);
      keys.set(alias.canonical_player_id, list);
    }
  }
  return rows.map((row) =>
    keys.has(row.id) ? { ...row, identity_aliases: keys.get(row.id)! } : row,
  );
}

export const getRealSquad = createServerFn({ method: "GET" })
  .validator((input: unknown) =>
    z.object({ clubId: z.string().trim().min(1).max(120) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { cachedPublicRead } = await import("./public-read-cache.server");
    return cachedPublicRead("squad", data.clubId, async () => {
      const db = publicClient();
      const clubIds = await clubIdentityIds(data.clubId);
      const rows = await readPublicPages((cursor) => {
        const query = db
          .from("players")
          .select(
            "id, data_source:source, source_id, birth_date, name, position, age, shirt_number, nationality, overall, photo_url",
          )
          .in("club_id", clubIds)
          .eq("source_kind", "player")
          .is("canonical_player_id", null)
          .order("id")
          .limit(50);
        return cursor ? query.gt("id", cursor) : query;
      }, 1_000);
      return attachPublicIdentityAliases(rows);
    });
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
  source?: string | null;
  source_id?: string | null;
  birth_date?: string | null;
  identity_aliases?: string[];
}

const PAGE = 24;
const MarketSearch = z
  .object({
    q: z.string().trim().max(80).optional(),
    pos: z.enum(["ALL", "GK", "DF", "MF", "FW"]).optional(),
    minAge: z.number().int().min(0).max(120).optional(),
    maxAge: z.number().int().min(0).max(120).optional(),
    minOvr: z.number().int().min(0).max(100).optional(),
    maxOvr: z.number().int().min(0).max(100).optional(),
    clubId: z.string().trim().min(1).max(120).optional(),
    page: z.number().int().min(0).max(10_000).optional(),
  })
  .refine((d) => d.minAge === undefined || d.maxAge === undefined || d.minAge <= d.maxAge)
  .refine((d) => d.minOvr === undefined || d.maxOvr === undefined || d.minOvr <= d.maxOvr);

/** Public read: paginated search across every imported real player. */
export const searchRealPlayers = createServerFn({ method: "GET" })
  .validator((input: unknown) => MarketSearch.parse(input))
  .handler(async ({ data }): Promise<{ rows: MarketRow[]; page: number; hasMore: boolean }> => {
    const { cachedPublicRead } = await import("./public-read-cache.server");
    return cachedPublicRead("market", JSON.stringify(data), async () => {
      // The public RLS predicate prevents PostgreSQL from using the existing
      // name trigram index with ILIKE. This server-only client keeps exactly
      // that public row predicate and a fixed public projection in every query.
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const db = supabaseAdmin;
      const page = data.page ?? 0;
      const list: MarketRow[] = [];
      // Most requests need one read. A custom API cap below PAGE + 1 must not
      // make the next page disappear, so continue until the lookahead or EOF.
      while (list.length <= PAGE) {
        let query = db
          .from("players")
          .select(
            "id, source, source_id, birth_date, name, position, age, shirt_number, nationality, overall, photo_url, club_id",
          )
          .eq("source_kind", "player")
          .is("canonical_player_id", null)
          .order("overall", { ascending: false })
          .order("id")
          .range(page * PAGE + list.length, page * PAGE + PAGE);

        // User text is a literal name fragment, not an unrestricted LIKE pattern.
        if (data.q) query = query.ilike("name", `%${data.q.replace(/[\\%_]/g, "\\$&")}%`);
        if (data.pos && data.pos !== "ALL") query = query.eq("position", data.pos);
        if (data.clubId) query = query.in("club_id", await clubIdentityIds(data.clubId));
        if (data.minAge !== undefined) query = query.gte("age", data.minAge);
        if (data.maxAge !== undefined) query = query.lte("age", data.maxAge);
        if (data.minOvr !== undefined) query = query.gte("overall", data.minOvr);
        if (data.maxOvr !== undefined) query = query.lte("overall", data.maxOvr);

        const { data: rows, error } = await query;
        if (error || !rows) throw new Error("Não foi possível consultar o mercado de jogadores.");
        if (rows.length === 0) break;
        list.push(...rows);
      }
      return {
        rows: await attachPublicIdentityAliases(list.slice(0, PAGE)),
        page,
        hasMore: list.length > PAGE,
      };
    });
  });
