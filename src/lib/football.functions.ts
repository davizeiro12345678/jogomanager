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
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
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

    const { data: clubs } = await db.from("clubs").select("id, crest_url").not("crest_url", "is", null);
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
