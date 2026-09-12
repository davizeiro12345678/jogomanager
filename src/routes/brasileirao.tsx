import { createFileRoute, Link } from "@tanstack/react-router";

import { PublicLinks } from "@/components/PublicLinks";
import { Crest } from "@/components/game/Crest";
import { getLeague } from "@/game/data/leagues";
import { articleLd, breadcrumbLd, canonical, itemListLd, seoMeta } from "@/lib/seo";

const PATH = "/brasileirao";
const TITLE = "Brasileirão no jogo de manager: todos os clubes | Pro Football Manager 3D";
const DESC =
  "Comande um clube do Brasileirão Série A ou Série B em um jogo de manager de futebol 3D e gratuito. Veja todos os times disponíveis e comece sua carreira.";

export const Route = createFileRoute("/brasileirao")({
  head: () => {
    const a = getLeague("bra");
    const b = getLeague("bra2");
    return {
      meta: seoMeta({ title: TITLE, description: DESC, path: PATH, type: "article" }),
      links: canonical(PATH),
      scripts: [
        articleLd({ headline: "Brasileirão no jogo de manager", description: DESC, path: PATH }),
        itemListLd(
          "Clubes do Brasileirão jogáveis",
          [...a.clubs, ...b.clubs].map((c) => c.name),
        ),
        breadcrumbLd([
          { name: "Início", path: "/" },
          { name: "Brasileirão", path: PATH },
        ]),
      ],
    };
  },
  component: Page,
});

function Page() {
  const leagues = [getLeague("bra"), getLeague("bra2")];

  return (
    <div className="pitch-bg min-h-screen px-4 py-14">
      <article className="mx-auto max-w-4xl">
        <p className="font-display text-xs uppercase tracking-[0.4em] text-primary">Brasil</p>
        <h1 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">
          Brasileirão no jogo de manager
        </h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          Série A e Série B estão jogáveis por inteiro. Escolha o clube, monte o elenco, dispute o
          campeonato ponto a ponto e acompanhe as partidas em 3D — de graça, no navegador.
        </p>

        <div className="mt-10 space-y-10">
          {leagues.map((l) => (
            <section key={l.id}>
              <h2 className="font-display text-2xl">{l.name}</h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {l.clubs.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center gap-3 rounded-xl border border-border/60 p-3"
                  >
                    <Crest club={c} size={32} detail="simple" />
                    <span className="text-sm">{c.name}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <h2 className="mt-12 font-display text-2xl">Qual clube escolher?</h2>
        <p className="mt-3 text-muted-foreground">
          Para a primeira carreira, um time de meio de tabela da Série A dá orçamento razoável e
          cobrança justa. Quem quer dificuldade real começa na Série B e tenta o acesso: o orçamento
          é curto e a diretoria exige resultado rápido.
        </p>

        <div className="mt-8">
          <Link
            to="/new"
            className="rounded-lg bg-primary px-6 py-3 font-display text-sm uppercase tracking-widest text-primary-foreground"
          >
            Escolher meu clube
          </Link>
        </div>

        <PublicLinks exclude={PATH} />
      </article>
    </div>
  );
}
