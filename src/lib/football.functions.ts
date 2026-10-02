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
    // do clube pelo Logo.dev (chave publicável, pode ir para o cliente).
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

    return { crests, kits };
  },
);

/** Public read: real squad rows for one club, when they were imported. */
export const getRealSquad = createServerFn({ method: "GET" })
  .inputValidator((input: { clubId: string }) => input)
  .handler(async ({ data }) => {
    const db = publicClient();
    // Keyset pagination avoids the API row ceiling and preserves source identity.
    const rows = [];
    let cursor: string | undefined;
    for (let page = 0; page < 20; page++) {
      let query = db
        .from("players")
        .select(
          "id, data_source:source, source_id, birth_date, name, position, age, shirt_number, nationality, overall, photo_url",
        )
        .eq("club_id", data.clubId)
        .order("id")
        .limit(50);
      if (cursor) query = query.gt("id", cursor);
      const result = await query;
      if (result.error) throw new Error("Não foi possível carregar o elenco completo.");
      rows.push(...(result.data ?? []));
      if (!result.data || result.data.length < 50) return rows;
      cursor = result.data.at(-1)!.id;
    }
    // Do not cache a partial response as a complete squad.
    throw new Error("O elenco excedeu o limite seguro de leitura.");
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
      .select(
        "id, source, source_id, birth_date, name, position, age, shirt_number, nationality, overall, photo_url, club_id",
      )
      .order("overall", { ascending: false })
      .order("id")
      .range(page * PAGE, page * PAGE + PAGE);

    if (data.q?.trim()) query = query.ilike("name", `%${data.q.trim()}%`);
    if (data.pos && data.pos !== "ALL") query = query.eq("position", data.pos);
    if (data.clubId) query = query.eq("club_id", data.clubId);
    if (data.minAge) query = query.gte("age", data.minAge);
    if (data.maxAge) query = query.lte("age", data.maxAge);
    if (data.minOvr) query = query.gte("overall", data.minOvr);
    if (data.maxOvr) query = query.lte("overall", data.maxOvr);

    const { data: rows, error } = await query;
    if (error) throw new Error("Não foi possível consultar o mercado de jogadores.");
    const list = (rows ?? []) as MarketRow[];
    return { rows: list.slice(0, PAGE), page, hasMore: list.length > PAGE };
  });
