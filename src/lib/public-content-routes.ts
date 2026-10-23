/** Content routes never need a mutable career world, squads or game UI styles. */
export const PUBLIC_CONTENT_PATHS = new Set([
  "/",
  "/partida-rapida",
  "/guias",
  "/guia-de-scouting",
  "/melhores-formacoes",
  "/dicas-de-gestao",
  "/planejamento-de-elenco",
  "/analise-de-partida-de-futebol",
  "/comparativo-jogos-manager",
  "/mercado-de-transferencias",
  "/glossario-do-futebol",
  "/regras",
  "/jogar-offline",
  "/modo-carreira-de-jogador",
  "/jogo-de-manager-de-futebol",
  "/gestao-financeira",
  "/como-ser-tecnico-de-futebol",
  "/ligas-de-futebol",
  "/perguntas-frequentes",
  "/privacidade",
  "/termos",
  "/contato",
  "/sobre",
  "/criador",
]);

export function isPublicContentPath(pathname: string): boolean {
  const path = pathname.replace(/\/$/, "") || "/";
  return PUBLIC_CONTENT_PATHS.has(path) || path === "/tabelas" || path.startsWith("/tabelas/");
}
