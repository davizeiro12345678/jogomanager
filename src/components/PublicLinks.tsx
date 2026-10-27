import { PUBLIC_PAGES } from "@/lib/public-pages";
import { Link } from "@tanstack/react-router";

// Offer useful next steps instead of repeating every public URL on every article.
const RELATED_PAGES: Record<string, readonly string[]> = {
  "/melhores-formacoes": [
    "/guias",
    "/planejamento-de-elenco",
    "/analise-de-partida-de-futebol",
    "/glossario-do-futebol",
  ],
  "/guias": [
    "/melhores-formacoes",
    "/planejamento-de-elenco",
    "/analise-de-partida-de-futebol",
    "/modo-carreira-de-jogador",
    "/jogar-offline",
    "/tabelas",
  ],
  "/planejamento-de-elenco": ["/guias", "/melhores-formacoes", "/mercado-de-transferencias"],
  "/analise-de-partida-de-futebol": ["/guias", "/melhores-formacoes", "/planejamento-de-elenco"],
  "/modo-carreira-de-jogador": ["/guias", "/jogar-offline", "/comparativo-jogos-manager"],
  "/tabelas": ["/analise-de-partida-de-futebol", "/regras"],
  "/regras": ["/glossario-do-futebol", "/melhores-formacoes"],
  "/glossario-do-futebol": ["/regras", "/melhores-formacoes"],
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
