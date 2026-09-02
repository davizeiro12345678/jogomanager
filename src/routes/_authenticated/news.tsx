import { createFileRoute } from "@tanstack/react-router";

import { GameShell } from "@/components/game/GameShell";
import { useCareer } from "@/hooks/useCareer";
import type { NewsKind } from "@/game/types";

export const Route = createFileRoute("/_authenticated/news")({
  head: () => ({
    meta: [
      { title: "Notícias · Manager 3D" },
      {
        name: "description",
        content: "Tudo que acontece no clube: resultados, lesões, mercado e bastidores.",
      },
      { property: "og:title", content: "Notícias · Manager 3D" },
      { property: "og:description", content: "O feed de notícias do seu clube." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NewsPage,
});

const KIND_STYLE: Record<NewsKind, { label: string; cls: string }> = {
  resultado: { label: "Resultado", cls: "bg-primary/20 text-primary" },
  mercado: { label: "Mercado", cls: "bg-amber-400/20 text-amber-400" },
  lesao: { label: "Lesão", cls: "bg-destructive/20 text-destructive" },
  cartao: { label: "Disciplina", cls: "bg-amber-400/20 text-amber-400" },
  sistema: { label: "Clube", cls: "bg-secondary text-foreground" },
  premio: { label: "Prêmio", cls: "bg-yellow-500/20 text-yellow-400" },
};

function NewsPage() {
  const { career } = useCareer();
  if (!career) return <Empty />;

  return (
    <GameShell career={career}>
      <section className="mx-auto max-w-3xl rounded-2xl border border-border/60 bg-card/70 p-5">
        <h1 className="font-display text-2xl uppercase tracking-wide">Central de notícias</h1>
        <ul className="mt-4 space-y-3">
          {career.news.map((n) => {
            const style = KIND_STYLE[n.kind] ?? KIND_STYLE.sistema;
            return (
              <li
                key={n.id}
                className="rounded-xl border border-border/40 bg-background/40 p-4"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${style.cls}`}
                  >
                    {style.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Temporada {n.season} · Rodada {n.round}
                  </span>
                </div>
                <p className="mt-2 font-medium">{n.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>
              </li>
            );
          })}
          {career.news.length === 0 ? (
            <li className="text-muted-foreground">Nenhuma notícia ainda. Jogue a primeira rodada!</li>
          ) : null}
        </ul>
      </section>
    </GameShell>
  );
}

function Empty() {
  return (
    <div className="flex min-h-screen items-center justify-center text-muted-foreground">
      Nenhuma carreira ativa.
    </div>
  );
}
