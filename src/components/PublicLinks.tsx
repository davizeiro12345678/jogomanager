import { Link } from "@tanstack/react-router";

export const PUBLIC_PAGES = [
  { to: "/", label: "JogoManager" },
  { to: "/guias", label: "Guia de carreira" },
  { to: "/taticas-e-formacoes", label: "Táticas e formações" },
  { to: "/analise-de-partida-de-futebol", label: "Análise de partida" },
  { to: "/modo-carreira-de-jogador", label: "Carreira de jogador" },
  { to: "/brasileirao", label: "Brasileirão no jogo" },
  { to: "/planejamento-de-elenco", label: "Scouting e planejamento do elenco" },
  { to: "/ligas-de-futebol", label: "Ligas disponíveis" },
  { to: "/regras", label: "Regras do futebol" },
  { to: "/glossario-do-futebol", label: "Glossário do futebol" },
  { to: "/jogar-offline", label: "Como jogar offline" },
  { to: "/comparativo-jogos-manager", label: "Como avaliar um manager" },
  { to: "/perguntas-frequentes", label: "Perguntas frequentes" },
  { to: "/produtos", label: "Pacotes e passe de temporada" },
  { to: "/sobre", label: "Sobre o jogo" },
  { to: "/criador", label: "Sobre o criador" },
  { to: "/contato", label: "Contato e suporte" },
  { to: "/compartilhar", label: "Compartilhar o jogo" },
  { to: "/privacidade", label: "Política de privacidade" },
  { to: "/termos", label: "Termos de uso" },
] as const;

// Offer useful next steps instead of repeating every public URL on every article.
const RELATED_PAGES: Record<string, readonly string[]> = {
  "/taticas-e-formacoes": [
    "/guias",
    "/planejamento-de-elenco",
    "/analise-de-partida-de-futebol",
    "/glossario-do-futebol",
  ],
  "/guias": [
    "/taticas-e-formacoes",
    "/planejamento-de-elenco",
    "/analise-de-partida-de-futebol",
    "/modo-carreira-de-jogador",
    "/jogar-offline",
    "/ligas-de-futebol",
  ],
  "/planejamento-de-elenco": ["/guias", "/taticas-e-formacoes", "/brasileirao"],
  "/analise-de-partida-de-futebol": ["/guias", "/taticas-e-formacoes", "/planejamento-de-elenco"],
  "/modo-carreira-de-jogador": ["/guias", "/jogar-offline", "/comparativo-jogos-manager"],
  "/brasileirao": ["/ligas-de-futebol", "/regras"],
  "/ligas-de-futebol": ["/brasileirao", "/regras"],
  "/regras": ["/glossario-do-futebol", "/taticas-e-formacoes"],
  "/glossario-do-futebol": ["/regras", "/taticas-e-formacoes"],
  "/jogar-offline": ["/perguntas-frequentes", "/contato"],
  "/comparativo-jogos-manager": ["/sobre", "/jogar-offline", "/produtos"],
};

function relatedPublicPages(path?: string) {
  const destinations = RELATED_PAGES[path ?? ""] ?? ["/sobre", "/perguntas-frequentes", "/contato"];
  return PUBLIC_PAGES.filter(
    (page) => page.to !== path && (page.to === "/guias" || destinations.includes(page.to)),
  );
}

export function PublicLinks({ exclude }: { exclude?: string }) {
  return (
    <nav aria-label="Leituras relacionadas" className="mt-14 border-t border-border/60 pt-8">
      <h2 className="font-display text-sm uppercase tracking-[0.3em] text-primary">
        Continue por aqui
      </h2>
      <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
        {relatedPublicPages(exclude).map((p) => (
          <li key={p.to}>
            <Link to={p.to} className="hover:text-primary">
              {p.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
