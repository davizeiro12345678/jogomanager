import { createFileRoute, Link } from "@tanstack/react-router";

import { Flag } from "@/components/game/Flag";
import { LEAGUES } from "@/game/data/leagues";
import { PublicLinks } from "@/components/PublicLinks";
import { breadcrumbLd, canonical, itemListLd, seoMeta } from "@/lib/seo";

const PATH = "/ligas-de-futebol";
const TITLE =
  "Ligas de futebol disponíveis no jogo de manager | Pro Football Manager 3D: Jogo de Futebol Manager Online";
const DESC =
  "Mais de 30 ligas de futebol jogáveis: Brasileirão, Premier League, La Liga e mais. Escolha seu clube e comece a carreira de técnico.";

export const Route = createFileRoute("/ligas-de-futebol")({
  head: () => ({
    meta: seoMeta({ title: TITLE, description: DESC, path: PATH }),
    links: canonical(PATH),
    scripts: [
      itemListLd(
        "Ligas jogáveis",
        LEAGUES.map((l) => l.name),
      ),
      breadcrumbLd([
        { name: "Início", path: "/" },
        { name: "Ligas de futebol", path: PATH },
      ]),
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
          deles, monte o elenco e dispute a temporada com partidas em 3D no navegador — sem instalar
          nada.
        </p>

        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {LEAGUES.map((l) => (
            <section
              key={l.id}
              className="rounded-xl border border-border/60 surface-card p-5 backdrop-blur"
            >
              <div className="flex items-center gap-3">
                <Flag league={l.id} size={28} />
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

        <PublicLinks exclude="/ligas-de-futebol" />
      </div>
    </div>
  );
}
