import { Link } from "@tanstack/react-router";

/**
 * Rodapé de confiança das páginas públicas.
 *
 * Reúne os sinais que buscadores e leitores procuram: quem escreve, quando o
 * conteúdo foi revisado, onde estão as políticas, como falar com a gente,
 * fontes externas consultadas e botões de compartilhamento.
 */

/** Data da última revisão editorial do conteúdo público. */
export const CONTENT_UPDATED = "2026-09-14";

const SHARE_TEXT = "Pro Football Manager 3D — jogo de manager de futebol online e grátis";

function shareLinks(url: string) {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(SHARE_TEXT);
  return [
    { label: "Compartilhar no WhatsApp", short: "WhatsApp", href: `https://wa.me/?text=${t}%20${u}` },
    { label: "Compartilhar no X", short: "X", href: `https://twitter.com/intent/tweet?text=${t}&url=${u}` },
    {
      label: "Compartilhar no Facebook",
      short: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
    },
    {
      label: "Compartilhar no Telegram",
      short: "Telegram",
      href: `https://t.me/share/url?url=${u}&text=${t}`,
    },
  ];
}

const SOURCES = [
  {
    href: "https://www.theifab.com/laws-of-the-game-documents/",
    label: "IFAB — Regras do Jogo",
  },
  {
    href: "https://www.cbf.com.br/futebol-brasileiro/competicoes",
    label: "CBF — competições brasileiras",
  },
  {
    href: "https://www.thesportsdb.com/",
    label: "TheSportsDB — escudos e elencos",
  },
  {
    href: "https://www.football-data.org/",
    label: "football-data.org — tabelas e calendários",
  },
];

export function SiteFooter({ path = "/" }: { path?: string }) {
  const url = `https://futebolmanager.xyz${path}`;
  const updated = new Date(`${CONTENT_UPDATED}T12:00:00Z`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <footer className="mt-14 border-t border-border/60 pt-8 text-sm text-muted-foreground">
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        <section>
          <h2 className="font-display text-xs uppercase tracking-[0.3em] text-primary">
            Quem escreve
          </h2>
          <p className="mt-3">
            Conteúdo produzido pela equipe editorial do{" "}
            <strong className="text-foreground">Pro Football Manager 3D</strong>, que também
            desenvolve o jogo — dez anos acompanhando futebol e jogos de gestão esportiva.
          </p>
          <p className="mt-2">
            <Link to="/criador" className="underline underline-offset-4 hover:text-foreground">
              Conheça o criador
            </Link>
          </p>
          <p className="mt-2">
            Revisado em{" "}
            <time dateTime={CONTENT_UPDATED} className="text-foreground">
              {updated}
            </time>
          </p>
        </section>

        <section>
          <h2 className="font-display text-xs uppercase tracking-[0.3em] text-primary">
            Institucional
          </h2>
          <ul className="mt-3 space-y-2">
            <li>
              <Link to="/sobre" className="hover:text-foreground">
                Sobre o jogo
              </Link>
            </li>
            <li>
              <Link to="/contato" className="hover:text-foreground">
                Contato e suporte
              </Link>
            </li>
            <li>
              <Link to="/privacidade" className="hover:text-foreground">
                Política de privacidade
              </Link>
            </li>
            <li>
              <Link to="/termos" className="hover:text-foreground">
                Termos de uso
              </Link>
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-xs uppercase tracking-[0.3em] text-primary">
            Fontes consultadas
          </h2>
          <ul className="mt-3 space-y-2">
            {SOURCES.map((s) => (
              <li key={s.href}>
                <a
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="hover:text-foreground"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="font-display text-xs uppercase tracking-[0.3em] text-primary">
            Compartilhar
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {shareLinks(url).map((s) => (
              <li key={s.short}>
                <a
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="inline-flex min-h-11 items-center rounded-lg border border-border/60 px-3 text-xs uppercase tracking-widest hover:border-primary hover:text-foreground"
                >
                  {s.short}
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs">
            Jogo gratuito, sem anúncios e sem obrigação de compra. Compras opcionais são processadas
            pela Stripe.
          </p>
        </section>
      </div>

      <p className="mt-8 text-xs">
        © {new Date().getFullYear()} Pro Football Manager 3D. Nomes de clubes e jogadores reais são
        citados apenas como referência esportiva pública.
      </p>
    </footer>
  );
}
