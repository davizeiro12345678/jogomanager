import { createFileRoute } from "@tanstack/react-router";

import { GameShell } from "@/components/game/GameShell";
import { EmptyState, NoCareer, PrimaryLink } from "@/components/game/screen-kit";
import { NativeSponsoredCard } from "@/features/ads/AdZones";
import { useCareer } from "@/hooks/useCareer";
import type { NewsKind } from "@/game/types";

export const Route = createFileRoute("/news")({
  ssr: false,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, follow" },
      { title: "Notícias · Pro Football Manager 3D" },
      {
        name: "description",
        content:
          "Leia as notícias da rodada e acompanhe os acontecimentos do clube e das competições da sua carreira.",
      },
      {
        property: "og:title",
        content: "Notícias · Pro Football Manager 3D",
      },
      {
        property: "og:description",
        content:
          "Leia as notícias da rodada e acompanhe os acontecimentos do clube e das competições da sua carreira.",
      },
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
  vestiario: { label: "Vestiário", cls: "bg-emerald-400/20 text-emerald-400" },
  coletiva: { label: "Coletiva", cls: "bg-sky-400/20 text-sky-300" },
};

function NewsPage() {
  const { career } = useCareer();
  if (!career) return <NoCareer />;

  return (
    <GameShell career={career}>
      <section className="mx-auto max-w-3xl rounded-2xl border border-border/60 surface-card p-5">
        <h1 className="font-display text-2xl uppercase tracking-wide">Central de notícias</h1>
        {career.news.length === 0 ? (
          <EmptyState
            icon="📰"
            title="Nenhuma notícia ainda"
            hint="As notícias da sua carreira aparecem aqui a cada rodada."
            action={<PrimaryLink to="/carreira">Jogar a primeira rodada</PrimaryLink>}
          />
        ) : (
          <ul className="mt-4 space-y-3">
            {career.news.map((n, index) => {
              const style = KIND_STYLE[n.kind] ?? KIND_STYLE.sistema;
              return (
                <li key={n.id} className="contents">
                  {index > 0 && index % 4 === 0 ? (
                    <NativeSponsoredCard context="news" placement="feed" />
                  ) : null}
                  <article className="rounded-xl border border-border/40 bg-background/40 p-4">
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
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </GameShell>
  );
}
