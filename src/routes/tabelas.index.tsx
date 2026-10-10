import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicLinks } from "@/components/PublicLinks";
import { breadcrumbLd, canonical, seoMeta } from "@/lib/seo";
import { LEAGUE_LABELS } from "@/lib/league-labels";

const PATH = "/tabelas";
const TITLE = "Tabelas de classificação atualizadas: Brasileirão, Premier League e mais";
const DESC =
  "Classificação, campanha em casa e fora, forma recente e desfalques das principais ligas do mundo — e o mesmo clube pronto para você comandar no jogo.";

export const Route = createFileRoute("/tabelas/")({
  head: () => ({
    meta: seoMeta({ title: TITLE, description: DESC, path: PATH }),
    links: canonical(PATH),
    scripts: [breadcrumbLd([{ name: "Início", path: "/" }, { name: "Tabelas", path: PATH }])],
  }),
  component: TablesIndex,
});

function TablesIndex() {
  return (
    <main className="pitch-bg min-h-screen px-4 py-14">
      <div className="mx-auto max-w-5xl">
        <p className="font-display text-xs uppercase tracking-[0.4em] text-primary">Futebol real</p>
        <h1 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">Tabelas das principais ligas</h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          Cada página traz a classificação da temporada atual, quem rende melhor em casa e fora,
          o melhor ataque, a defesa mais sólida, a forma das últimas cinco rodadas e os jogadores
          lesionados. Use essas informações para escolher o clube da sua carreira de técnico.
        </p>
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(LEAGUE_LABELS).map(([slug, l]) => (
            <li key={slug}>
              <Link
                to="/tabelas/$slug"
                params={{ slug }}
                className="block rounded-xl border border-border/60 surface-card p-5 transition hover:border-primary"
              >
                <span className="font-display text-lg">{l.name}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{l.country}</span>
              </Link>
            </li>
          ))}
        </ul>
        <PublicLinks exclude={PATH} />
      </div>
    </main>
  );
}
