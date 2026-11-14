/** Anonymous, nonce-safe public SSR cache, scoped by Cloudflare colo and release.
 * Cache API is deliberately inside the Worker, never in front of authentication.
 * A hit must pass through the Worker to generate a fresh CSP nonce.
 */
import { hasSensitiveCookie } from "./anonymous-cookie";

declare const __JOGOMANAGER_BUILD_COMMIT__: string | null;
const CACHEABLE_PAGES = new Set([
  "/",
  "/guias",
  "/guia-de-scouting",
  "/melhores-formacoes",
  "/dicas-de-gestao",
  "/perguntas-frequentes",
  "/sobre",
]);
const CACHE_SECONDS = 180;
const MAX_CACHE_HTML_BYTES = 256 * 1024;

type EdgeCache = Pick<Cache, "match" | "put">;
type EdgeContext = { waitUntil: (promise: Promise<unknown>) => void };
type RewriterElement = { setAttribute: (name: string, value: string) => void };
type HtmlRewriter = {
  on: (selector: string, handlers: { element: (element: RewriterElement) => void }) => HtmlRewriter;
  transform: (response: Response) => Response;
};
type RewriterConstructor = new () => HtmlRewriter;

function getLiveCache(): EdgeCache | undefined {
  return (globalThis as typeof globalThis & { caches?: { default?: EdgeCache } }).caches?.default;
}
function getRewriter(): RewriterConstructor | undefined {
  return (globalThis as typeof globalThis & { HTMLRewriter?: RewriterConstructor }).HTMLRewriter;
}

export function isEligibleAnonymousHtmlRequest(request: Request): boolean {
  if (request.method !== "GET") return false;
  const url = new URL(request.url);
  if (!CACHEABLE_PAGES.has(url.pathname) || url.search || url.hash) return false;
  if (request.headers.has("authorization") || hasSensitiveCookie(request.headers)) return false;
  for (const name of ["range", "if-none-match", "if-modified-since"]) {
    if (request.headers.has(name)) return false;
  }
  if (/\b(?:no-cache|no-store)\b/i.test(request.headers.get("cache-control") ?? "")) return false;
  const dest = request.headers.get("sec-fetch-dest");
  return dest === null || dest === "document" || dest === "empty";
}

export function isStorablePublicHtml(response: Response): boolean {
  if (response.status !== 200 || !response.body || response.headers.has("set-cookie")) return false;
  if (!response.headers.get("content-type")?.toLowerCase().startsWith("text/html")) return false;
  if (response.headers.has("content-encoding")) return false;
  const policy = response.headers.get("cache-control") ?? "";
  if (!/\bpublic\b/i.test(policy) || /\b(?:private|no-store)\b/i.test(policy)) return false;
  const vary = response.headers.get("vary");
  if (vary && vary.split(",").some((field) => field.trim().toLowerCase() !== "accept-encoding"))
    return false;
  const length = Number(response.headers.get("content-length") ?? 0);
  return Number.isFinite(length) && length >= 0 && length <= MAX_CACHE_HTML_BYTES;
}

/** A streamed SSR response often lacks Content-Length. Bound the actual
 * bytes of only the background copy, never the visitor's original response.
 */
async function readBoundedHtml(stream: ReadableStream<Uint8Array>): Promise<ArrayBuffer | null> {
  const reader = stream.getReader();
  const parts: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      length += value.byteLength;
      if (length > MAX_CACHE_HTML_BYTES) {
        await reader.cancel("HTML exceeds edge cache size");
        return null;
      }
      parts.push(value);
    }
    const result = new ArrayBuffer(length);
    const bytes = new Uint8Array(result);
    let offset = 0;
    for (const part of parts) {
      bytes.set(part, offset);
      offset += part.byteLength;
    }
    return result;
  } catch {
    try {
      await reader.cancel("HTML cache read failed");
    } catch {
      // A cache failure must never prevent streaming the original response.
    }
    return null;
  } finally {
    reader.releaseLock();
  }
}

export type AnonymousEdgeHtmlCache = {
  read: (nonce: string) => Promise<Response | null>;
  store: (response: Response) => void;
};

export function createAnonymousEdgeHtmlCache(
  request: Request,
  env: unknown,
  context: unknown,
  revision?: string | null,
): AnonymousEdgeHtmlCache | null {
  const enabled =
    typeof env === "object" &&
    env !== null &&
    (env as Record<string, unknown>)["PUBLIC_HTML_EDGE_CACHE_ENABLED"] === "1";
  if (!enabled || !isEligibleAnonymousHtmlRequest(request)) return null;
  const commit =
    revision === undefined
      ? typeof __JOGOMANAGER_BUILD_COMMIT__ === "undefined"
        ? null
        : __JOGOMANAGER_BUILD_COMMIT__
      : revision;
  if (!commit || !/^[a-f0-9]{40}$/.test(commit)) return null;
  const cache = getLiveCache();
  const Rewriter = getRewriter();
  if (!cache || !Rewriter) return null;
  const waitUntil =
    typeof context === "object" &&
    context !== null &&
    "waitUntil" in context &&
    typeof (context as EdgeContext).waitUntil === "function"
      ? (context as EdgeContext).waitUntil.bind(context)
      : null;
  if (!waitUntil) return null;

  const original = new URL(request.url);
  const keyUrl = new URL(original);
  keyUrl.pathname = `/__jgm_ssr_cache_v1/${commit}${original.pathname}`;
  keyUrl.search = "";
  const key = new Request(keyUrl.toString(), { method: "GET" });

  return {
    async read(nonce) {
      try {
        const found = await cache.match(key);
        if (!found || !isStorablePublicHtml(found)) return null;
        const headers = new Headers(found.headers);
        headers.delete("content-length");
        headers.delete("etag");
        headers.delete("server-timing");
        headers.delete("content-security-policy-report-only");
        headers.set("cache-control", "no-cache, must-revalidate, max-age=0");
        // Never serve the cached HTML's previous visitor nonce. Every nonce
        // attribute is replaced before the response is released to the caller.
        const rewriter = new Rewriter()
          .on("[nonce]", {
            element(element) {
              element.setAttribute("nonce", nonce);
            },
          })
          .on('meta[property="csp-nonce"]', {
            element(element) {
              element.setAttribute("content", nonce);
            },
          });
        return rewriter.transform(new Response(found.body, { status: 200, headers }));
      } catch {
        // Cache failures must not make public pages unavailable.
        return null;
      }
    },
    store(response) {
      if (!isStorablePublicHtml(response)) return;
      try {
        const headers = new Headers(response.headers);
        headers.delete("server-timing");
        headers.delete("content-security-policy-report-only");
        headers.delete("content-length");
        headers.delete("etag");
        headers.delete("vary");
        // The *outbound* HTML forbids caching before this Worker; the
        // internal key has a different policy so Cache API can store it.
        headers.delete("cdn-cache-control");
        headers.delete("cloudflare-cdn-cache-control");
        headers.set("cache-control", `public, max-age=${CACHE_SECONDS}`);
        const body = response.clone().body;
        if (!body) return;
        waitUntil(
          readBoundedHtml(body)
            .then((buffer) =>
              buffer === null
                ? undefined
                : cache.put(key, new Response(buffer, { status: 200, headers })),
            )
            .catch(() => undefined),
        );
      } catch {
        // A failed cache fill does not change the response already streaming.
      }
    },
  };
}
