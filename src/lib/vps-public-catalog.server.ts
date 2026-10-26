/**
 * Optional VPS cache for anonymous club crest projections.
 * Server-only, fail-closed by default, never handles credentials or player data.
 *
 * The caller MUST preserve the existing direct Supabase query as a fallback.
 * Rollout is controlled solely by private server environment variables.
 */
export type PublicCrest = { id: string; crest_url: string | null };

export interface VpsCatalogOptions {
  enabled?: boolean;
  origin?: string;
  fetchImpl?: typeof fetch;
}

const PAGE_SIZE = 100;
const PAGE_BATCH = 6;
const MAX_PAGES = 72;
const REQUEST_BUDGET_MS = 4_500;
const CATALOG_HOST = "catalog.jogomanager.com";

function safeOrigin(input: string | undefined): URL | null {
  if (!input) return null;
  try {
    const url = new URL(input);
    if (
      url.protocol !== "https:" ||
      url.hostname !== CATALOG_HOST ||
      url.username ||
      url.password ||
      url.port ||
      (url.pathname !== "/" && url.pathname !== "") ||
      url.search ||
      url.hash
    )
      return null;
    return url;
  } catch {
    return null;
  }
}

/**
 * Uses one fixed read-only endpoint. Never forwards Authorization,
 * cookies, visitor identifiers, or arbitrary upstream query strings.
 * A failed/partial/slow response returns null so the caller can fall back.
 */
export async function fetchVpsPublicCrests(
  options: VpsCatalogOptions = {},
): Promise<PublicCrest[] | null> {
  const enabled = options.enabled ?? process.env["VPS_CATALOG_ENABLED"] === "1";
  if (!enabled) return null;
  const origin = safeOrigin(options.origin ?? process.env["VPS_CATALOG_URL"]);
  if (!origin) return null;

  const fetchImpl = options.fetchImpl ?? fetch;
  const signal = AbortSignal.timeout(REQUEST_BUDGET_MS);
  const result: PublicCrest[] = [];
  const ids = new Set<string>();

  try {
    for (let batch = 0; batch < MAX_PAGES; batch += PAGE_BATCH) {
      const pages = Array.from(
        { length: Math.min(PAGE_BATCH, MAX_PAGES - batch) },
        (_, i) => batch + i,
      );
      const responses = await Promise.all(
        pages.map(async (page): Promise<PublicCrest[]> => {
          const url = new URL("/v1/public/clubs", origin);
          url.searchParams.set("limit", String(PAGE_SIZE));
          url.searchParams.set("page", String(page));
          const response = await fetchImpl(url, {
            method: "GET",
            redirect: "error",
            credentials: "omit",
            cache: "no-store",
            headers: { accept: "application/json" },
            signal,
          });
          if (!response.ok) throw new Error("vps_catalog_unavailable");
          const rows: unknown = await response.json();
          if (!Array.isArray(rows) || rows.length > PAGE_SIZE) {
            throw new Error("vps_catalog_invalid_page");
          }
          return rows.map((value: unknown): PublicCrest => {
            if (!value || typeof value !== "object" || Array.isArray(value))
              throw new Error("vps_catalog_invalid_row");
            const row = value as Record<string, unknown>;
            if (
              typeof row["id"] !== "string" ||
              row["id"].length < 1 ||
              row["id"].length > 120 ||
              (row["crest_url"] !== null &&
                (typeof row["crest_url"] !== "string" || row["crest_url"].length > 2048))
            )
              throw new Error("vps_catalog_invalid_row");
            return { id: row["id"], crest_url: row["crest_url"] as string | null };
          });
        }),
      );

      for (const rows of responses) {
        for (const row of rows) {
          if (ids.has(row.id)) throw new Error("vps_catalog_duplicate_id");
          ids.add(row.id);
          result.push(row);
        }
        if (rows.length < PAGE_SIZE) return result.length > 0 ? result : null;
      }
    }
    // Never return a truncated crest catalog.
    return null;
  } catch {
    return null;
  }
}
