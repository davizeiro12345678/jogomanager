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

    const { data: clubs } = await db
      .from("clubs")
      .select("id, crest_url")
      .not("crest_url", "is", null);
    for (const c of clubs ?? []) if (c.crest_url) crests[c.id] = c.crest_url;

    const { data: kitRows } = await db
      .from("kits")
      .select("club_id, image_url")
      .eq("kind", "home")
      .not("image_url", "is", null);
    for (const k of kitRows ?? []) if (k.image_url) kits[k.club_id] = k.image_url;

    return { crests, kits };
  },
);

/** Public read: real squad rows for one club, when they were imported. */
export const getRealSquad = createServerFn({ method: "GET" })
  .inputValidator((input: { clubId: string }) => input)
  .handler(async ({ data }) => {
    const db = publicClient();
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
