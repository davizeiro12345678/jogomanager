/** Public authored pages. Personal game screens stay crawlable for noindex. */
export const PUBLIC_SEARCH_PAGES = [
  "/",
  "/ligas-de-futebol",
  "/brasileirao",
  "/taticas-e-formacoes",
  "/guias",
  "/planejamento-de-elenco",
  "/analise-de-partida-de-futebol",
  "/modo-carreira-de-jogador",
  "/regras",
  "/glossario-do-futebol",
  "/jogar-offline",
  "/comparativo-jogos-manager",
  "/perguntas-frequentes",
  "/produtos",
  "/sobre",
  "/criador",
  "/contato",
  "/privacidade",
  "/termos",
] as const;
const publicPages: ReadonlySet<string> = new Set(PUBLIC_SEARCH_PAGES);
export function responseIndexingPolicy(pathname: string, contentType: string) {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (path.startsWith("/_serverFn/assets/")) return null;
  if (/^\/(?:api\/|_serverFn\/|lovable\/|mcp$)/.test(path)) return "noindex, nofollow";
  if (!contentType.includes("text/html") || publicPages.has(path)) return null;
  return /^\/(?:checkout\/|auth$|cadastro$|\.lovable\/)/.test(path)
    ? "noindex, nofollow"
    : "noindex, follow";
}
