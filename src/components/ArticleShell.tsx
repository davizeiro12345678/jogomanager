import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { PublicLinks } from "@/components/PublicLinks";

export interface GuideFaq {
  q: string;
  a: string;
}

export interface GuideTocItem {
  id: string;
  title: string;
}

/**
 * Layout comum das páginas de conteúdo (guias e artigos públicos).
 * Formato padrão: capa → resumo → ficha → índice → seções → FAQ → ações → links.
 */
export function ArticleShell({
  kicker,
  title,
  intro,
  path,
  readMinutes,
  level,
  updated,
  toc,
  faq,
  children,
}: {
  kicker: string;
  title: string;
  intro: string;
  path: string;
  /** Tempo estimado de leitura em minutos. */
  readMinutes?: number;
  /** Nível recomendado do conteúdo. */
  level?: "Iniciante" | "Intermediário" | "Avançado";
  /** Data da última revisão, já formatada (ex.: "setembro de 2026"). */
  updated?: string;
  /** Índice com âncoras para as seções da página. */
  toc?: readonly GuideTocItem[];
  /** Perguntas frequentes específicas do guia. */
  faq?: readonly GuideFaq[];
  children: ReactNode;
}) {
  const facts = [
    readMinutes ? `${readMinutes} min de leitura` : null,
    level ?? null,
    updated ? `Revisado em ${updated}` : null,
  ].filter((f): f is string => Boolean(f));

  return (
    <main className="pitch-bg min-h-screen px-4 py-14">
      <article className="mx-auto max-w-3xl">
        <p className="font-display text-xs uppercase tracking-[0.4em] text-primary">{kicker}</p>
        <h1 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">{title}</h1>
        <p className="mt-4 text-muted-foreground">{intro}</p>

        {facts.length > 0 && (
          <ul className="mt-5 flex flex-wrap gap-2 text-xs text-muted-foreground">
            {facts.map((f) => (
              <li key={f} className="rounded-full border border-border/60 px-3 py-1">
                {f}
              </li>
            ))}
          </ul>
        )}

        {toc && toc.length > 0 && (
          <nav
            aria-label="Índice do guia"
            className="mt-8 rounded-2xl border border-border/60 surface-card p-5"
          >
            <h2 className="font-display text-sm uppercase tracking-[0.3em] text-primary">
              Neste guia
            </h2>
            <ol className="mt-3 space-y-1 text-sm text-muted-foreground">
              {toc.map((t, i) => (
                <li key={t.id}>
                  <a className="hover:text-primary" href={`#${t.id}`}>
                    <span className="text-primary">{i + 1}.</span> {t.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        )}

        <div className="mt-10 space-y-8">{children}</div>

        {faq && faq.length > 0 && (
          <section className="mt-12" id="faq">
            <h2 className="font-display text-2xl">Perguntas frequentes</h2>
            <div className="mt-4 space-y-3">
              {faq.map((f) => (
                <details
                  key={f.q}
                  className="rounded-xl border border-border/60 surface-card p-4 transition hover:border-primary/40"
                >
                  <summary className="cursor-pointer font-display text-base">{f.q}</summary>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
                </details>
              ))}
            </div>
          </section>
        )}

        <div className="mt-12 flex flex-wrap gap-3">
          <Link
            to="/new"
            className="rounded-lg bg-primary px-6 py-3 font-display text-sm uppercase tracking-widest text-primary-foreground transition hover:brightness-110"
          >
            Começar carreira
          </Link>
          <Link
            to="/partida-rapida"
            className="rounded-lg border border-border px-6 py-3 font-display text-sm uppercase tracking-widest transition hover:bg-secondary"
          >
            Jogar partida rápida
          </Link>
        </div>

        <PublicLinks exclude={path} />
      </article>
    </main>
  );
}

/** Bloco de seção com título e conteúdo. */
export function Section({
  title,
  id,
  children,
}: {
  title: string;
  id?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 rounded-2xl border border-border/60 surface-card p-5">
      <h2 className="font-display text-xl">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}
