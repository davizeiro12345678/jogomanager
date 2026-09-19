import { Link } from "@tanstack/react-router";

export const PUBLIC_PAGES = [
  { to: "/jogo-de-manager-de-futebol", label: "Jogo de manager de futebol grátis" },
  { to: "/soccer-manager-online", label: "Soccer manager online" },
  { to: "/como-ser-tecnico-de-futebol", label: "Como ser técnico de futebol" },
  { to: "/taticas-e-formacoes", label: "Táticas e formações" },
  { to: "/brasileirao", label: "Brasileirão no jogo" },
  { to: "/mercado-de-transferencias", label: "Mercado de transferências" },
  { to: "/ligas-de-futebol", label: "Ligas disponíveis" },
  { to: "/guias", label: "Guias" },
  { to: "/dicas-de-gestao", label: "Dicas de gestão" },
  { to: "/melhores-formacoes", label: "Melhores formações" },
  { to: "/guia-de-scouting", label: "Guia de scouting" },
  { to: "/gestao-financeira", label: "Gestão financeira" },
  { to: "/glossario-do-futebol", label: "Glossário do futebol" },
  { to: "/jogar-offline", label: "Como jogar offline" },
  { to: "/comparativo-jogos-manager", label: "Comparativo de jogos" },
  { to: "/perguntas-frequentes", label: "Perguntas frequentes" },
  { to: "/produtos", label: "Pacotes e passe de temporada" },
  { to: "/sobre", label: "Sobre o jogo" },
  { to: "/criador", label: "Sobre o criador" },
  { to: "/contato", label: "Contato e suporte" },
  { to: "/compartilhar", label: "Compartilhar o jogo" },
  { to: "/privacidade", label: "Política de privacidade" },
  { to: "/termos", label: "Termos de uso" },
] as const;

export function PublicLinks({ exclude }: { exclude?: string }) {
  return (
    <nav aria-label="Páginas do site" className="mt-14 border-t border-border/60 pt-8">
      <h2 className="font-display text-sm uppercase tracking-[0.3em] text-primary">
        Explore o site
      </h2>
      <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
        {PUBLIC_PAGES.filter((p) => p.to !== exclude).map((p) => (
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
