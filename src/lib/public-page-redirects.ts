export const PUBLIC_PAGE_REDIRECTS = {
  "/jogo-de-manager-de-futebol": "/",
  "/soccer-manager-online": "/",
  "/melhores-formacoes": "/taticas-e-formacoes",
  "/como-ser-tecnico-de-futebol": "/guias",
  "/dicas-de-gestao": "/guias",
  "/mercado-de-transferencias": "/planejamento-de-elenco",
  "/guia-de-scouting": "/planejamento-de-elenco",
  "/gestao-financeira": "/planejamento-de-elenco",
} as const;
/** Redirect before SSR so the retired page never returns duplicate HTML. */
export function publicPageRedirect(request: Request): Response | undefined {
  if (request.method !== "GET" && request.method !== "HEAD") return undefined;
  const path = new URL(request.url).pathname.replace(
    /\/+$/,
    "",
  ) as keyof typeof PUBLIC_PAGE_REDIRECTS;
  if (!Object.hasOwn(PUBLIC_PAGE_REDIRECTS, path)) return undefined;
  return new Response(null, {
    status: 301,
    headers: { Location: PUBLIC_PAGE_REDIRECTS[path], "Cache-Control": "public, max-age=3600" },
  });
}
