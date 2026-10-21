import { createFileRoute } from "@tanstack/react-router";

import { articleLd, breadcrumbLd, canonical, seoMeta } from "@/lib/seo";
import { MatchAnalysisPage } from "@/pages/analise-de-partida-de-futebol";
import { ANALISE_DE_PARTIDA_DE_FUTEBOL_PATH as PATH } from "@/lib/public-route-paths";

const TITLE = "Como ler estatísticas de uma partida | JogoManager";

const DESC =
  "Interprete posse, chutes, xG e passes no JogoManager. Aprenda a transformar um dado do jogo em uma hipótese tática clara para a próxima partida.";

export const Route = createFileRoute("/analise-de-partida-de-futebol")({
  head: () => ({
    meta: seoMeta({ title: TITLE, description: DESC, path: PATH, type: "article", keywords: [] }),
    links: canonical(PATH),
    scripts: [
      articleLd({
        headline: "Como analisar uma partida pelas estatísticas",
        description: DESC,
        path: PATH,
      }),
      breadcrumbLd([
        { name: "Início", path: "/" },
        { name: "Guias", path: "/guias" },
        { name: "Análise de partida", path: PATH },
      ]),
    ],
  }),
  component: MatchAnalysisPage,
});
