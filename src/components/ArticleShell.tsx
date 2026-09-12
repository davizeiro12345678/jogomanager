import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { PublicLinks } from "@/components/PublicLinks";

/** Layout comum das páginas de conteúdo (guias e artigos públicos). */
export function ArticleShell({
  kicker,
  title,
  intro,
  path,
  children,
}: {
  kicker: string;
  title: string;
  intro: string;
  path: string;
  children: ReactNode;
}) {
  return (
    <div className="pitch-bg min-h-screen px-4 py-14">
      <div className="mx-auto max-w-3xl">
        <p className="font-display text-xs uppercase tracking-[0.4em] text-primary">{kicker}</p>
        <h1 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">{title}</h1>
        <p className="mt-4 text-muted-foreground">{intro}</p>
        <div className="mt-10 space-y-8">{children}</div>

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
      </div>
    </div>
  );
}

/** Bloco de seção com título e conteúdo. */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-border/60 surface-card p-5">
      <h2 className="font-display text-xl">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}
