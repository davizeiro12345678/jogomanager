/** Retired editorial URLs. Targets remain distinct, canonical resources. */
export const PUBLIC_PAGE_REDIRECTS = {
  "/modo-carreira": "/jogo-de-manager-de-futebol",
  "/como-ser-tecnico-de-futebol": "/guias",
  "/gestao-financeira": "/dicas-de-gestao",
  "/taticas-e-formacoes": "/melhores-formacoes",
  "/soccer-manager-online": "/jogo-de-manager-de-futebol",
  "/ligas-de-futebol": "/tabelas",
  "/brasileirao": "/tabelas/brasileirao-serie-a",
} as const;

/** Run before SSR so HEAD and crawlers receive the same permanent redirect. */
export function publicPageRedirect(request: Request): Response | undefined {
  if (request.method !== "GET" && request.method !== "HEAD") return;
  const url = new URL(request.url);
  // Canonicalize the browser origin before OAuth begins. Keeping the
  // sign-in and callback on the same origin preserves PKCE code verifiers.
  if (url.hostname === "www.jogomanager.com" && /^\/auth(?:\/|$)/.test(url.pathname)) {
    url.hostname = "jogomanager.com";
    return new Response(null, {
      status: 302,
      headers: { Location: url.href, "Cache-Control": "no-store" },
    });
  }
  const pathname = url.pathname.replace(/\/+$/, "") || "/";
  const target = PUBLIC_PAGE_REDIRECTS[pathname as keyof typeof PUBLIC_PAGE_REDIRECTS];
  if (!target) return;
  return new Response(null, {
    status: 301,
    headers: { Location: `${target}${url.search}`, "Cache-Control": "public, max-age=3600" },
  });
}
