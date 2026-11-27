import type { OfficialAssets } from "./football.functions";

type EdgeCache = {
  match(key: Request): Promise<Response | undefined>;
  put(key: Request, response: Response): Promise<void>;
};

const EDGE_TTL_SECONDS = 300;

/** Catalog data is anonymous and independent of query, cookies and authorization.
 * Cache a complete response per origin, never a promise or request-owned stream.
 * The existing loader retains its bounded stale policy; the edge TTL is short. */
export async function serveOfficialAssets(
  request: Request,
  load: () => Promise<OfficialAssets>,
  cache?: EdgeCache,
): Promise<Response> {
  const key = new Request(new URL("/api/public/football-assets?cache-version=3", request.url), {
    method: "GET",
  });
  if (cache) {
    try {
      const hit = await cache.match(key);
      if (hit?.ok) return hit;
    } catch {
      // Edge cache is optional; never make availability depend on it.
    }
  }
  let catalog: OfficialAssets;
  try {
    catalog = await load();
  } catch {
    console.warn("[football-assets] complete public catalog unavailable");
    return Response.json(
      { error: "Catálogo temporariamente indisponível." },
      { status: 503, headers: { "cache-control": "no-store", "retry-after": "30" } },
    );
  }
  const nonempty = Object.keys(catalog.crests).length > 0 || Object.keys(catalog.kits).length > 0;
  const response = Response.json(catalog, {
    headers: { "cache-control": nonempty ? `public, max-age=${EDGE_TTL_SECONDS}` : "no-store" },
  });
  if (cache && nonempty) {
    try {
      await cache.put(key, response.clone());
    } catch {
      // Cache writes must not turn a successful catalog read into an error.
    }
  }
  return response;
}

export function officialAssetsEdgeCache(): EdgeCache | undefined {
  return typeof caches === "undefined"
    ? undefined
    : (caches as CacheStorage & { default?: Cache }).default;
}
