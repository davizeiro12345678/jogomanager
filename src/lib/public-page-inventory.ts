/** Canonical public pages only; private, transactional and retired aliases stay out. */
export type PublicPageInventoryEntry = {
  readonly path: string;
  readonly changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  readonly priority?: string;
};

/**
 * The sitemap and HTTP indexing policy deliberately share this allowlist.
 * Keep paths slash-free (except the root) so canonical URLs have one identity.
 */
export const PUBLIC_PAGE_INVENTORY = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/jogo-de-manager-de-futebol", changefreq: "weekly", priority: "0.9" },
  { path: "/tabelas", changefreq: "daily", priority: "0.9" },
  { path: "/tabelas/brasileirao-serie-a", changefreq: "daily", priority: "0.8" },
  { path: "/tabelas/brasileirao-serie-b", changefreq: "daily", priority: "0.8" },
  { path: "/tabelas/premier-league", changefreq: "daily", priority: "0.8" },
  { path: "/tabelas/la-liga", changefreq: "daily", priority: "0.8" },
  { path: "/tabelas/serie-a-italia", changefreq: "daily", priority: "0.8" },
  { path: "/tabelas/bundesliga", changefreq: "daily", priority: "0.8" },
  { path: "/tabelas/ligue-1", changefreq: "daily", priority: "0.8" },
  { path: "/tabelas/liga-portugal", changefreq: "daily", priority: "0.8" },
  { path: "/tabelas/eredivisie", changefreq: "daily", priority: "0.8" },
  { path: "/tabelas/liga-argentina", changefreq: "daily", priority: "0.8" },
  { path: "/tabelas/mls", changefreq: "daily", priority: "0.8" },
  { path: "/tabelas/liga-mx", changefreq: "daily", priority: "0.8" },
  { path: "/mercado-de-transferencias", changefreq: "weekly", priority: "0.8" },
  { path: "/guias", changefreq: "weekly", priority: "0.8" },
  { path: "/melhores-formacoes", changefreq: "monthly", priority: "0.8" },
  { path: "/guia-de-scouting", changefreq: "monthly", priority: "0.8" },
  { path: "/dicas-de-gestao", changefreq: "monthly", priority: "0.8" },
  { path: "/planejamento-de-elenco", changefreq: "weekly", priority: "0.8" },
  { path: "/analise-de-partida-de-futebol", changefreq: "weekly", priority: "0.8" },
  { path: "/modo-carreira-de-jogador", changefreq: "weekly", priority: "0.8" },
  { path: "/regras", changefreq: "monthly", priority: "0.8" },
  { path: "/glossario-do-futebol", changefreq: "monthly", priority: "0.7" },
  { path: "/jogar-offline", changefreq: "monthly", priority: "0.7" },
  { path: "/comparativo-jogos-manager", changefreq: "monthly", priority: "0.7" },
  { path: "/perguntas-frequentes", changefreq: "monthly", priority: "0.7" },
  { path: "/produtos", changefreq: "monthly", priority: "0.7" },
  { path: "/sobre", changefreq: "monthly", priority: "0.7" },
  { path: "/criador", changefreq: "monthly", priority: "0.5" },
  { path: "/contato", changefreq: "monthly", priority: "0.5" },
  { path: "/privacidade", changefreq: "yearly", priority: "0.4" },
  { path: "/termos", changefreq: "yearly", priority: "0.4" },
] as const satisfies readonly PublicPageInventoryEntry[];
