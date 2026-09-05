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
  { to: "/perguntas-frequentes", label: "Perguntas frequentes" },
  { to: "/criador", label: "Sobre o criador" },
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
