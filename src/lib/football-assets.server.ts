import type { OfficialAssets } from "./football.functions";
import { publicClient, readPublicPages } from "./football-public-db.server";
import { cachedPublicRead } from "./public-read-cache.server";

function isStringMap(value: unknown): value is Record<string, string> {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.values(value).every((item) => typeof item === "string")
  );
}

export function readOfficialAssets(): Promise<OfficialAssets> {
  return cachedPublicRead("assets", "official-v2", async () => {
    const db = publicClient();
    const crests: Record<string, string> = {};
    const kits: Record<string, string> = {};
    const logoToken = process.env["LOGO_DEV_API_KEY"];
    // The scalar JSON projection avoids a sequential request for every 1,000
    // rows. It uses the same public role and RLS as the compatibility path.
    if (!logoToken && process.env["VPS_CATALOG_ENABLED"] !== "1") {
      const { data, error } = await db.rpc("read_official_asset_catalog");
      if (!error) {
        if (
          data &&
          typeof data === "object" &&
          !Array.isArray(data) &&
          isStringMap(data["crests"]) &&
          isStringMap(data["kits"])
        ) {
          return { crests: data["crests"], kits: data["kits"] };
        }
        throw new Error("Não foi possível carregar os dados completos de futebol.");
      }
      // Only a not-yet-migrated database should use the old pagination.
      if (error.code !== "PGRST202") {
        throw new Error("Não foi possível carregar os dados completos de futebol.");
      }
    }

    // Independent catalogs load together. Walk their primary keys until an
    // empty page, so a lower Data API cap never becomes a cached partial list.
    const [clubs, kitRows] = await Promise.all([
      (async () => {
        // Opt-in canary: use VPS only for anonymous crest projections. Logo.dev
        // fallback still requires the full authoritative Supabase projection.
        if (!logoToken) {
          const { fetchVpsPublicCrests } = await import("./vps-public-catalog.server");
          const fromVps = await fetchVpsPublicCrests();
          if (fromVps) return fromVps.map((club) => ({ ...club, website: null }));
        }
        return readPublicPages((cursor) => {
          let query = db.from("clubs").select("id, crest_url, website").order("id").limit(1_000);
          query = logoToken
            ? query.or("crest_url.not.is.null,website.not.is.null")
            : query.not("crest_url", "is", null);
          return cursor ? query.gt("id", cursor) : query;
        });
      })(),
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
}
