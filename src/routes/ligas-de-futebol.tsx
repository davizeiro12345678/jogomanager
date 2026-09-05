import { createFileRoute, Link } from "@tanstack/react-router";

import { Flag } from "@/components/game/Flag";
import { LEAGUES } from "@/game/data/leagues";

export const Route = createFileRoute("/ligas-de-futebol")({
  head: () => ({
    meta: [
      { title: "Ligas de futebol disponíveis no jogo de manager | Manager 3D" },
      {
        name: "description",
        content:
          "Veja todas as ligas e campeonatos jogáveis no Manager 3D: Brasil, Inglaterra, Espanha, Itália, Alemanha, França, Portugal e mais, com todos os clubes de cada divisão.",
      },
      { property: "og:title", content: "Ligas de futebol disponíveis | Manager 3D" },
      {
        property: "og:description",
        content:
          "Lista completa das ligas e clubes que você pode comandar no jogo de manager de futebol 3D.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LeaguesPage,
});

function LeaguesPage() {
  const clubCount = LEAGUES.reduce((n, l) => n + l.clubs.length, 0);

  return (
    <div className="pitch-bg min-h-screen px-4 py-14">
      <div className="mx-auto max-w-5xl">
        <p className="font-display text-xs uppercase tracking-[0.4em] text-primary">Competições</p>
        <h1 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">
          Ligas de futebol disponíveis
        </h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          São {LEAGUES.length} campeonatos e {clubCount} clubes para comandar. Escolha qualquer um
          deles, monte o elenco e dispute a temporada com partidas em 3D no navegador — sem
          instalar nada.
        </p>

        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {LEAGUES.map((l) => (
            <section
              key={l.id}
              className="rounded-xl border border-border/60 bg-card/60 p-5 backdrop-blur"
            >
              <div className="flex items-center gap-3">
                <Flag country={l.country} size={28} />
                <div>
                  <h2 className="font-display text-xl leading-tight">{l.name}</h2>
                  <p className="text-xs text-muted-foreground">
                    {l.country} · {l.clubs.length} clubes
                  </p>
                </div>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {l.clubs.map((c) => c.name).join(", ")}.
              </p>
            </section>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap gap-3">
          <Link
            to="/new"
            className="rounded-lg bg-primary px-6 py-3 font-display text-sm uppercase tracking-widest text-primary-foreground transition hover:brightness-110"
          >
            Escolher meu clube
          </Link>
          <Link
            to="/guias"
            className="rounded-lg border border-border px-6 py-3 font-display text-sm uppercase tracking-widest transition hover:bg-secondary"
          >
            Guias para iniciantes
          </Link>
        </div>
      </div>
    </div>
  );
}
