/**
 * Gate for the *dedicated*, Cloudflare-proxied origin hostname used by Fastly.
 *
 * A new origin hostname is denied by default until an origin secret is installed.
 * No DNS, public hostname, existing Cloudflare routing, or auth flows are changed.
 *
 * IMPORTANT: This is not an origin lock for existing workers.dev/custom domains.
 * Those entrypoints require a separate cutover/bypass review.
 */
export const FASTLY_ORIGIN_HOSTNAME = "fastly-origin.jogomanager.com";
export const FASTLY_ORIGIN_SECRET_HEADER = "x-jm-fastly-origin-secret";

function blocked(status: number): Response {
  return new Response(JSON.stringify({ error: "Origin unavailable" }), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}

/**
 * Compare fixed-width hex strings without a content-dependent early return.
 * The secret must be 32 cryptographically random bytes, encoded as 64 lowercase hex chars.
 */
function secretMatches(expected: string, supplied: string | null): boolean {
  if (!supplied || supplied.length !== 64) return false;
  let mismatch = 0;
  for (let i = 0; i < 64; i += 1) {
    mismatch |= expected.charCodeAt(i) ^ supplied.charCodeAt(i);
  }
  return mismatch === 0;
}

export function fastlyOriginGate(request: Request, env: unknown): Response | null {
  const hostname = new URL(request.url).hostname.toLowerCase();
  if (hostname !== FASTLY_ORIGIN_HOSTNAME) return null;

  const settings = env as { FASTLY_ORIGIN_SECRET?: unknown } | null;
  const expected = settings?.FASTLY_ORIGIN_SECRET;
  // A missing/invalid configuration MUST NOT silently turn this origin public.
  if (typeof expected !== "string" || !/^[0-9a-f]{64}$/.test(expected)) {
    return blocked(503);
  }

  if (!secretMatches(expected, request.headers.get(FASTLY_ORIGIN_SECRET_HEADER))) {
    return blocked(403);
  }

  return null;
}
