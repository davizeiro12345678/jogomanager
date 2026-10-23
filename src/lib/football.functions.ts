import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";
import { isPlayerRecord } from "./football-person-kind";
import { validCatalogIdentity } from "./catalog-integrity";

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  const url = process.env["SUPABASE_URL"];
  if (!key || !url) throw new Error("Os dados públicos de futebol estão indisponíveis.");
  return createClient<Database>(url, key, {
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

/** A server-configured row cap can be smaller than our requested page size. */
async function readPublicPages<T extends { id: string }>(
  load: (cursor: string | undefined) => PromiseLike<{ data: T[] | null; error: unknown }>,
  maxRows = 100_000,
): Promise<T[]> {
  const rows: T[] = [];
  const cursors = new Set<string>();
  let cursor: string | undefined;
  for (let page = 0; page < Math.min(maxRows + 1, 2_048); page++) {
    const result = await load(cursor);
    if (result.error || !result.data)
      throw new Error("Não foi possível carregar os dados completos de futebol.");
    if (result.data.length === 0) return rows;
    const next = result.data.at(-1)!.id;
    if (!next || cursors.has(next) || rows.length + result.data.length > maxRows)
      throw new Error("A paginação dos dados de futebol excedeu o limite seguro.");
    rows.push(...result.data);
    cursors.add(next);
    cursor = next;
  }
  throw new Error("A paginação dos dados de futebol excedeu o limite seguro.");
}

export interface OfficialAssets {
  crests: Record<string, string>;
  kits: Record<string, string>;
}

/** Public read: official crest + kit image URLs, keyed by the game's club id. */
export const getOfficialAssets = createServerFn({ method: "GET" }).handler(
  async (): Promise<OfficialAssets> => {
    const { cachedPublicRead } = await import("./public-read-cache.server");
    return cachedPublicRead("assets", "official-v2", async () => {
      const db = publicClient();
      const crests: Record<string, string> = {};
      const kits: Record<string, string> = {};
      const logoToken = process.env["LOGO_DEV_API_KEY"];
      // Independent catalogs load together. Walk their primary keys until an
      // empty page, so a lower Data API cap never becomes a cached partial list.
      const [clubs, kitRows] = await Promise.all([
        readPublicPages((cursor) => {
          let query = db.from("clubs").select("id, crest_url, website").order("id").limit(1_000);
          query = logoToken
            ? query.or("crest_url.not.is.null,website.not.is.null")
            : query.not("crest_url", "is", null);
          return cursor ? query.gt("id", cursor) : query;
        }),
        readPublicPages((cursor) => {
          const query = db
            .from("kits")
            .select("id, club_id, image_url")
            .eq("kind", "home")
            .not("image_url", "is", null)
            .order("id")
            .limit(1_000);
          return cursor ? query.gt("id", cursor) : query;
        }),
      ]);
      for (const c of clubs) {
        if (c.crest_url) crests[c.id] = c.crest_url;
        else if (c.website && logoToken)
          crests[c.id] = `https://img.logo.dev/${c.website}?token=${logoToken}&size=256&format=png`;
      }
      for (const k of kitRows) if (k.image_url) kits[k.club_id] = k.image_url;
      return { crests, kits };
    });
  },
);

/** Public read: real squad rows for one club, when they were imported. */
export const getRealSquad = createServerFn({ method: "GET" })
  .validator((input: unknown) =>
    z
      .object({ clubId: z.string().trim().min(1).max(120).refine(validCatalogIdentity) })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { cachedPublicRead } = await import("./public-read-cache.server");
    return cachedPublicRead("squad", data.clubId, async () => {
      const db = publicClient();
      return (
        await readPublicPages((cursor) => {
          const query = db
            .from("players")
            .select(
              "id, data_source:source, source_id, source_kind, canonical_player_id, birth_date, name, position, age, shirt_number, nationality, overall, photo_url",
            )
            .eq("club_id", data.clubId)
            .order("id")
            .limit(50);
          return cursor ? query.gt("id", cursor) : query;
        }, 1_000)
      ).filter(isPlayerRecord);
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
  canonical_player_id?: string | null;
  source_kind?: string | null;
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
      const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
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
        if (data.clubId) query = query.eq("club_id", data.clubId);
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
        rows: list.slice(0, PAGE).filter(isPlayerRecord),
        page,
        hasMore: list.length > PAGE,
      };
    });
  });
