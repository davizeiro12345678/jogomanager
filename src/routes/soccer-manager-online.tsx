import { createFileRoute, Link } from "@tanstack/react-router";

import { PublicLinks } from "@/components/PublicLinks";
import { articleLd, breadcrumbLd, canonical, seoMeta } from "@/lib/seo";

const PATH = "/soccer-manager-online";
const TITLE = "Soccer manager online: jogue no navegador em 3D | Pro Football Manager 3D: Jogo de Futebol Manager Online";
const DESC =
  "Monte seu elenco, defina táticas e assista aos 90 minutos em 3D. Jogo de manager de futebol online e grátis com clubes reais de 30+ ligas.";

export const Route = createFileRoute("/soccer-manager-online")({
  head: () => ({
    meta: seoMeta({ title: TITLE, description: DESC, path: PATH, type: "article" }),
    links: canonical(PATH),
    scripts: [
      articleLd({ headline: "Soccer manager online em 3D", description: DESC, path: PATH }),
      breadcrumbLd([
        { name: "Início", path: "/" },
        { name: "Soccer manager online", path: PATH },
      ]),
    ],
  }),
  component: Page,
});

const FEATURES = [
  ["Partidas em 3D", "Câmera de transmissão, jogadores animados, gols, faltas e defesas — ou pule direto para o resultado."],
  ["Ligas e clubes reais", "Brasileirão, Premier League, La Liga, Serie A, Bundesliga, Ligue 1, Primeira Liga e muitas outras."],
  ["Mercado de transferências", "Propostas, negociação de salário, cláusulas, empréstimos e clubes interessados nos seus jogadores."],
  ["Elenco vivo", "Idade, potencial, forma, moral, personalidade, lesões e evolução ao longo das temporadas."],
  ["Diretoria e torcida", "Objetivo de temporada, aprovação, pressão por resultado e risco real de demissão."],
  ["Finanças", "Folha salarial, bilheteria, patrocínios, capacidade do estádio e orçamento de contratações."],
];

function Page() {
  return (
    <div className="pitch-bg min-h-screen px-4 py-14">
      <article className="mx-auto max-w-3xl">
        <p className="font-display text-xs uppercase tracking-[0.4em] text-primary">Online</p>
        <h1 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">
          Soccer manager online, direto no navegador
        </h1>
        <p className="mt-4 text-muted-foreground">
          Nada para baixar e nada para pagar. Abra a página, escolha o clube e comande a temporada
          inteira: escalação, tática, contratações, finanças e as partidas renderizadas em 3D.
        </p>

        <div className="mt-8">
          <Link
            to="/new"
            className="rounded-lg bg-primary px-6 py-3 font-display text-sm uppercase tracking-widest text-primary-foreground"
          >
            Jogar agora
          </Link>
        </div>

        <h2 className="mt-12 font-display text-2xl">O que tem no jogo</h2>
        <dl className="mt-4 space-y-4">
          {FEATURES.map(([t, d]) => (
            <div key={t} className="rounded-xl border border-border/60 p-4">
              <dt className="font-display text-lg">{t}</dt>
              <dd className="mt-1 text-sm text-muted-foreground">{d}</dd>
            </div>
          ))}
        </dl>

        <h2 className="mt-12 font-display text-2xl">Funciona no celular?</h2>
        <p className="mt-3 text-muted-foreground">
          Sim. A interface se adapta à tela e o motor 3D tem três níveis de qualidade — no celular
          use o modo mais leve para manter a partida fluida.
        </p>

        <PublicLinks exclude={PATH} />
      </article>
    </div>
  );
}
