import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next, request }) => {
  if (new URL(request.url).pathname.startsWith("/lovable/")) {
    return next();
  }
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

/**
 * Cabeçalhos de segurança aplicados a toda resposta HTML.
 *
 * `frame-ancestors` substitui X-Frame-Options porque a prévia do editor roda
 * dentro de um iframe do Lovable — bloquear tudo quebraria a prévia. A CSP é
 * deliberadamente permissiva em scripts (o SSR injeta scripts inline e usamos
 * Stripe/PostHog), mas fecha `object-src`, `base-uri` e `form-action`.
 */
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self' https://*.stripe.com",
  "frame-ancestors 'self' https://*.lovable.app https://*.lovable.dev https://lovable.dev",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://*.posthog.com https://*.i.posthog.com https://www.googletagmanager.com https://www.google-analytics.com https://cdn.gpteng.co https://*.lovable.app https://*.lovable.dev",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "media-src 'self' data: blob: https:",
  "connect-src 'self' blob: data: https: wss:",
  "worker-src 'self' blob:",
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com",
  "upgrade-insecure-requests",
].join("; ");

const PERMISSIONS_POLICY = [
  "accelerometer=()",
  "camera=()",
  "geolocation=()",
  "gyroscope=()",
  "magnetometer=()",
  "microphone=()",
  'payment=(self "https://js.stripe.com")',
  "usb=()",
  "interest-cohort=()",
].join(", ");

/**
 * Ciclo de vida de cache.
 *
 * Arquivos com hash no nome (`/assets/…-a1b2c3.js`) nunca mudam de conteúdo:
 * podem ficar um ano no navegador como `immutable`. Arquivos públicos sem
 * hash (ícones, manifest, capa social, fontes) ficam um dia e revalidam.
 * HTML nunca é guardado por muito tempo, senão o jogador fica preso numa
 * versão antiga do jogo.
 */
const IMMUTABLE = "public, max-age=31536000, immutable";
const REVALIDATE_DAY = "public, max-age=86400, stale-while-revalidate=604800";
const HTML_CACHE = "public, max-age=0, must-revalidate";

const HASHED_PREFIXES = ["/assets/", "/_build/", "/_serverFn/assets/"];
const PUBLIC_STATIC = /\.(?:png|jpe?g|webp|avif|gif|svg|ico|ttf|woff2?|webmanifest|txt)$/i;

function cacheControlFor(pathname: string, contentType: string): string | null {
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_serverFn/") ||
    pathname.startsWith("/lovable/") ||
    pathname === "/auth" ||
    pathname === "/mcp"
  )
    return "no-store";
  if (HASHED_PREFIXES.some((p) => pathname.startsWith(p))) return IMMUTABLE;
  // Vite injeta hash de 8 caracteres antes da extensão nos bundles.
  if (/-[A-Za-z0-9_]{8}\.(?:js|mjs|css|woff2)$/.test(pathname)) return IMMUTABLE;
  if (PUBLIC_STATIC.test(pathname)) return REVALIDATE_DAY;
  if (contentType.includes("text/html")) return HTML_CACHE;
  return null;
}

const securityHeadersMiddleware = createMiddleware().server(async ({ next, request }) => {
  const result = await next();
  const headers = result.response?.headers;
  if (!headers || typeof headers.set !== "function") return result;

  const contentType = headers.get("content-type") ?? "";
  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", "strict-origin-when-cross-origin");
  headers.set("permissions-policy", PERMISSIONS_POLICY);
  headers.set("cross-origin-opener-policy", "same-origin-allow-popups");
  headers.set("strict-transport-security", "max-age=63072000; includeSubDomains; preload");
  if (contentType.includes("text/html")) {
    headers.set("content-security-policy", CSP);
  }

  if (!headers.get("cache-control")) {
    let pathname = "/";
    try {
      pathname = new URL(request.url).pathname;
    } catch {
      pathname = "/";
    }
    const cache = cacheControlFor(pathname, contentType);
    if (cache) headers.set("cache-control", cache);
  }
  return result;
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [errorMiddleware, securityHeadersMiddleware, csrfMiddleware],
}));
