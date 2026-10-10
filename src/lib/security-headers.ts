import { responseIndexingPolicy } from "./public-indexing";

/** Supplied only by the outer server entry, never copied from an incoming header. */
export const CSP_NONCE_HEADER = "x-manager-csp-nonce";

export function createCspNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes));
}

const SCRIPT_SOURCES =
  "'self' https://js.stripe.com https://*.posthog.com https://*.i.posthog.com https://www.googletagmanager.com https://www.google-analytics.com https://static.cloudflareinsights.com https://cdn.gpteng.co https://*.lovable.app https://*.lovable.dev";
const COMMON_CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self' https://*.stripe.com",
  "frame-ancestors 'self' https://*.lovable.app https://*.lovable.dev https://lovable.dev",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "media-src 'self' data: blob: https:",
  "connect-src 'self' blob: data: https: wss:",
  "worker-src 'self' blob:",
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com",
];

const PRIVATE_PATH =
  /^(?:\/api\/|\/_serverFn\/(?!assets\/)|\/lovable\/|\/checkout\/|\/auth(?:\/|$)|\/cadastro(?:\/|$)|\/mcp(?:\/|$))/;
const HASHED_PATH =
  /(?:^\/(?:assets|_build|_serverFn\/assets)\/|-[A-Za-z0-9_]{8}\.(?:js|mjs|css|woff2)$)/;
const PUBLIC_STATIC = /\.(?:png|jpe?g|webp|avif|gif|svg|ico|ttf|woff2?|webmanifest|txt)$/i;

/** Works for SSR, JSON, redirects and errors, including immutable upstream headers. */
export function secureResponse(response: Response, request: Request, nonce?: string): Response {
  const headers = new Headers(response.headers);
  const contentType = (headers.get("content-type") ?? "").toLowerCase();
  const url = new URL(request.url);
  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", "strict-origin-when-cross-origin");
  headers.set(
    "permissions-policy",
    'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(self "https://js.stripe.com"), usb=()',
  );
  headers.set("cross-origin-opener-policy", "same-origin-allow-popups");
  if (url.protocol === "https:")
    headers.set("strict-transport-security", "max-age=63072000; includeSubDomains; preload");
  if (contentType.includes("text/html")) {
    // Keep the established integrations operational while the stricter nonce
    // policy is observed. Moving it to enforcement requires browser evidence.
    headers.set(
      "content-security-policy",
      [
        ...COMMON_CSP,
        `script-src ${SCRIPT_SOURCES} 'unsafe-inline' 'unsafe-eval'`,
        ...(url.protocol === "https:" ? ["upgrade-insecure-requests"] : []),
      ].join("; "),
    );
    headers.set(
      "content-security-policy-report-only",
      [
        ...COMMON_CSP,
        `script-src ${SCRIPT_SOURCES} 'wasm-unsafe-eval'${nonce ? ` 'nonce-${nonce}'` : ""}`,
      ].join("; "),
    );
  }
  const indexing =
    response.status >= 400
      ? "noindex, nofollow"
      : responseIndexingPolicy(url.pathname, contentType);
  if (indexing) headers.set("x-robots-tag", indexing);
  if (
    response.status >= 400 ||
    PRIVATE_PATH.test(url.pathname) ||
    (indexing && contentType.includes("text/html")) ||
    headers.has("set-cookie") ||
    request.headers.has("authorization")
  ) {
    headers.set("cache-control", "no-store");
  } else if (!headers.has("cache-control")) {
    const cache = HASHED_PATH.test(url.pathname)
      ? "public, max-age=31536000, immutable"
      : PUBLIC_STATIC.test(url.pathname)
        ? "public, max-age=86400, stale-while-revalidate=604800"
        : contentType.includes("text/html")
          ? "public, max-age=0, must-revalidate"
          : null;
    if (cache) headers.set("cache-control", cache);
  }
  return new Response(request.method === "HEAD" ? null : response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
