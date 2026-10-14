/** Retired editorial URLs. Targets remain distinct, canonical resources. */
export const PUBLIC_PAGE_REDIRECTS = {
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
  const pathname = url.pathname.replace(/\/+$/, "") || "/";
  const target = PUBLIC_PAGE_REDIRECTS[pathname as keyof typeof PUBLIC_PAGE_REDIRECTS];
  if (!target) return;
  return new Response(null, {
    status: 301,
    headers: { Location: `${target}${url.search}`, "Cache-Control": "public, max-age=3600" },
  });
}
